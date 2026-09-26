# Categorias e sabores de pizza

Esta etapa altera apenas a API e o painel. O store será conectado ao novo contrato em uma próxima etapa.

## Categorias

Além de `name` e `active`, a categoria possui:

- `availableDays`: números de 0 (domingo) a 6 (sábado), sem repetição e com ao menos um dia.
- `isPizza`: identifica explicitamente uma categoria de pizzas.
- `pizzaSizes`: lista de `{ id, name }`. A API gera os UUIDs; para renomear um tamanho, envie o ID recebido. Ao adicionar um novo tamanho, omita o ID.
- `maxFlavors`: limite inteiro de 1 a 20 sabores por pizza, nesta categoria.
- `pricingRule`: `highest` (maior valor) ou `average` (média).

Categorias comuns mantêm tamanhos vazios e os dois últimos campos nulos. Categorias existentes recebem todos os dias e `isPizza = false` por padrão, preservando seu funcionamento.

Para evitar perda de informações, categorias com produtos não podem ser convertidas diretamente em categorias de pizza. Primeiro mova esses produtos para uma categoria comum e cadastre os sabores na aba Pizzas. Não há conversão automática de preços antigos em preços por tamanho.

Um tamanho com preços cadastrados pode ser renomeado, mas não removido. Ao adicionar um tamanho a uma categoria já usada, os sabores existentes exibem **Preço pendente** no painel até que sejam editados. A gravação de um sabor exige preços para todos os tamanhos atuais.

## Pizzas

Os sabores são armazenados em `pizzas`, separados de `products`, com `name`, `description`, `photo` (URL HTTP/HTTPS ou null), `categoryId`, `availableDays`, `available` e `prices`.

Cada item de `prices` contém `sizeId`, `price` e `promotionalPrice` (opcional/nulo). Valores são positivos e têm até duas casas decimais; o promocional precisa ser menor que o normal. O tamanho deve pertencer à categoria selecionada.

| Método | Rota (prefixo `/api`) | Uso |
| --- | --- | --- |
| GET / POST | `/pizzas` | Listar / criar sabores |
| GET / PATCH / DELETE | `/pizzas/:id` | Consultar / editar / excluir um sabor |
| PATCH | `/pizzas/:id/availability` | Definir `{ available: false }` para marcar em falta |
| PATCH | `/pizzas/bulk/availability` | Definir `{ ids: [1, 2], available: false }` |
| POST | `/pizzas/bulk/delete` | Excluir `{ ids: [1, 2] }` |

As ações em lote aceitam de 1 a 200 IDs únicos. Atualização e exclusão são transacionais: se qualquer ID não existir, nenhuma alteração do lote é aplicada.

A disponibilidade futura no store deve considerar simultaneamente categoria ativa, sabor disponível e o dia presente nas duas listas de dias. Para uma pizza de vários sabores, a cobrança configurada será aplicada aos preços do mesmo tamanho, usando promoções quando existentes. Esta etapa cadastra essas regras; não altera montagem, carrinho ou checkout do store.

## Banco e validação

O projeto utiliza `synchronize: true` no TypeORM para desenvolvimento. Ao iniciar a API, o TypeORM adiciona os campos da categoria e a tabela de pizzas. Nenhum comando foi executado contra o banco nesta alteração; a validação usou repositórios simulados e dados temporários de interface. Não houve exclusão nem migração automática dos produtos existentes.

Compilação: `node node_modules/@nestjs/cli/bin/nest.js build`.

Testes desta etapa: `node node_modules/jest/bin/jest.js --runInBand --runTestsByPath src/categories/category-rules.spec.ts src/categories/categories.service.spec.ts src/categories/categories.controller.spec.ts src/pizzas/pizzas.service.spec.ts src/pizzas/pizza.dto.spec.ts src/products/products.service.spec.ts`.

A execução da suíte completa também encontrou três falhas anteriores: a mensagem esperada em `app.controller.spec.ts` está desatualizada e os dois testes de usuários não fornecem o `UserRepository`.
