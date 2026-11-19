# Modelagem do SustentaSampa

Modelagem dos requisitos funcionais priorizados e já implementados: casos de uso, diagrama de classes e diagramas de sequência. Os diagramas abaixo usam Mermaid e são exibidos diretamente no GitHub.

## 1. Casos de uso

### Atores

| Ator | Descrição |
| --- | --- |
| Usuário | Morador que usa o aplicativo (web ou Android) |
| Administrador | Usuário com permissão de moderação |
| Google | Sistema externo usado no login social |
| ANA | Sistema externo com os níveis dos rios |

### Diagrama de casos de uso

```mermaid
flowchart LR
  U([Usuário])
  A([Administrador])
  G([Google])
  ANA([ANA])

  subgraph SISTEMA[SustentaSampa]
    UC01([UC01 Fazer login / cadastro])
    UC02([UC02 Reportar alagamento])
    UC02a([Detectar localização])
    UC02b([Anexar foto obrigatória])
    UC03([UC03 Visualizar mapa de risco])
    UC04([UC04 Consultar nível de rios])
    UC05([UC05 Enviar mensagem no chat])
    UC06([UC06 Acionar SOS])
    UC07([UC07 Ocultar reporte do mapa])
    UC08([UC08 Excluir mensagem do chat])
    UC09([UC09 Gerar relatório por região])
    UC10([UC10 Receber alerta de proximidade])
  end

  U --- UC01
  U --- UC02
  U --- UC03
  U --- UC04
  U --- UC05
  U --- UC06
  U --- UC09
  U --- UC10
  A --- UC07
  A --- UC08
  UC01 --- G
  UC04 --- ANA
  UC02 -. include .-> UC02a
  UC02 -. include .-> UC02b
  A -. é um .-> U
```

### Casos de uso e requisitos

| Caso de uso | Requisitos funcionais |
| --- | --- |
| UC01 Fazer login / cadastro | RF01, RF02, RF03, RF04, RF05 |
| UC02 Reportar alagamento | RF07, RF08, RF14 (a pontuação é pós-condição do envio), RNF05, RNF06 |
| UC03 Visualizar mapa de risco | RF06, RF09, RF10, RF11 |
| UC04 Consultar nível de rios | RF16, RF17 |
| UC05 Enviar mensagem no chat | RF12 |
| UC06 Acionar SOS | RF18, RF19 |
| UC07 Ocultar reporte do mapa | RF20 |
| UC08 Excluir mensagem do chat | RF13 |
| UC09 Gerar relatório por região | Funcionalidade adicional, não prevista na especificação da disciplina |
| UC10 Receber alerta de proximidade | Funcionalidade adicional, não prevista na especificação da disciplina |

O RF15 (personalização do avatar) é tratado como extensão do perfil e aparece no diagrama de classes (`Perfil.avatarColor`).

## 2. Diagrama de classes

```mermaid
classDiagram
  class Perfil {
    +uuid id
    +string displayName
    +int points
    +int reportsCount
    +string avatarColor
    +bool isAdmin
    +corDesbloqueada(cor) bool
  }
  class Reporte {
    +uuid id
    +double lat
    +double lng
    +string cep
    +Transitabilidade trafficability
    +NivelAgua waterLevel
    +double weight
    +string photoUrl
    +datetime hiddenAt
    +datetime createdAt
    +calcularPeso() double
    +ocultar()
  }
  class MensagemChat {
    +uuid id
    +string displayName
    +string content
    +datetime createdAt
  }
  class EstacaoRio {
    +string codigoEstacao
    +string nome
    +string rioBacia
    +string municipio
    +string uf
    +double lat
    +double lng
  }
  class Transitabilidade {
    <<enumeration>>
    transitavel
    veiculos_altos
    intransitavel
  }
  class NivelAgua {
    <<enumeration>>
    canela
    joelho
    acima_capo
  }
  class RegiaoCritica {
    <<derivada>>
    +double lat
    +double lng
    +int count
    +bool critical
  }

  Perfil "1" --> "0..*" Reporte : envia (máx. 3 por hora)
  Perfil "1" --> "0..*" MensagemChat : escreve
  Reporte --> Transitabilidade
  Reporte --> NivelAgua
  Reporte "10..*" --> "1" RegiaoCritica : agrupados por CEP
  Perfil "0..1" ..> Reporte : administrador oculta
  Perfil "0..1" ..> MensagemChat : administrador exclui
```

Regras associadas: cada reporte gravado soma 10 pontos ao `Perfil` e, se for ocultado por um administrador, os 10 pontos são removidos (gatilhos no banco). O 4º reporte na mesma hora é recusado.

## 3. Diagramas de sequência

### 3.1 Reportar alagamento (UC02, RF07, RF08, RF14, RNF05)

```mermaid
sequenceDiagram
  actor U as Usuário
  participant App as Aplicativo (SPA)
  participant Geo as GPS / Nominatim
  participant St as Supabase Storage
  participant DB as Supabase (PostgreSQL)

  U->>App: Toca em "+ Reportar alagamento"
  App->>Geo: Obtém posição real e CEP
  Geo-->>App: lat, lng, CEP
  U->>App: Escolhe transitabilidade, nível da água e foto
  App->>App: Comprime a foto e calcula o peso do reporte
  App->>St: Envia a foto
  St-->>App: URL pública da foto
  App->>DB: INSERT flood_reports (RLS: user_id = usuário)
  alt Já enviou 3 reportes na última hora
    DB-->>App: Erro RATE_LIMIT_EXCEEDED
    App-->>U: Mostra o motivo e o cronômetro do tempo restante
  else Dentro do limite
    DB->>DB: Gatilho soma 10 pontos e 1 reporte ao perfil
    DB-->>App: Reporte gravado
    App->>DB: Recarrega o perfil e os reportes
    App-->>U: Confirma o envio, mostra a nova pontuação e atualiza o mapa
  end
```

### 3.2 Login com e-mail e senha (UC01, RF02)

```mermaid
sequenceDiagram
  actor U as Usuário
  participant App as Aplicativo (SPA)
  participant Auth as Supabase Auth

  U->>App: Informa e-mail e senha
  App->>Auth: signInWithPassword
  alt Credenciais corretas
    Auth-->>App: Sessão
    App-->>U: Abre a tela principal (mapa)
  else Credenciais incorretas
    Auth-->>App: Erro em inglês
    App->>App: Traduz o erro (translateAuthError)
    App-->>U: "E-mail ou senha incorretos."
  end
```

### 3.3 Consultar nível de rios (UC04, RF16, RF17, RNF09)

```mermaid
sequenceDiagram
  actor U as Usuário
  participant App as Aplicativo (SPA)
  participant DB as Supabase (river_stations)
  participant EF as Edge Function ana-station-level
  participant ANA as ANA HidroWebService

  U->>App: Abre a aba "Rios"
  App->>DB: Estações próximas da localização (ou busca por nome)
  DB-->>App: Lista de estações
  U->>App: Pede o nível de uma estação
  App->>EF: invoke(codigo)
  EF->>ANA: Autentica com secrets e consulta cota e vazão
  ANA-->>EF: Nível e vazão mais recentes
  EF-->>App: Nível, vazão e horário da medição
  App-->>U: Exibe o nível (ou "indisponível", se não houver leitura)
```

### 3.4 Ocultar reporte (UC07, RF20, RNF02)

```mermaid
sequenceDiagram
  actor A as Administrador
  participant App as Aplicativo (SPA)
  participant DB as Supabase (PostgreSQL)

  A->>App: Aciona "ocultar reporte" na região
  App->>DB: UPDATE flood_reports SET hidden_at = agora
  DB->>DB: RLS confere se o usuário é administrador
  alt Usuário não é administrador
    DB-->>App: Negado
    App-->>A: Ação não permitida
  else Administrador
    DB->>DB: Gatilho remove 10 pontos do autor (mínimo 0)
    DB-->>App: Reporte ocultado, mas mantido no banco
    App-->>A: O reporte some do mapa
  end
```

### 3.5 Enviar mensagem no chat (UC05, RF12, RNF08)

```mermaid
sequenceDiagram
  actor U1 as Usuário
  participant App1 as Aplicativo do remetente
  participant DB as Supabase (chat_messages + Realtime)
  participant App2 as Aplicativo dos demais usuários

  U1->>App1: Escreve e envia a mensagem
  App1->>DB: INSERT chat_messages (RLS: user_id = usuário)
  DB-->>App1: Mensagem gravada
  DB-->>App2: Evento Realtime com a nova mensagem
  App2-->>App2: Exibe a mensagem na hora
```
