import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const CADEMEUPSI_BASE = "https://cademeupsi.com.br";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * Generate a deterministic password from email using HMAC.
 * This allows the frontend to sign in after the Edge Function creates the user.
 */
async function generateDeterministicPassword(email: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(email));
  return base64Encode(new Uint8Array(signature)).substring(0, 32);
}

/**
 * Parse Set-Cookie headers and extract cookie key=value pairs.
 */
function parseCookies(response: Response): string {
  const cookies: string[] = [];
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") {
      const match = value.match(/^([^=]+)=([^;]*)/);
      if (match) {
        cookies.push(`${match[1]}=${match[2]}`);
      }
    }
  });
  return cookies.join("; ");
}

/**
 * Extract XSRF token from cookies (URL-decoded).
 */
function extractXsrfToken(cookieString: string): string | null {
  const match = cookieString.match(/XSRF-TOKEN=([^;]+)/);
  if (!match) return null;
  return decodeURIComponent(match[1]);
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "Email e senha são obrigatórios." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================================
    // STEP 1: Get CSRF cookie from Sanctum
    // ========================================
    const csrfResponse = await fetch(`${CADEMEUPSI_BASE}/sanctum/csrf-cookie`, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "Referer": CADEMEUPSI_BASE,
        "Origin": CADEMEUPSI_BASE,
      },
      redirect: "manual",
    });

    const cookies = parseCookies(csrfResponse);
    const xsrfToken = extractXsrfToken(cookies);

    if (!xsrfToken) {
      return new Response(
        JSON.stringify({ error: "Não foi possível conectar ao Cadê Meu Psi. Tente novamente." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================================
    // STEP 2: Login via Sanctum
    // ========================================
    const loginResponse = await fetch(`${CADEMEUPSI_BASE}/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Cookie": cookies,
        "X-XSRF-TOKEN": xsrfToken,
        "Referer": CADEMEUPSI_BASE,
        "Origin": CADEMEUPSI_BASE,
      },
      body: JSON.stringify({ email, password }),
      redirect: "manual",
    });

    // Sanctum returns 200 or 204 on success, 422 on invalid credentials
    if (loginResponse.status === 422 || loginResponse.status === 401) {
      return new Response(
        JSON.stringify({ error: "Credenciais inválidas no Cadê Meu Psi." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Merge session cookies from login response
    const loginCookies = parseCookies(loginResponse);
    const allCookies = [cookies, loginCookies].filter(Boolean).join("; ");
    const newXsrf = extractXsrfToken(allCookies) || xsrfToken;

    // ========================================
    // STEP 3: Fetch user data from API
    // ========================================
    const userResponse = await fetch(`${CADEMEUPSI_BASE}/api/v1/user`, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "Cookie": allCookies,
        "X-XSRF-TOKEN": newXsrf,
        "Referer": CADEMEUPSI_BASE,
      },
    });

    if (!userResponse.ok) {
      return new Response(
        JSON.stringify({ error: "Erro ao buscar dados do profissional." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const psiUser = await userResponse.json();

    // Extract useful fields (adapt based on actual API response structure)
    const psiName = psiUser.name || psiUser.data?.name || email.split("@")[0];
    const firstName = psiName.split(" ")[0];
    const displayName = `Psi.${firstName}`;
    const crp = psiUser.crp || psiUser.data?.crp || null;
    const psiId = psiUser.id || psiUser.data?.id || null;
    const psiWhatsapp = psiUser.whatsapp || psiUser.data?.whatsapp || psiUser.phone || psiUser.data?.phone || null;
    const psiCity = psiUser.city || psiUser.data?.city || null;
    const psiState = psiUser.state || psiUser.data?.state || null;
    const psiPhoto = psiUser.photo || psiUser.data?.photo || psiUser.avatar || psiUser.data?.avatar || null;

    // ========================================
    // STEP 4: Create/update Supabase user
    // ========================================
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const psiSecret = Deno.env.get("PSI_AUTH_SECRET") || supabaseServiceKey.substring(0, 32);

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const deterministicPassword = await generateDeterministicPassword(email, psiSecret);

    // Try to find existing user by email
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u: { email?: string }) => u.email === email
    );

    let userId: string;

    if (existingUser) {
      // Update existing user password to allow login
      userId = existingUser.id;
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: deterministicPassword,
        email_confirm: true,
      });
    } else {
      // Create new user
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: deterministicPassword,
        email_confirm: true,
        user_metadata: {
          name: displayName,
          is_psi: true,
        },
      });

      if (createError) {
        return new Response(
          JSON.stringify({ error: "Erro ao criar conta: " + createError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      userId = newUser.user.id;
    }

    // ========================================
    // STEP 5: Upsert profile with psi data
    // ========================================
    const profileData: Record<string, unknown> = {
      id: userId,
      name: displayName,
      is_psi: true,
      cademeupsi_id: psiId,
      crp: crp,
    };

    if (psiWhatsapp) profileData.whatsapp = psiWhatsapp;
    if (psiCity) profileData.city = psiCity;
    if (psiState) profileData.state = psiState;
    if (psiPhoto) profileData.photo_url = psiPhoto;

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert(profileData, { onConflict: "id" });

    if (profileError) {
      console.error("Profile upsert error:", profileError);
    }

    // ========================================
    // STEP 6: Return success with password
    // ========================================
    return new Response(
      JSON.stringify({
        success: true,
        email,
        password: deterministicPassword,
        name: displayName,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("psi-auth error:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
