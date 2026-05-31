-- The "Currency" enum already exists (created in add_asset_currency_and_sol_price).
-- Default existing profiles to MYR (the target market's currency).
ALTER TABLE "user_profiles" ADD COLUMN "preferredCurrency" "Currency" NOT NULL DEFAULT 'MYR';
