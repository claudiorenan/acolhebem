-- P0.6: Rate Limiting por Usuario
-- Tabela para rastrear acoes e funcao RPC para verificar limites

-- 1. Tabela rate_limits
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  action text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Index para queries eficientes por usuario + acao + tempo
CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup
  ON public.rate_limits (user_id, action, created_at DESC);

-- RLS: usuarios so veem seus proprios registros
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own rate limits"
  ON public.rate_limits FOR SELECT
  USING (auth.uid() = user_id);

-- Sem INSERT/DELETE direto - tudo via RPC com SECURITY DEFINER

-- 2. Funcao RPC: check_rate_limit
-- Verifica se o usuario pode executar a acao e registra atomicamente
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_action text,
  p_max_count int,
  p_window_seconds int DEFAULT 3600
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_count int;
  v_window_start timestamptz;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'not_authenticated'
    );
  END IF;

  v_window_start := now() - make_interval(secs => p_window_seconds);

  -- Contar acoes dentro da janela de tempo
  SELECT count(*) INTO v_count
  FROM public.rate_limits
  WHERE user_id = v_user_id
    AND action = p_action
    AND created_at >= v_window_start;

  -- Se excedeu o limite, bloquear
  IF v_count >= p_max_count THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'rate_limited',
      'current', v_count,
      'max', p_max_count,
      'retry_after', p_window_seconds
    );
  END IF;

  -- Registrar a acao
  INSERT INTO public.rate_limits (user_id, action)
  VALUES (v_user_id, p_action);

  -- Limpar registros antigos (> 24h) para manter tabela enxuta
  DELETE FROM public.rate_limits
  WHERE user_id = v_user_id
    AND action = p_action
    AND created_at < now() - interval '24 hours';

  RETURN jsonb_build_object(
    'allowed', true,
    'current', v_count + 1,
    'max', p_max_count
  );
END;
$$;

-- Permitir que usuarios autenticados chamem a funcao
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, int, int) TO authenticated;
