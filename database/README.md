# Atualização do banco existente

Execute na pasta da API:

```sh
npm run db:update
```

O comando usa a conexão `DATABASE_*` do `.env`, sem imprimir credenciais. A migração `20260930-manual-orders-and-settings` atualiza o banco anterior do delivery:

- Cria `manual_order_notes` e `pizzeria_settings`.
- Adiciona categorias compartilhadas dos opcionais, origem e horário de saída dos pedidos e nome da forma de pagamento.
- Amplia `orders.customerName` para 500 caracteres e converte `orders.phone` para texto usando `ALTER COLUMN TYPE`, preservando o conteúdo.
- Mantém dinheiro, cartão e Pix únicos e permite várias formas de pagamento do tipo `other`.

As mudanças são executadas em uma transação. Antes de alterar o esquema, o comando bloqueia escritas brevemente e salva uma cópia dos registros existentes em `.tmp/database-backups/`, ignorada pelo Git. A cópia contém dados privados da aplicação: mantenha-a local. Ela é uma cópia dos registros e dos metadados das colunas, não um dump completo do PostgreSQL.

Antes do commit, o comando compara todos os registros e campos anteriores, revertendo a transação se houver diferença. A versão e o checksum ficam em `delivery_schema_versions`; repetir o comando não reaplica uma versão concluída. Não altere o SQL depois de aplicado: futuras alterações devem usar outra migração.

Esta migração requer um banco já existente com as tabelas da versão anterior. Não inicializa um banco vazio. O projeto ainda mantém a configuração de sincronização do TypeORM; aplique esta migração **antes** de iniciar a API atualizada sobre o banco anterior para evitar a recriação automática dos campos de nome e telefone.
