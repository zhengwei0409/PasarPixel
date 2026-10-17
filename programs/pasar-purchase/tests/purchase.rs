use anchor_lang::{AccountDeserialize, AccountSerialize, InstructionData, ToAccountMetas};
use litesvm::{LiteSVM, types::TransactionResult};
use pasar_purchase::{accounts, instruction, Config, ListingArgs, PurchaseArgs, PurchaseReceipt};
use mpl_core::{instructions::{CreateV2Builder, UpdateV1Builder, TransferV1Builder, BurnV1Builder},
    types::{Plugin, PermanentFreezeDelegate, PluginAuthorityPair, PluginAuthority, UpdateAuthority}, Asset, AuthorityType};
use solana_sdk::{account::Account, clock::Clock, instruction::Instruction, pubkey::Pubkey,
    signature::{Keypair, Signer}, transaction::Transaction, system_program};

fn send(svm: &mut LiteSVM, payer: &Keypair, others: &[&Keypair], ix: Instruction) -> TransactionResult {
    let mut signers = vec![payer];
    for other in others { if other.pubkey() != payer.pubkey() { signers.push(*other); } }
    svm.send_transaction(Transaction::new_signed_with_payer(&[ix], Some(&payer.pubkey()), &signers, svm.latest_blockhash()))
}

struct Fixture { svm: LiteSVM, sponsor: Keypair, buyer: Keypair, seller: Keypair, treasury: Keypair, master: Keypair, config: Pubkey, listing: Pubkey }
impl Fixture {
    fn new() -> Self {
        let mut svm = LiteSVM::new();
        svm.add_program_from_file(mpl_core::ID, std::env::var("MPL_CORE_SO").unwrap_or_else(|_| "../.cache/mpl_core.so".into())).unwrap();
        svm.add_program_from_file(pasar_purchase::ID, std::env::var("PURCHASE_SO").unwrap_or_else(|_| "../target/deploy/pasar_purchase.so".into())).unwrap();
        let sponsor = Keypair::new(); let buyer = Keypair::new(); let seller = Keypair::new(); let treasury = Keypair::new(); let master = Keypair::new();
        for key in [&sponsor, &buyer, &seller, &treasury] { svm.airdrop(&key.pubkey(), 10_000_000_000).unwrap(); }
        let config = Pubkey::find_program_address(&[b"config"], &pasar_purchase::ID).0;
        let bump = Pubkey::find_program_address(&[b"config"], &pasar_purchase::ID).1;
        let mut bytes = Vec::new();
        Config { authority: sponsor.pubkey(), treasury: treasury.pubkey(), bump }.try_serialize(&mut bytes).unwrap();
        svm.set_account(config, Account { lamports: svm.minimum_balance_for_rent_exemption(bytes.len()), data: bytes, owner: pasar_purchase::ID, executable: false, rent_epoch: 0 }).unwrap();
        let create = CreateV2Builder::new().asset(master.pubkey()).payer(sponsor.pubkey()).owner(Some(seller.pubkey()))
            .name("Master".into()).uri("https://example.com/master.json".into())
            .plugins(vec![PluginAuthorityPair { plugin: Plugin::PermanentFreezeDelegate(PermanentFreezeDelegate { frozen: true }), authority: Some(PluginAuthority::None) }]).instruction();
        send(&mut svm, &sponsor, &[&master], create).unwrap();
        let immutable = UpdateV1Builder::new().asset(master.pubkey()).payer(sponsor.pubkey()).new_update_authority(UpdateAuthority::None).instruction();
        send(&mut svm, &sponsor, &[], immutable).unwrap();
        let listing = Pubkey::find_program_address(&[b"listing", master.pubkey().as_ref()], &pasar_purchase::ID).0;
        let mut f = Self { svm, sponsor, buyer, seller, treasury, master, config, listing };
        f.register(1, true).unwrap(); f
    }
    fn register(&mut self, revision: u64, active: bool) -> TransactionResult {
        let ix = Instruction { program_id: pasar_purchase::ID,
            accounts: accounts::SetListing { authority: self.sponsor.pubkey(), config: self.config, master: self.master.pubkey(), listing: self.listing, system_program: system_program::ID }.to_account_metas(None),
            data: instruction::SetListing { args: ListingArgs { seller: self.seller.pubkey(), manifest_hash: [1;32], personal: 1_000_000_000, commercial: 2_000_000_000, revision, active } }.data() };
        send(&mut self.svm, &self.sponsor, &[], ix)
    }
    fn receipt(&self, buyer: Pubkey, tier: u8) -> Pubkey {
        Pubkey::find_program_address(&[b"receipt", self.listing.as_ref(), buyer.as_ref(), &[tier]], &pasar_purchase::ID).0
    }
    fn args(&self, tier: u8) -> PurchaseArgs {
        PurchaseArgs { tier, price: if tier == 0 { 1_000_000_000 } else { 2_000_000_000 }, revision: 1,
            expires_at: self.svm.get_sysvar::<Clock>().unix_timestamp + 90, purchase_ref: [2;32], terms_hash: [3;32], metadata_hash: [4;32],
            name: "License".into(), uri: "https://example.com/license.json".into() }
    }
    fn ix(&self, args: PurchaseArgs, buyer: Pubkey, license: Pubkey, treasury: Pubkey) -> Instruction {
        Instruction { program_id: pasar_purchase::ID,
            accounts: accounts::Purchase { authority: self.sponsor.pubkey(), config: self.config, buyer, listing: self.listing,
                seller: self.seller.pubkey(), treasury, receipt: self.receipt(buyer, args.tier), license_asset: license,
                core_program: mpl_core::ID, system_program: system_program::ID }.to_account_metas(None),
            data: instruction::Purchase { args }.data() }
    }
    fn balances(&self) -> (u64,u64,u64) {
        (self.svm.get_balance(&self.buyer.pubkey()).unwrap(), self.svm.get_balance(&self.seller.pubkey()).unwrap(), self.svm.get_balance(&self.treasury.pubkey()).unwrap())
    }
}

#[test]
fn purchase_splits_payment_and_issues_a_linked_immutable_frozen_license() {
    let mut f = Fixture::new(); let license = Keypair::new(); let before = f.balances();
    let ix = f.ix(f.args(0), f.buyer.pubkey(), license.pubkey(), f.treasury.pubkey());
    send(&mut f.svm, &f.sponsor, &[&f.buyer, &license], ix).unwrap();
    let after = f.balances();
    assert_eq!(before.0-after.0, 1_000_000_000); assert_eq!(after.1-before.1, 950_000_000); assert_eq!(after.2-before.2, 50_000_000);
    let receipt_account = f.svm.get_account(&f.receipt(f.buyer.pubkey(), 0)).unwrap();
    assert_eq!(receipt_account.owner, pasar_purchase::ID);
    let receipt = PurchaseReceipt::try_deserialize(&mut receipt_account.data.as_slice()).unwrap();
    assert_eq!(receipt.master, f.master.pubkey()); assert_eq!(receipt.license_asset, license.pubkey()); assert_eq!(receipt.buyer, f.buyer.pubkey());
    assert_eq!(receipt.manifest_hash, [1;32]); assert_eq!(receipt.terms_hash, [3;32]); assert_eq!(receipt.metadata_hash, [4;32]);
    let asset_account = f.svm.get_account(&license.pubkey()).unwrap();
    assert_eq!(asset_account.owner, mpl_core::ID);
    let asset = Asset::from_bytes(&asset_account.data).unwrap();
    assert_eq!(asset.base.owner, f.buyer.pubkey()); assert_eq!(asset.base.update_authority, UpdateAuthority::None);
    let freeze = asset.plugin_list.permanent_freeze_delegate.unwrap();
    assert!(freeze.permanent_freeze_delegate.frozen); assert_eq!(freeze.base.authority.authority_type, AuthorityType::None);
    let transfer = TransferV1Builder::new().asset(license.pubkey()).payer(f.sponsor.pubkey()).authority(Some(f.buyer.pubkey())).new_owner(f.seller.pubkey()).instruction();
    assert!(send(&mut f.svm, &f.sponsor, &[&f.buyer], transfer).is_err());
    let burn = BurnV1Builder::new().asset(license.pubkey()).payer(f.sponsor.pubkey()).authority(Some(f.buyer.pubkey())).instruction();
    assert!(send(&mut f.svm, &f.sponsor, &[&f.buyer], burn).is_err());
}

#[test]
fn duplicate_purchase_cannot_charge_again_but_another_tier_or_buyer_can_purchase() {
    let mut f = Fixture::new();
    let first = Keypair::new();
    let ix = f.ix(f.args(0), f.buyer.pubkey(), first.pubkey(), f.treasury.pubkey());
    send(&mut f.svm, &f.sponsor, &[&f.buyer,&first], ix).unwrap();
    let before = f.balances(); let duplicate = Keypair::new(); let mut args = f.args(0); args.purchase_ref = [99;32];
    let ix = f.ix(args, f.buyer.pubkey(), duplicate.pubkey(), f.treasury.pubkey());
    assert!(send(&mut f.svm, &f.sponsor, &[&f.buyer,&duplicate], ix).is_err());
    assert_eq!(before, f.balances()); assert!(f.svm.get_account(&duplicate.pubkey()).is_none());
    let commercial = Keypair::new();
    let ix = f.ix(f.args(1), f.buyer.pubkey(), commercial.pubkey(), f.treasury.pubkey());
    send(&mut f.svm, &f.sponsor, &[&f.buyer,&commercial], ix).unwrap();
    let other = Keypair::new(); f.svm.airdrop(&other.pubkey(), 2_000_000_000).unwrap(); let other_license = Keypair::new();
    let ix = f.ix(f.args(0), other.pubkey(), other_license.pubkey(), f.treasury.pubkey());
    send(&mut f.svm, &f.sponsor, &[&other,&other_license], ix).unwrap();
    assert_ne!(f.receipt(other.pubkey(),0), f.receipt(f.buyer.pubkey(),0));
}

#[test]
fn stale_quotes_wrong_prices_expiry_and_wrong_recipients_are_rejected_without_payment() {
    let mut f = Fixture::new();
    for kind in ["price", "revision", "expiry", "future-expiry", "tier", "recipient", "self", "unsigned-buyer", "wrong-platform"] {
        let license = Keypair::new(); let mut args = f.args(0);
        match kind { "price" => args.price = 1, "revision" => args.revision = 0, "expiry" => args.expires_at = 0,
            "future-expiry" => args.expires_at += 1000, "tier" => args.tier = 2, _ => {} }
        let treasury = if kind == "recipient" { f.seller.pubkey() } else { f.treasury.pubkey() };
        let buyer = if kind == "self" { &f.seller } else { &f.buyer };
        let before = f.balances(); let mut ix = f.ix(args, buyer.pubkey(), license.pubkey(), treasury);
        if kind == "wrong-platform" { ix.accounts[0].pubkey = f.treasury.pubkey(); }
        if kind == "unsigned-buyer" {
            let mut tx = Transaction::new_with_payer(&[ix], Some(&f.sponsor.pubkey()));
            tx.partial_sign(&[&f.sponsor,&license], f.svm.latest_blockhash());
            assert!(f.svm.send_transaction(tx).is_err(), "{kind}");
        } else if kind == "wrong-platform" {
            assert!(send(&mut f.svm, &f.treasury, &[buyer,&license], ix).is_err(), "{kind}");
        } else { assert!(send(&mut f.svm, &f.sponsor, &[buyer,&license], ix).is_err(), "{kind}"); }
        // Fee payer is the platform; no purchase amount changes hands.
        let after = f.balances(); assert_eq!(before.0,after.0,"{kind}"); assert_eq!(before.1,after.1,"{kind}");
        if kind != "wrong-platform" { assert_eq!(before.2,after.2,"{kind}"); }
    }
    f.register(2, false).unwrap(); let license = Keypair::new(); let mut args = f.args(0); args.revision = 2;
    let ix = f.ix(args, f.buyer.pubkey(), license.pubkey(), f.treasury.pubkey());
    assert!(send(&mut f.svm, &f.sponsor, &[&f.buyer,&license], ix).is_err());
}

#[test]
fn core_creation_failure_rolls_back_both_sol_transfers_and_receipt_creation() {
    let mut f = Fixture::new(); let license = Keypair::new();
    f.svm.set_account(license.pubkey(), Account { lamports: 1_000_000, data: vec![1;64], owner: system_program::ID, executable: false, rent_epoch: 0 }).unwrap();
    let before = f.balances();
    let ix = f.ix(f.args(0), f.buyer.pubkey(), license.pubkey(), f.treasury.pubkey());
    let result = send(&mut f.svm, &f.sponsor, &[&f.buyer,&license], ix).unwrap_err();
    assert!(result.meta.logs.iter().any(|line| line.contains("CreateV2")), "Core CPI must actually run after the transfers: {:?}", result.meta.logs);
    assert_eq!(before,f.balances()); assert!(f.svm.get_account(&f.receipt(f.buyer.pubkey(),0)).is_none());
}
