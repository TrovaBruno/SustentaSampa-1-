# 🌧️ SustentaSampa

> **Plataforma colaborativa para monitoramento e prevenção de alagamentos urbanos em tempo real.**

![React 19](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Postgres_|_Auth_|_Realtime-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white)
![Capacitor](https://img.shields.io/badge/Capacitor-Android-1192E8?style=for-the-badge&logo=capacitor&logoColor=white)

---

## 👥 Integrantes

Projeto desenvolvido em grupo para a disciplina de **Gestão e Qualidade de Software** e **Modelos, Métodos e Técnicas da Engenharia de Software** (Universidade São Judas, 2026).

| Nome completo | RA | Papel |
| --- | --- | --- |
| Bruno Campaner Trova | 82317116 | Desenvolvedor (backend e frontend) |
| Filipe Carnevale do Nascimento | 823114347 | Tech Lead |
| Gabriel Rodrigues Buchalla | 823134131 | Product Owner |
| Henrique Santos Gerola | 823110656 | QA (testes e qualidade) |

---

## 📌 Sobre o Projeto

O **SustentaSampa** permite que os próprios cidadãos informem as condições de tráfego e o nível da água em suas regiões com poucos cliques. O aplicativo consolida esses dados em um mapa interativo e oferece indicadores de risco, probabilidade hidrológica, relatórios por região e um canal de comunicação direta entre os moradores.

> 💡 **Projeto 100% Independente:** construído sem SDKs proprietários ou intermediários de autenticação. Utiliza exclusivamente APIs abertas e a infraestrutura open-source do Supabase.

**Aplicação em produção:** https://sustenta-sampa-1.vercel.app/

---

## ✨ Funcionalidades Principais

* 🗺️ **Mapa de Calor Colaborativo:** registros das últimas 24 horas, com regiões críticas (10+ reportes) piscando em vermelho; atualiza sozinho.
* ⚡ **Reporte Rápido em 3 passos:** *Transitabilidade → Nível da água → Foto obrigatória*, com a posição real (GPS) e o CEP obtidos automaticamente.
* ⏱️ **Limite de 3 reportes por hora:** o app mostra o motivo e um cronômetro com o tempo restante.
* 🛡️ **Indicador de Risco do Entorno:** nível *Baixo, Médio, Alto ou Crítico* num raio de 1 km (2,5 km no Modo Emergência).
* 🔔 **Alerta de proximidade:** avisa o usuário ao entrar numa área com mais de 10 reportes na última hora.
* 📊 **Probabilidade de Alagamento:** estimativa combinando intensidade da chuva, previsão, acumulado e vazão de rios (Open-Meteo).
* 🌊 **Rios:** nível das estações telemétricas da ANA mais próximas, com busca por nome, bacia ou município.
* 📄 **Relatório por região:** dashboard com reportes por período (dia, semana, mês, ano), zona de risco, rios próximos e **exportação em PDF**.
* 💬 **Chat da Comunidade:** mensagens em tempo real (Supabase Realtime).
* 🏆 **Gamificação:** 10 pontos por reporte (removidos se o administrador ocultar o reporte) e cores de avatar desbloqueadas por marcos de pontos.
* 🆘 **SOS:** discagem direta para a Defesa Civil e Bombeiros e compartilhamento da localização por SMS.
* 🔐 **Autenticação:** e-mail/senha, login com Google e redefinição de senha; mensagens de erro em português.
* 🧑‍⚖️ **Moderação:** administradores ocultam reportes e excluem mensagens (regras aplicadas no banco via RLS).

---

## 🛠️ Stack Técnica

| Camada | Tecnologia | Descrição |
| --- | --- | --- |
| **Frontend** | React 19 + Vite 6 + TypeScript | SPA de alta performance |
| **Estilização** | Tailwind CSS v4 | Tema escuro de alto contraste |
| **Roteamento** | TanStack Router | Roteamento baseado em arquivos |
| **Backend & Banco** | Supabase | PostgreSQL, Auth, Storage, Realtime, RLS e Edge Functions |
| **Mapas** | Leaflet + OpenStreetMap (+ leaflet.heat) | Mapa interativo e mapa de calor |
| **PDF** | jsPDF | Exportação do relatório por região |
| **Mobile** | Capacitor | Empacotamento nativo para Android |
| **Testes** | Vitest | Testes automatizados das regras de negócio |
| **CI/CD** | GitHub Actions + Vercel | Lint, tipos, testes e build; deploy automático |
| **Dados externos** | Open-Meteo, ANA (HidroWebService), Nominatim/OSM | Clima, rios e geocodificação |

---

## 🚀 Como executar

Pré-requisitos: Node.js 20+ e um projeto Supabase.

```bash
git clone https://github.com/TrovaBruno/SustentaSampa-1-.git
cd SustentaSampa-1-
npm install
cp .env.example .env     # preencha VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY
npm run dev              # http://localhost:5173
```

Outros comandos: `npm test` (testes), `npm run lint`, `npm run typecheck`, `npm run build`.
O banco é criado aplicando, em ordem, os arquivos de `supabase/migrations/` no SQL Editor do Supabase.
As credenciais da ANA ficam apenas como *secrets* das Edge Functions, nunca no código do cliente.

---

## 📂 Estrutura de Arquivos

```text
SustentaSampa-1-/
├── .github/workflows/ci.yml          # Integração contínua (lint, tipos, testes, build)
├── docs/                             # Documentação do projeto (ver docs/README.md)
├── public/                           # Páginas estáticas (sobre, termos, privacidade)
├── src/
│   ├── components/
│   │   ├── AppShell.tsx              # Navegação, cabeçalho e guarda de autenticação
│   │   └── report-charts.tsx         # Gráficos do relatório por região
│   ├── integrations/supabase/        # Cliente Supabase e tipos do banco
│   ├── lib/                          # Regras de negócio (puras e testadas)
│   │   ├── floodguard-geo.ts         # Distância e níveis de risco
│   │   ├── floodguard-clusters.ts    # Agrupamento de reportes por região
│   │   ├── flood-probability.ts      # Probabilidade de alagamento
│   │   ├── weather.ts                # Open-Meteo (clima e vazão)
│   │   ├── report-limit.ts           # Limite de 3 reportes/hora e cronômetro
│   │   ├── proximity-alert.ts        # Alerta ao entrar em área com muitos reportes
│   │   ├── region-report.ts          # Cálculos do relatório por região
│   │   ├── report-pdf.ts             # Geração do PDF
│   │   ├── auth-errors.ts            # Tradução dos erros de autenticação
│   │   ├── avatars.ts, cep.ts, geocode.ts
│   │   └── *.test.ts                 # Testes automatizados (Vitest)
│   ├── routes/
│   │   ├── __root.tsx                # Layout base, 404 e tratamento de erros
│   │   ├── index.tsx                 # Mapa, reporte rápido, pontos, SOS
│   │   ├── auth.tsx, reset-password.tsx
│   │   ├── rios.tsx                  # Rios próximos (ANA)
│   │   ├── chat.tsx                  # Chat em tempo real
│   │   ├── probabilidade.tsx         # Probabilidade de alagamento
│   │   └── relatorio.tsx             # Dashboard e PDF por região
│   ├── main.tsx
│   └── styles.css
├── supabase/
│   ├── migrations/                   # 0001 a 0008: schema, fotos, moderação, avatar, rios, limite, pontos
│   └── functions/                    # Edge Functions da ANA (ana-station-level, ana-sync-stations)
├── capacitor.config.ts               # Aplicativo Android
├── vercel.json                       # Reescrita de rotas da SPA na Vercel
└── package.json
```

---

## 📚 Documentação

Toda a documentação relevante para entender a proposta está em [`docs/`](docs/README.md):

| Documento | Conteúdo |
| --- | --- |
| [`docs/requisitos.md`](docs/requisitos.md) | Necessidades, requisitos funcionais e não funcionais |
| [`docs/modelagem.md`](docs/modelagem.md) | Casos de uso, diagrama de classes e diagramas de sequência |
| [`docs/arquitetura.md`](docs/arquitetura.md) | Arquitetura, banco de dados, segurança e decisões técnicas |
| [`docs/Engenharia_de_Requisitos_II.xlsx`](docs/Engenharia_de_Requisitos_II.xlsx) | Planilha completa: stakeholders, elicitação, validação e rastreabilidade |

---

## Integração contínua

A cada push e pull request na `main`, o GitHub Actions roda lint, testes, build e checagem de tipos (`.github/workflows/ci.yml`).
