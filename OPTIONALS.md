# Opcionais — painel e API

## Estrutura

- `src/optionals`: módulo, controller, service, DTOs, entidade e regras de validação.
- `optional_groups`: grupos, categoria, tipo, limites e itens ordenados em JSONB.
- `optional_group_products`: vínculos de um grupo com vários produtos.
- No painel, `features/optionais` separa página, service, modelos, formulário do grupo, editor de itens, formulário individual e lista.
- `/opcionais`: gerais; `/opcionais-pizza`: bordas e adicionais de pizza, com atalhos no sidebar.

## Limites

`maxTotal` limita a soma das unidades do grupo por produto no pedido. `maxPerOption` limita a repetição de cada item. Em ambos, `0` significa ilimitado. Se apenas um limite for zero, o outro continua valendo. Por exemplo: total 5 e por opção 0 permite até 5 unidades, inclusive todas do mesmo item.

Sem quantidade, cada item só pode ser selecionado uma vez (`maxPerOption = 1`). Bordas permitem uma escolha por pizza, com preço por tamanho da categoria. O valor monetário zero representa gratuidade, não quantidade ilimitada.

Nesta etapa são cadastradas as regras. Aplicá-las à seleção e ao cálculo do pedido no store fica para a integração posterior.

## Endpoints

Prefixo `/api/optionals`:

- `GET /`: lista grupos, itens e vínculos.
- `POST /`: cria um grupo.
- `PUT /:id`: substitui os campos editáveis do grupo completo, preservando IDs dos itens existentes. Novos itens omitem o ID.
- `DELETE /:id`: exclui o grupo e seus vínculos com produtos.

Para editar ou excluir um item, o painel envia o grupo completo com a lista atualizada. Nomes duplicados no mesmo grupo são rejeitados. Um grupo pode ficar sem itens e receber novos itens depois.

Os vínculos são validados: gerais usam categorias comuns ou produtos; bordas e adicionais de pizza usam categorias de pizza. Tamanhos com bordas vinculadas não podem ser removidos da categoria.

## Banco e execução

O projeto já utiliza TypeORM com `synchronize: true`. Ao reiniciar a API com este código, ela cria as novas tabelas. Não foi aplicada alteração manual no banco nesta etapa.

Validação local: testes de DTO, regras e services via Jest; compilação TypeScript e metadados TypeORM. No painel, Angular compiler, TypeScript e Sass. A execução do runner Angular pode ser bloqueada pelo ambiente com `spawn EPERM`.
