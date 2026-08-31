# 🌧️ SustentaSampa

> **Plataforma colaborativa para monitoramento e prevenção de alagamentos urbanos em tempo real.**

![React 19](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Postgres_|_Auth_|_Realtime-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white)
![Capacitor](https://img.shields.io/badge/Capacitor-Android-1192E8?style=for-the-badge&logo=capacitor&logoColor=white)

---

## 📌 Sobre o Projeto

O **SustentaSampa** permite que os próprios cidadãos informem as condições de tráfego e o nível da água em suas regiões com poucos cliques. O aplicativo consolida esses dados em um mapa interativo e oferece indicadores de risco, probabilidade hidrológica e um canal de comunicação direta entre os moradores.

> 💡 **Projeto 100% Independente:** Construído sem SDKs proprietários ou intermediários de autenticação. Utiliza exclusivamente APIs abertas e a infraestrutura open-source do Supabase.

---

## ✨ Funcionalidades Principais

* 🗺️ **Mapa de Calor Colaborativo:** Visualização geográfica dos registros das últimas 24 horas, destacando em vermelho áreas críticas (com 10+ reportes).
* ⚡ **Reporte Rápido em 3 Toques:** Fluxo otimizado *(Transitabilidade → Nível da água → Enviar)* com geocodificação automática por CEP baseada na localização.
* 🛡️ **Indicador de Risco do Entorno:** Cálculo de nível de risco (*Baixo, Médio, Alto ou Crítico*) considerando os alertas registrados num raio de 1 km.
* 📊 **Probabilidade de Alagamento:** Estimativa por região combinando previsão do tempo e dados de vazão de rios próximos via fontes públicas (Open-Meteo).
* 💬 **Chat da Comunidade:** Canal de mensagens instantâneas alimentado por **Supabase Realtime**.
* 🏆 **Gamificação:** Sistema de pontuação acumulativa a cada reporte enviado para incentivar a colaboração.
* 🔐 **Autenticação Integrada:** Suporte a e-mail/senha e login social com Google.

---

## 🛠️ Stack Técnica

| Camada | Tecnologia | Descrição |
| :--- | :--- | :--- |
| **Frontend** | React 19 + Vite | Interface reativa e build de alta performance |
| **Roteamento** | TanStack Router | Roteamento baseado em arquivos para SPAs |
| **Estilização** | Tailwind CSS v4 | Design system responsivo e tema escuro |
| **Backend & Banco** | Supabase | PostgreSQL, Auth, Realtime e Row Level Security |
| **Mapas** | Leaflet + OpenStreetMap | Renderização e manipulação de mapas interativos |
| **Mobile** | Capacitor | Empacotamento nativo para Android |
| **Gerenciador** | npm / Bun | Gerenciamento de dependências |

---

## 📂 Estrutura de Arquivos

```text
sustentasampa/
├── src/
│   ├── components/
│   │   └── AppShell.tsx            # Navegação, cabeçalho e guarda de autenticação
│   ├── integrations/supabase/
│   │   ├── client.ts               # Instância do cliente Supabase
│   │   └── types.ts                # Tipos TypeScript do banco de dados
│   ├── lib/
│   │   ├── cep.ts                  # Geocodificação reversa por CEP
│   │   ├── weather.ts              # Consulta a APIs de clima e rios (Open-Meteo)
│   │   ├── floodguard-geo.ts       # Cálculos de distância e níveis de risco
│   │   └── floodguard-clusters.ts  # Agrupamento visual de reportes no mapa
│   ├── routes/
│   │   ├── __root.tsx              # Layout base, tela 404 e tratamento de erros
│   │   ├── index.tsx               # Mapa principal, reporte rápido e pontos
│   │   ├── auth.tsx                # Tela de Login e Cadastro
│   │   ├── chat.tsx                # Chat comunitário em tempo real
│   │   └── probabilidade.tsx       # Painel de probabilidade de alagamento
│   ├── main.tsx                    # Bootstrap da aplicação
│   └── styles.css                  # Tema escuro de alto contraste
└── supabase/
    └── migrations/
        └── 0001_schema.sql         # Schema completo do banco de dados