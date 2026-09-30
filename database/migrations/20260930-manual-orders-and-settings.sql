-- Upgrade the existing delivery schema without recreating populated columns.
CREATE TABLE IF NOT EXISTS "manual_order_notes" (
  "id" uuid NOT NULL,
  "data" jsonb NOT NULL,
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "PK_505181a300ffa62f119dbe8b630" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "pizzeria_settings" (
  "id" integer NOT NULL,
  "data" jsonb NOT NULL,
  CONSTRAINT "PK_96bc6ae518f4eded16f678a865b" PRIMARY KEY ("id")
);

ALTER TABLE "optional_groups"
  ADD COLUMN IF NOT EXISTS "categoryIds" jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "source" varchar NOT NULL DEFAULT 'online';
ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "dispatchedAt" timestamptz;
ALTER TABLE "orders" ALTER COLUMN "customerName" TYPE varchar(500);
ALTER TABLE "orders" ALTER COLUMN "phone" TYPE text;
ALTER TABLE "payment_methods"
  ADD COLUMN IF NOT EXISTS "name" varchar(120);

-- Cash/card/Pix remain unique; several named "other" methods are now allowed.
-- Discover the legacy constraint by its column, not its generated name.
DO $$
DECLARE legacy_constraint record;
BEGIN
  FOR legacy_constraint IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attname = 'type'
    WHERE c.conrelid = 'payment_methods'::regclass
      AND c.contype = 'u' AND c.conkey = ARRAY[a.attnum]
  LOOP
    EXECUTE format('ALTER TABLE payment_methods DROP CONSTRAINT %I', legacy_constraint.conname);
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "payment_standard_type_unique"
  ON "payment_methods" ("type") WHERE "type" <> 'other';
