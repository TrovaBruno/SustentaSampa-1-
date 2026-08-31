README
SustentaSampa
Aplicativo colaborativo de monitoramento de alagamentos urbanos. Usuários reportam
condições de tráfego e nível de água em suas regiões em poucos toques, e o app
consolida esses reportes em um mapa de calor em tempo real, com indicadores de
risco por área, chat da comunidade e probabilidade de alagamento baseada em
dados meteorológicos e de rios.
Funcionalidades
Mapa de calor colaborativo — reportes recentes (últimas 24h) agrupados por
região, com destaque visual para áreas críticas (10+ reportes).
Reporte rápido — fluxo de 3 toques (transitabilidade → nível da água →
enviar), com geocodificação automática por CEP a partir da localização do
usuário.
Status de risco do entorno — nível de risco (Baixo/Médio/Alto/Crítico)
calculado a partir dos reportes num raio de 1 km.
Probabilidade de alagamento — estimativa por região combinando previsão
do tempo e vazão de rios próximos (fontes abertas, sem chave de API).
Chat da comunidade — mensagens em tempo real via Supabase Realtime.
Gamificação — pontuação por reporte enviado.
Autenticação — e-mail/senha e login com Google (Supabase Auth).
Stack técnica
Camada
Tecnologia
Framework
React 19 + Vite
Roteamento
TanStack Router (file-based, SPA)
Estilo
Tailwind CSS v4
Backend
Supabase (Postgres, Auth, Realtime)
Mapa
Leaflet + OpenStreetMap
Empacotamento
Capacitor (Android)
Gerenciador
Bun
Projeto 100% independente: sem nenhuma dependência de plataformas de terceiros
(sem SDKs proprietários, sem intermediação de auth) — apenas bibliotecas
públicas de código aberto e a API do Supabase.
O package-lock.json está versionado para travar as versões exatas das
dependências. Se for usar Bun no lugar do npm, apague-o e rode bun install
para gerar um bun.lock (não misture os dois lockfiles no repositório).
Estrutura do projeto
src/
├── components/
│   └── AppShell.tsx             # guarda de autenticação, navegação, cabeçalho
├── integrations/supabase/
│   ├── client.ts                 # cliente Supabase
│   └── types.ts                  # tipos gerados a partir do schema
├── lib/
│   ├── cep.ts                     # geocodificação reversa por CEP
│   ├── weather.ts                  # clima e nível de rios (Open-Meteo)
│   ├── floodguard-geo.ts            # cálculo de risco e distâncias
│   └── floodguard-clusters.ts        # agrupamento de reportes em clusters
├── routes/
│   ├── __root.tsx                     # layout raiz, 404 e tratamento de erro
│   ├── index.tsx                       # mapa + reporte rápido + gamificação
│   ├── auth.tsx                         # login e cadastro
│   ├── chat.tsx                          # chat da comunidade
│   └── probabilidade.tsx                  # probabilidade de alagamento
├── main.tsx                        # bootstrap do React Router
└── styles.css                       # design system (tema escuro de alto contraste)

supabase/migrations/                 # schema do banco (referência)
​
Como rodar localmente
Pré-requisitos
Node.js 20+ (ou Bun, como alternativa mais rápida)
Uma conta Supabase própria
Instalação
npm install
cp .env.example .env
​
Preencha o .env com as credenciais do seu projeto Supabase (Settings → API):
VITE_SUPABASE_URL="https://SEU_PROJETO.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."
​
Banco de dados
No SQL Editor do seu projeto Supabase, execute o conteúdo de
supabase/migrations/0001_schema.sql. Isso cria as tabelas profiles,
flood_reports e chat_messages, as políticas de RLS, os triggers de
pontuação e habilita o Realtime para o chat.
Para login com Google, configure o provedor em Authentication → Providers →
Google no painel do Supabase, usando credenciais OAuth do
Google Cloud Console e a callback URL
exibida na própria tela do Supabase.
Executar
npm run dev
​
Acesse http://localhost:5173.
Scripts disponíveis
Comando
Descrição
npm run dev
Servidor de desenvolvimento com hot reload
npm run build
Checagem de tipos + build de produção em dist/
npm run preview
Serve o build de produção localmente
npm run lint
ESLint
npm run format
Prettier
Use bun run <script> no lugar de npm run <script> se preferir o Bun.
Empacotamento para Android (Capacitor)
npm run build
npm install @capacitor/core @capacitor/android
npm install -D @capacitor/cli
npx cap add android
npx cap sync android
npx cap open android
​
O capacitor.config.ts já aponta para dist/, empacotando os assets
estáticos diretamente no APK.