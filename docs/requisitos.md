# Requisitos do SustentaSampa

Especificação elaborada na disciplina de Engenharia de Requisitos (padrão ISO/IEC/IEEE 29148). A planilha completa, com stakeholders, elicitação, validação e rastreabilidade, está em [`Engenharia_de_Requisitos_II.xlsx`](Engenharia_de_Requisitos_II.xlsx).

## Necessidades dos usuários

| ID | Necessidade | RF | RNF |
| --- | --- | --- | --- |
| N01 | Saber rapidamente se a região ao redor está em risco de alagamento. | RF06, RF08, RF09, RF10, RF11 | RNF07 |
| N02 | Registrar uma ocorrência de forma rápida, sem processos burocráticos. | RF07, RF08 | RNF03, RNF06 |
| N03 | Confiar na veracidade das informações reportadas por outros usuários. | RF07, RF13, RF20 | RNF02, RNF05, RNF10 |
| N04 | Comunicar-se com vizinhos sobre a situação em tempo real. | RF12, RF13 | RNF08 |
| N05 | Ter acesso rápido a contatos de emergência, já com a localização em mãos. | RF08, RF18, RF19 | — |
| N06 | Sentir-se reconhecido por contribuir com dados úteis à comunidade. | RF14, RF15 | — |
| N07 | Consultar o nível de rios próximos sem precisar acessar outro serviço. | RF16, RF17 | RNF09 |
| N08 | Utilizar a solução tanto pelo navegador quanto instalada no celular. | — | RNF03, RNF04, RNF13 |
| Apoio | Requisitos de suporte: identificação dos usuários, controle de acesso e restrições gerais de operação. | RF01, RF02, RF03, RF04, RF05 | RNF01, RNF11, RNF12 |

## Requisitos funcionais

| ID | Requisito | Prioridade | Status | Critério de aceitação |
| --- | --- | --- | --- | --- |
| RF01 | O sistema deve permitir o cadastro de usuário por e-mail e senha. | Essencial | Especificado | Dado um e-mail válido ainda não cadastrado e uma senha, ao enviar o formulário a conta é criada; com e-mail já cadastrado o sistema exibe erro e não cria outra conta. |
| RF02 | O sistema deve permitir o login por e-mail e senha. | Essencial | Verificado | Com e-mail e senha corretos, o usuário é autenticado e direcionado à tela principal (mapa); com credenciais incorretas, o sistema não concede acesso e exibe mensagem de erro em português. O formulário só é enviado com e-mail em formato válido e senha de no mínimo 6 caracteres. |
| RF03 | O sistema deve permitir login e cadastro via conta Google (OAuth). | Importante | Especificado | Ao escolher entrar com Google e autorizar, o usuário é autenticado, com criação de conta no primeiro acesso. |
| RF04 | O sistema deve permitir a redefinição de senha via link enviado por e-mail. | Importante | Especificado | Ao solicitar a redefinição, um e-mail com link é enviado ao endereço cadastrado; pelo link o usuário define nova senha e consegue fazer login com ela. |
| RF05 | O sistema deve permitir que o usuário encerre sua sessão (logout). | Essencial | Especificado | Ao acionar "sair", a sessão é encerrada e o acesso às telas internas passa a exigir novo login. |
| RF06 | O sistema deve exibir um mapa de calor com os reportes de alagamento agrupados por região. | Essencial | Especificado | O mapa exibe áreas coloridas conforme a concentração de reportes ativos por região; ao enviar um novo reporte, a área correspondente é atualizada. |
| RF07 | O sistema deve permitir o registro de um reporte de alagamento, informando a transitabilidade da via (Transitável, Apenas veículos altos ou Intransitável), o nível da água (Canela, Joelho ou Acima do capô) e uma foto obrigatória do local. | Essencial | Verificado | O envio só é concluído com transitabilidade, nível da água e foto preenchidos; sem foto, o envio não é concluído e nenhum reporte é gravado. Após o envio, o reporte fica associado à localização do usuário (RF08: posição real do aparelho) e ao horário do envio, e o contador da região correspondente é atualizado no mapa sem recarregar a página. O 4º reporte dentro de 1 hora é recusado, com mensagem e cronômetro do tempo restante (RNF05). |
| RF08 | O sistema deve capturar automaticamente a localização (CEP) do usuário para associar ao reporte e à visualização do mapa. | Essencial | Especificado | Ao abrir o mapa ou enviar um reporte, a localização é obtida sem digitação manual: o reporte grava a posição real do aparelho (GPS) e o CEP, usado para agrupar os reportes por região no mapa. |
| RF09 | O sistema deve exibir o nível de risco (Baixo/Médio/Alto/Crítico) do entorno do usuário, calculado a partir dos reportes ativos num raio configurável. | Essencial | Especificado | O aplicativo exibe um dos níveis Baixo, Médio, Alto ou Crítico calculado com os reportes ativos no raio configurado (1 km por padrão); ao mudar a quantidade de reportes no raio, o nível é recalculado. |
| RF10 | O sistema deve destacar visualmente regiões com 10 ou mais reportes ativos como área crítica. | Importante | Especificado | Região com 10 ou mais reportes ativos é destacada como crítica; com 9 ou menos, não é destacada. |
| RF11 | O sistema deve oferecer um Modo Emergência que amplia o raio de cálculo de risco e a frequência de atualização do mapa. | Desejável | Especificado | Ao ativar o Modo Emergência, o raio passa de 1 km para 2,5 km e a atualização do mapa de 60 s para 15 s; ao desativar, os valores originais são restaurados. |
| RF12 | O sistema deve oferecer um chat em tempo real para comunicação entre usuários. | Importante | Especificado | Uma mensagem enviada por um usuário aparece para os demais usuários conectados sem necessidade de recarregar a página. |
| RF13 | O sistema deve permitir que um usuário administrador exclua mensagens do chat. | Desejável | Especificado | O administrador vê a opção de excluir e, ao usá-la, a mensagem é removida definitivamente do chat para todos; o usuário comum não possui essa opção. |
| RF14 | O sistema deve atribuir 10 pontos ao usuário a cada reporte de alagamento enviado com sucesso. | Importante | Verificado | Cada reporte gravado com sucesso soma 10 pontos ao perfil do usuário (ex.: de 0 para 10 pontos no primeiro reporte), e a pontuação atualizada é exibida no cabeçalho do aplicativo. Um envio recusado ou com falha (ex.: limite de 3 reportes por hora) não altera a pontuação. Se um administrador ocultar o reporte, os 10 pontos são removidos do autor (mínimo 0); se o reporte voltar a ficar visível, os pontos são devolvidos. |
| RF15 | O sistema deve permitir a personalização da cor do avatar do usuário, desbloqueada conforme a pontuação acumulada. | Desejável | Especificado | Cada cor só fica selecionável ao atingir seu marco (0, 50, 150, 300, 500 ou 1000 pontos); a cor escolhida é exibida no avatar e permanece desbloqueada. |
| RF16 | O sistema deve exibir o nível atual dos rios mais próximos da localização do usuário. | Desejável | Especificado | O aplicativo lista o nível atual dos rios/estações mais próximos da localização do usuário com dados da ANA; quando a estação não tem leitura, informa que o dado está indisponível. |
| RF17 | O sistema deve permitir a busca de estações de monitoramento de rios por nome, bacia ou município. | Desejável | Especificado | A busca por nome, bacia ou município retorna as estações correspondentes; sem correspondência, exibe mensagem informando que nada foi encontrado. |
| RF18 | O sistema deve oferecer um botão de emergência (SOS) com discagem direta para Defesa Civil e Corpo de Bombeiros. | Importante | Especificado | Ao tocar no botão SOS, o usuário consegue iniciar a ligação para a Defesa Civil (199) ou para o Corpo de Bombeiros (193) com um único toque de confirmação. |
| RF19 | O sistema deve permitir o compartilhamento da localização do usuário por SMS para um contato de confiança. | Desejável | Especificado | Ao acionar o compartilhamento, é aberta uma mensagem SMS para o contato de confiança já contendo a localização do usuário. |
| RF20 | O sistema deve permitir que um usuário administrador oculte reportes da visualização do mapa sem excluí-los do banco de dados. | Desejável | Especificado | Um reporte ocultado por administrador deixa de aparecer no mapa e continua armazenado no banco de dados. |

## Requisitos não funcionais

| ID | Requisito | Prioridade | Status | Critério de aceitação |
| --- | --- | --- | --- | --- |
| RNF01 | O sistema deve exigir autenticação do usuário para acesso a qualquer funcionalidade além do login. | Essencial | Especificado | Sem sessão ativa, qualquer tela além do login redireciona o usuário para a tela de login. |
| RNF02 | O sistema deve restringir ações administrativas (moderação de reportes e chat) a usuários com papel de administrador, aplicado no nível do banco de dados (RLS). | Essencial | Especificado | Um usuário comum que tenta ocultar reporte ou excluir mensagem é impedido pelo banco de dados (RLS); o administrador consegue realizar as ações. |
| RNF03 | A interface deve ser responsiva, adaptada prioritariamente a telas de smartphone. | Essencial | Especificado | Todas as telas são utilizáveis em largura de smartphone (ex.: 360 px) sem rolagem horizontal e sem elementos cortados. |
| RNF04 | O sistema deve estar disponível como aplicativo instalável para Android, além da versão web. | Importante | Especificado | O aplicativo pode ser instalado em dispositivo Android e executa as funções principais; a versão web também permanece acessível pelo navegador. |
| RNF05 | O sistema deve limitar o envio de reportes a no máximo 3 por usuário a cada 1 hora, para evitar abuso da pontuação e poluição de dados. | Importante | Especificado | O 4º reporte enviado dentro de 1 hora é bloqueado; o usuário vê a mensagem de limite atingido e um cronômetro com o tempo restante, e o envio volta a ser permitido quando esse tempo termina (1 hora após o reporte mais antigo da janela). |
| RNF06 | As fotos anexadas a um reporte devem ser comprimidas no dispositivo do usuário antes do envio, para reduzir consumo de dados. | Desejável | Especificado | A foto enviada tem tamanho menor que o arquivo original, pois a compressão ocorre no dispositivo antes do upload. |
| RNF07 | O mapa de calor deve ser atualizado automaticamente em intervalos curtos (60s em uso normal, 15s em Modo Emergência). | Importante | Especificado | O mapa se atualiza sozinho a cada 60 s em uso normal e a cada 15 s em Modo Emergência, sem ação do usuário. |
| RNF08 | As mensagens do chat devem ser entregues em tempo real a todos os usuários conectados, via conexão WebSocket. | Importante | Especificado | Com dois usuários conectados, a mensagem enviada por um aparece para o outro em tempo real, sem recarregar a página. |
| RNF09 | Credenciais de serviços externos (ex.: API da ANA) não devem, em nenhuma hipótese, ser expostas no código do cliente. | Essencial | Especificado | Nenhuma credencial da ANA é encontrada no código do cliente nem nas requisições visíveis ao navegador; o acesso é feito por camada segura no servidor. |
| RNF10 | Reportes com mais de 24 horas devem deixar de ser exibidos no mapa automaticamente, permanecendo arquivados no banco de dados. | Importante | Especificado | Um reporte com mais de 24 horas não aparece no mapa, mas continua armazenado no banco de dados. |
| RNF11 | A interface deve ser apresentada em português, com tema escuro de alto contraste. | Desejável | Especificado | Todos os textos da interface estão em português e o tema escuro de alto contraste é aplicado em todas as telas. |
| RNF12 | O sistema deve operar em infraestrutura de nuvem gerenciada, sem necessidade de servidor próprio. | Desejável | Especificado | O sistema roda em produção em infraestrutura de nuvem gerenciada, sem servidor próprio mantido pela equipe. |
| RNF13 | O sistema deve ser compatível com os navegadores modernos mais utilizados (baseados em Chromium e WebKit). | Importante | Especificado | As funcionalidades principais funcionam nas versões atuais de navegadores Chromium (ex.: Chrome, Edge) e WebKit (ex.: Safari). |

**Status:** *Especificado* (descrito e com critério de aceitação) · *Verificado* (revisado na validação, aba `06_Validação` da planilha).

RF02, RF07 e RF14 foram verificados com a equipe e com o Product Owner; os ajustes decorrentes (mensagens de erro em português, remoção de pontos ao ocultar reporte, limite de reportes com cronômetro e posição real por GPS) já estão implementados.
