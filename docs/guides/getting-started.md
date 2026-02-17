# AcolheBem - Getting Started Guide

## Pré-requisitos
- Node.js 18+
- Python 3.x
- Git
- npm

## Setup Rápido

### 1. Static Site (Diretório de Psicólogos)
```bash
# Na raiz do projeto
python server.py 4500
# Acessar http://localhost:4500
```

### 2. Next.js App (Plataforma Interativa)
```bash
cd cademeupsi
npm install
npm run dev
# Acessar http://localhost:3000
```

## Estrutura do Projeto

```
AcolheBem/
├── .aios-core/          # Framework AIOS (Synkra)
├── docs/                # Documentação
│   ├── stories/         # User stories
│   ├── prd/             # Requisitos de produto
│   ├── architecture/    # Documentação de arquitetura
│   └── guides/          # Guias (este arquivo)
├── cademeupsi/          # App Next.js
├── index.html           # Site estático
├── app.js               # Lógica do site estático
├── styles.css           # Estilos do site estático
├── server.py            # Proxy Python (dev)
├── aios.config.js       # Configuração AIOS
└── CLAUDE.md            # Instruções para Claude Code
```

## Usando o AIOS

### Ativar Agentes
- `@aios-master` - Orquestrador principal
- `@dev` - Desenvolvedor
- `@qa` - Qualidade
- `@architect` - Arquitetura
- `@pm` - Product Manager
- `@po` - Product Owner

### Comandos Comuns
- `*help` - Ajuda
- `*create-next-story` - Criar nova story
- `*task {nome}` - Executar tarefa
- `*workflow {nome}` - Iniciar workflow
- `*status` - Ver status atual

## Scripts Disponíveis (Next.js)
```bash
npm run dev      # Servidor de desenvolvimento
npm run build    # Build de produção
npm run lint     # Verificar código
npm start        # Executar build
```
