-- Legacy defaults were written by PostgreSQL in UTC, without a time zone.
-- Preserve their instant, rather than interpreting the stored hour as local time.
SET LOCAL TIME ZONE 'UTC';

DO $$
DECLARE
  target record;
  instant_expression text;
  invalid_rows boolean;
BEGIN
  FOR target IN SELECT * FROM (VALUES
    ('orders', 'createdAt'), ('orders', 'updatedAt'),
    ('manual_order_notes', 'updatedAt'), ('store_settings', 'updatedAt')
  ) AS columns_to_upgrade(table_name, column_name)
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema = current_schema() AND c.table_name = target.table_name
        AND c.column_name = target.column_name AND c.data_type = 'timestamp without time zone'
    ) THEN
      instant_expression := format('t.%I AT TIME ZONE ''UTC''', target.column_name);
      IF target.table_name = 'orders' AND target.column_name = 'createdAt' THEN
        -- Manual orders have an authoritative ISO timestamp captured in the browser.
        -- It must not receive the conversion for database-generated timestamps.
        IF EXISTS (
          SELECT 1 FROM orders o LEFT JOIN manual_order_notes n ON n.id = o."requestId"
          WHERE o.source = 'manual' AND COALESCE(n.data->>'createdAt', '') !~ '(Z|[+-][0-9]{2}:[0-9]{2})$'
        ) THEN
          RAISE EXCEPTION 'Pedido manual sem data original com fuso; revise antes de migrar.';
        END IF;
        instant_expression := 'CASE WHEN t.source = ''manual'' THEN
          (SELECT (n.data->>''createdAt'')::timestamptz FROM manual_order_notes n WHERE n.id = t."requestId")
          ELSE t."createdAt" AT TIME ZONE ''UTC'' END';
      END IF;

      EXECUTE format('CREATE TEMP TABLE timestamp_upgrade_before ON COMMIT DROP AS
        SELECT t.id, to_jsonb(t) - %L AS unchanged_data, extract(epoch FROM (%s)) AS expected_instant FROM %I t',
        target.column_name, instant_expression, target.table_name);

      IF target.table_name = 'orders' AND target.column_name = 'createdAt' THEN
        UPDATE orders o SET "createdAt" = (n.data->>'createdAt')::timestamptz AT TIME ZONE 'UTC'
        FROM manual_order_notes n WHERE o.source = 'manual' AND n.id = o."requestId";
      END IF;

      EXECUTE format('ALTER TABLE %I ALTER COLUMN %I TYPE timestamptz USING %I AT TIME ZONE ''UTC''',
        target.table_name, target.column_name, target.column_name);

      EXECUTE format('SELECT EXISTS (
        SELECT 1 FROM timestamp_upgrade_before b FULL JOIN %I t ON t.id = b.id
        WHERE b.id IS NULL OR t.id IS NULL
          OR (to_jsonb(t) - %L) IS DISTINCT FROM b.unchanged_data
          OR extract(epoch FROM t.%I) IS DISTINCT FROM b.expected_instant)',
        target.table_name, target.column_name, target.column_name) INTO invalid_rows;
      IF invalid_rows THEN
        RAISE EXCEPTION 'Falha ao preservar registros e instantes em %.%', target.table_name, target.column_name;
      END IF;
      DROP TABLE timestamp_upgrade_before;
    END IF;
  END LOOP;
END $$;
