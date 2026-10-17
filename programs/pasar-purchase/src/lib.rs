use anchor_lang::prelude::*;
use anchor_lang::system_program::{self, Transfer};
use mpl_core::{
    instructions::{CreateV2CpiBuilder, UpdateV1CpiBuilder},
    types::{PermanentFreezeDelegate, Plugin, PluginAuthority, PluginAuthorityPair, UpdateAuthority},
    Asset, AuthorityType,
};

declare_id!("2HpUk2sbKNzheHtEYXxiDVF7hPCEE2bZrhzctYhCUdjJ");

#[program]
pub mod pasar_purchase {
    use super::*;

    // Only this deployment's upgrade authority may initialize its configuration.
    pub fn initialize(ctx: Context<Initialize>, treasury: Pubkey) -> Result<()> {
        require!(treasury != Pubkey::default(), PurchaseError::InvalidTreasury);
        ctx.accounts.config.set_inner(Config {
            authority: ctx.accounts.authority.key(), treasury, bump: ctx.bumps.config,
        });
        Ok(())
    }

    pub fn set_listing(ctx: Context<SetListing>, args: ListingArgs) -> Result<()> {
        let master = Asset::from_bytes(&ctx.accounts.master.try_borrow_data()?)
            .map_err(|_| error!(PurchaseError::InvalidMaster))?;
        require!(master.base.owner == args.seller && master.base.update_authority == UpdateAuthority::None,
            PurchaseError::InvalidMaster);
        let freeze = master.plugin_list.permanent_freeze_delegate.as_ref()
            .ok_or(PurchaseError::InvalidMaster)?;
        require!(freeze.permanent_freeze_delegate.frozen && freeze.base.authority.authority_type == AuthorityType::None
            && master.plugin_list.permanent_burn_delegate.is_none()
            && master.plugin_list.permanent_transfer_delegate.is_none(), PurchaseError::InvalidMaster);
        let listing = &mut ctx.accounts.listing;
        if listing.master != Pubkey::default() {
            require_keys_eq!(listing.master, ctx.accounts.master.key(), PurchaseError::InvalidMaster);
            require_keys_eq!(listing.seller, args.seller, PurchaseError::InvalidMaster);
            require!(listing.manifest_hash == args.manifest_hash, PurchaseError::InvalidMaster);
            require!(args.revision >= listing.revision, PurchaseError::StaleListing);
            if args.revision == listing.revision {
                require!(listing.personal == args.personal && listing.commercial == args.commercial
                    && listing.active == args.active, PurchaseError::StaleListing);
                return Ok(());
            }
        }
        listing.set_inner(Listing { master: ctx.accounts.master.key(), seller: args.seller,
            manifest_hash: args.manifest_hash, personal: args.personal, commercial: args.commercial,
            revision: args.revision, active: args.active, bump: ctx.bumps.listing });
        Ok(())
    }

    pub fn purchase(ctx: Context<Purchase>, args: PurchaseArgs) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let listing = &ctx.accounts.listing;
        require!(listing.active, PurchaseError::ListingInactive);
        require!(args.revision == listing.revision, PurchaseError::StaleListing);
        require!(args.expires_at > now && args.expires_at <= now + 300, PurchaseError::Expired);
        require!(args.tier <= 1, PurchaseError::InvalidTier);
        let price = if args.tier == 0 { listing.personal } else { listing.commercial };
        require!(price > 0 && args.price == price, PurchaseError::WrongPrice);
        require!(ctx.accounts.buyer.key() != listing.seller, PurchaseError::SelfPurchase);
        require!(ctx.accounts.buyer.key() != ctx.accounts.config.treasury
            && ctx.accounts.buyer.key() != ctx.accounts.authority.key(), PurchaseError::InvalidTreasury);
        require!(!args.name.is_empty() && args.name.len() <= 128 && args.uri.len() <= 200
            && (args.uri.starts_with("https://") || args.uri.starts_with("http://localhost:")), PurchaseError::InvalidMetadata);
        let commission = split_price(price);
        let buyer = ctx.accounts.buyer.to_account_info();
        let seller = ctx.accounts.seller.to_account_info();
        let treasury = ctx.accounts.treasury.to_account_info();
        let authority = ctx.accounts.authority.to_account_info();
        let core = ctx.accounts.core_program.to_account_info();
        let asset = ctx.accounts.license_asset.to_account_info();
        let system = ctx.accounts.system_program.to_account_info();
        system_program::transfer(CpiContext::new(system.clone(), Transfer { from: buyer.clone(), to: seller }), price - commission)?;
        if commission > 0 {
            system_program::transfer(CpiContext::new(system.clone(), Transfer { from: buyer.clone(), to: treasury }), commission)?;
        }
        CreateV2CpiBuilder::new(&core).asset(&asset).payer(&authority).authority(Some(&authority))
            .owner(Some(&buyer)).system_program(&system).name(args.name).uri(args.uri)
            .plugins(vec![PluginAuthorityPair { plugin: Plugin::PermanentFreezeDelegate(PermanentFreezeDelegate { frozen: true }),
                authority: Some(PluginAuthority::None) }]).invoke()?;
        UpdateV1CpiBuilder::new(&core).asset(&asset).payer(&authority).authority(Some(&authority))
            .system_program(&system).new_update_authority(UpdateAuthority::None).invoke()?;
        ctx.accounts.receipt.set_inner(PurchaseReceipt {
            listing: listing.key(), master: listing.master, license_asset: asset.key(), buyer: buyer.key(),
            seller: listing.seller, treasury: ctx.accounts.config.treasury, tier: args.tier,
            purchase_ref: args.purchase_ref, manifest_hash: listing.manifest_hash, terms_hash: args.terms_hash,
            metadata_hash: args.metadata_hash, price, commission, revision: listing.revision, purchased_at: now,
            bump: ctx.bumps.receipt,
        });
        Ok(())
    }
}

pub fn split_price(price: u64) -> u64 { ((price as u128) * 500 / 10_000) as u64 }

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ListingArgs {
    pub seller: Pubkey, pub manifest_hash: [u8; 32], pub personal: u64, pub commercial: u64,
    pub revision: u64, pub active: bool,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct PurchaseArgs {
    pub tier: u8, pub price: u64, pub revision: u64, pub expires_at: i64,
    pub purchase_ref: [u8; 32], pub terms_hash: [u8; 32], pub metadata_hash: [u8; 32],
    pub name: String, pub uri: String,
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(init, payer = authority, space = 8 + Config::INIT_SPACE, seeds = [b"config"], bump)]
    pub config: Account<'info, Config>,
    #[account(constraint = program.programdata_address()? == Some(program_data.key()))]
    pub program: Program<'info, crate::program::PasarPurchase>,
    #[account(constraint = program_data.upgrade_authority_address == Some(authority.key()))]
    pub program_data: Account<'info, ProgramData>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetListing<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [b"config"], bump = config.bump, has_one = authority)]
    pub config: Account<'info, Config>,
    /// CHECK: Core program ownership and asset data are validated before registration.
    #[account(owner = mpl_core::ID)]
    pub master: UncheckedAccount<'info>,
    #[account(init_if_needed, payer = authority, space = 8 + Listing::INIT_SPACE,
        seeds = [b"listing", master.key().as_ref()], bump)]
    pub listing: Account<'info, Listing>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(args: PurchaseArgs)]
pub struct Purchase<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [b"config"], bump = config.bump, has_one = authority, has_one = treasury)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub buyer: Signer<'info>,
    #[account(seeds = [b"listing", listing.master.as_ref()], bump = listing.bump, has_one = seller)]
    pub listing: Account<'info, Listing>,
    /// CHECK: Address constrained to the seller saved in the authenticated listing.
    #[account(mut)]
    pub seller: UncheckedAccount<'info>,
    /// CHECK: Address constrained to the immutable platform configuration.
    #[account(mut)]
    pub treasury: UncheckedAccount<'info>,
    #[account(init, payer = authority, space = 8 + PurchaseReceipt::INIT_SPACE,
        seeds = [b"receipt", listing.key().as_ref(), buyer.key().as_ref(), &[args.tier]], bump)]
    pub receipt: Account<'info, PurchaseReceipt>,
    #[account(mut)]
    pub license_asset: Signer<'info>,
    /// CHECK: CPI target is fixed to the actual executable Metaplex Core program.
    #[account(address = mpl_core::ID, executable)]
    pub core_program: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct Config { pub authority: Pubkey, pub treasury: Pubkey, pub bump: u8 }

#[account]
#[derive(InitSpace)]
pub struct Listing {
    pub master: Pubkey, pub seller: Pubkey, pub manifest_hash: [u8; 32],
    pub personal: u64, pub commercial: u64, pub revision: u64, pub active: bool, pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct PurchaseReceipt {
    pub listing: Pubkey, pub master: Pubkey, pub license_asset: Pubkey, pub buyer: Pubkey,
    pub seller: Pubkey, pub treasury: Pubkey, pub tier: u8, pub purchase_ref: [u8; 32],
    pub manifest_hash: [u8; 32], pub terms_hash: [u8; 32], pub metadata_hash: [u8; 32],
    pub price: u64, pub commission: u64, pub revision: u64, pub purchased_at: i64, pub bump: u8,
}

#[error_code]
pub enum PurchaseError {
    #[msg("Invalid platform treasury")]
    InvalidTreasury,
    #[msg("Master NFT does not match its immutable seller snapshot")]
    InvalidMaster,
    #[msg("Listing changed; request a new quote")]
    StaleListing,
    #[msg("Listing is not available")]
    ListingInactive,
    #[msg("Purchase quote expired")]
    Expired,
    #[msg("Invalid license tier")]
    InvalidTier,
    #[msg("Price does not match the listing")]
    WrongPrice,
    #[msg("Buying your own listing is not allowed")]
    SelfPurchase,
    #[msg("Invalid immutable license metadata")]
    InvalidMetadata,
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn commission_uses_integer_arithmetic_without_u64_overflow() {
        assert_eq!(split_price(1_000_000_000), 50_000_000);
        assert_eq!(split_price(19), 0);
        assert_eq!(split_price(20), 1);
        assert_eq!(split_price(u64::MAX), (u64::MAX as u128 * 500 / 10_000) as u64);
    }
}
