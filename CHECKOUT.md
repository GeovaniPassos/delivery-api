# Bairros, pagamentos e pedidos

## Funcionamento, tempos e notificações

- `GET /api/store-settings`: funcionamento e estimativas; `PATCH /api/store-settings/status` recebe `{isOpen:boolean}` e `PATCH /api/store-settings/estimates` recebe `{deliveryMinutes:number,pickupMinutes:number}`. Minutos inteiros entre 1 e 1440. A primeira inicialização mantém a loja aberta (comportamento anterior) e estimativas vazias; reinícios preservam a configuração.
- `POST /api/orders` bloqueia novos pedidos quando fechada (`409`, código `STORE_CLOSED`). A cotação permanece disponível. A transação de criação usa `READ COMMITTED` e bloqueio compartilhado da configuração: o fechamento e a confirmação são serializados. Pedidos já gravados continuam recuperáveis por idempotência. Cada novo pedido guarda `estimatedMinutes` conforme sua modalidade.
- `GET /api/orders/admin/notifications`: quantidade de pedidos `received`, ainda não aceitos. O sino consulta esse contador e leva à lista de realizados.
- Categorias têm `icon`: `pizza`, `sandwich`, `meal`, `juice`, `drink`, `snack` ou `soda`. O padrão das categorias comuns antigas é `meal`; categorias de pizza usam `pizza`.

Reinicie a API para sincronizar a tabela `store_settings` e as colunas `orders.estimatedMinutes` e `categories.icon`. O estado e os tempos são controles manuais, sem agendamento de horário de funcionamento.

Os módulos `neighborhoods`, `payment-methods` e `orders` seguem a separação por controller, service, DTO e entidade. O projeto utiliza `synchronize: true`: reinicie a API para criar as tabelas `neighborhoods`, `payment_methods` e `orders`.

- `/api/neighborhoods`: GET/POST e PUT/DELETE `/:id`. Nome, taxa de entrega (zero permite entrega grátis) e disponibilidade.
- `/api/payment-methods`: GET/POST e PUT/DELETE `/:id`. Um cadastro por tipo: `cash`, `card` ou `pix`. Pix exige chave e nome do titular; descrição opcional.
- `POST /api/orders/quote`: recebe itens, modo `pickup`/`delivery` e bairro para entrega. Confere disponibilidade no fuso de São Paulo, ingredientes removidos, vínculo/limites dos opcionais, sabores e tamanhos. Calcula preços atuais, promoções, taxa e total no servidor.
- `POST /api/orders`: também recebe `requestId` UUID, cliente, telefone e `expectedTotal`. Entrega exige endereço, pagamento e indicação de troco; CEP é opcional. Retirada não exige endereço nem pagamento. Mudança no total retorna 409 para nova conferência.

A gravação usa transação e snapshots dos itens, endereço, taxa e pagamento. Alterar/excluir os cadastros não modifica pedidos anteriores. Repetir o mesmo `requestId` e conteúdo retorna o pedido já gravado; conteúdo diferente retorna 409.

## Acompanhamento e painel

- Novos pedidos recebem `trackingToken` aleatório de 256 bits, retornado somente na criação/repetição. `GET /api/orders/tracking` exige o header `X-Order-Token` e retorna itens, valores, datas e status, sem contato/endereço completo/pagamento. O navegador persiste essa chave; ela não é exposta na listagem do painel.
- `GET /api/orders/admin?group=placed&page=1`: grupos `placed` (recebidos e aceitos), `preparing`, `waiting` (retirada/entrega) e `completed`. Páginas de 30 pedidos e contadores por grupo.
- `GET /api/orders/admin/:id`: detalhes do pedido para o painel.
- `PATCH /api/orders/admin/:id/advance`: recebe `expectedStatus`. Avança uma etapa com atualização condicional atômica; uma etapa desatualizada retorna 409. Finalizados não avançam. Retirada segue para `ready`, entrega para `out_for_delivery`.
- Fluxo: `received` → `accepted` → `preparing` → `ready`/`out_for_delivery` → `completed`.

Reinicie a API para sincronizar `trackingToken` e `updatedAt`. A coluna de token é nullable para preservar pedidos antigos, que continuam no painel. O projeto atual ainda não possui autenticação/guards administrativos: os endpoints `/admin` seguem essa estrutura e precisam de autenticação antes de exposição pública. A chave de acompanhamento limita a consulta do store, mas não substitui a proteção das rotas administrativas.

Pix e cartão não processam pagamentos automaticamente. Esta etapa registra o método escolhido. Não foi executada gravação de pedido real durante a validação; testes utilizam catálogos e repositórios simulados.

## Combinações de categorias de pizza

`compatibleCategoryIds` em categorias configura vínculos recíprocos entre categorias de pizza com mais de um sabor. A tabela `pizza_category_combinations` guarda pares únicos; os vínculos são removidos nos dois sentidos ao desmarcar ou reduzir a categoria para um sabor. Reinicie a API para o TypeORM carregar/criar a tabela pelo `synchronize` já utilizado no projeto.

Na cotação e confirmação, a categoria inicial define tamanhos, máximo de sabores e preço por média/maior valor. Categorias vinculadas precisam ter tamanho de mesmo nome; IDs de tamanhos continuam próprios de cada categoria. Disponibilidade de cada categoria e sabor continua obrigatória. Os vínculos não são transitivos.

Cada item de `flavors` aceita `optionals: [{groupId,itemId,quantity}]` para adicionais exclusivos daquele sabor. Os limites total e por opção são compartilhados na pizza inteira e os valores são somados integralmente. Bordas continuam em `items[].optionals`, limitadas a uma por pizza e cobradas pelo tamanho da categoria inicial. `items[].observation` aceita até 500 caracteres. Detalhes de sabores, remoções, adicionais e observação são gravados no resumo imutável do pedido para exibição no painel e acompanhamento.
