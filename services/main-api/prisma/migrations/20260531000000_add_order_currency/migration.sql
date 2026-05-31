-- The "Currency" enum already exists (created in add_asset_currency_and_sol_price).
-- Existing orders predate the currency selector; default them to USD.
ALTER TABLE "orders" ADD COLUMN "currency" "Currency" NOT NULL DEFAULT 'USD';
