# Bairros, pagamentos e pedidos

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
