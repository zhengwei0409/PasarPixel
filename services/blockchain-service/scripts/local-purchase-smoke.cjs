// Disposable local validator only: no real wallet or Devnet funds are used.
const { spawn } = require('node:child_process');
const { mkdtempSync, writeFileSync, existsSync, createWriteStream, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { resolve, join } = require('node:path');
const { randomUUID, createHmac } = require('node:crypto');
const assert = require('node:assert/strict');
const { Connection, Keypair, Transaction } = require('@solana/web3.js');
const { createPurchaseGateway } = require('../dist/services/blockchain-service/src/lib/purchaseGateway');
const { createCoreGateway, DEVNET_GENESIS } = require('../dist/services/blockchain-service/src/lib/coreMint');
const { PURCHASE_PROGRAM_ID, CORE_PROGRAM_ID } = require('../dist/services/blockchain-service/src/lib/purchaseProtocol');
const root = resolve(__dirname, '../../..');
const core = process.env.CORE_PROGRAM_FILE || join(root, 'programs/.cache/mpl_core.so');
const program = join(root, 'programs/target/deploy/pasar_purchase.so');
if (!existsSync(core) || !existsSync(program)) throw new Error('Build the purchase program and download the Core fixture first (see docs/BlockchainDesign.md).');
const scratch = mkdtempSync(join(tmpdir(), 'pasarpixel-local-purchase-'));
const sponsor = Keypair.generate(), buyer = Keypair.generate(), seller = Keypair.generate(), treasury = Keypair.generate();
const sponsorFile = join(scratch, 'ephemeral-sponsor.json');
writeFileSync(sponsorFile, JSON.stringify([...sponsor.secretKey]), { mode: 0o600 });
const rpcPort = Number(process.env.LOCAL_SOLANA_RPC_PORT || 18899), rpc = `http://127.0.0.1:${rpcPort}`;
const log = createWriteStream(join(scratch, 'validator.log'));
const validator = spawn(process.env.SOLANA_TEST_VALIDATOR || 'solana-test-validator', [
    '--ledger', join(scratch, 'ledger'), '--reset', '--quiet', '--rpc-port', String(rpcPort), '--faucet-port', String(rpcPort + 2),
    '--gossip-port', String(rpcPort + 3), '--dynamic-port-range', `${rpcPort + 4}-${rpcPort + 40}`,
    '--mint', sponsor.publicKey.toBase58(), '--bpf-program', CORE_PROGRAM_ID.toBase58(), core,
    '--upgradeable-program', PURCHASE_PROGRAM_ID.toBase58(), program, sponsorFile,
], { stdio: ['ignore', 'pipe', 'pipe'] });
validator.stdout.pipe(log); validator.stderr.pipe(log);
let startupError; validator.on('error', error => { startupError = error; });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const emptyRecipients = process.argv.includes('--empty-recipients');
const realFetch = global.fetch;
// TEST FIXTURE ONLY: emulate Devnet genesis for the production gateways.
// All other RPC calls execute on the actual disposable local validator.
// Production always checks the real full Devnet genesis hash.
global.fetch = async (input, init) => {
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    if (String(input).startsWith(rpc) && body?.method === 'getGenesisHash') return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: DEVNET_GENESIS }), { headers: { 'content-type': 'application/json' } });
    return realFetch(input, init);
};
async function main() {
    const connection = new Connection(rpc, 'finalized');
    for (let i = 0; ; i++) {
        if (startupError) throw startupError;
        if (validator.exitCode !== null) throw new Error(`Local validator exited: see ${join(scratch, 'validator.log')}`);
        try { await connection.getVersion(); break; } catch (error) { if (i >= 60) throw error; await sleep(500); }
    }
    console.log('Local validator ready. All wallets are ephemeral test fixtures.');
    await Promise.all((emptyRecipients ? [buyer] : [buyer, seller, treasury]).map(async wallet => {
        const signature = await connection.requestAirdrop(wallet.publicKey, 2_000_000_000);
        await connection.confirmTransaction(signature, 'finalized');
    }));
    const masterGateway = createCoreGateway(rpc, sponsor.secretKey), reference = randomUUID();
    const master = { assetAddress: masterGateway.assetAddress(reference), ownerAddress: seller.publicKey.toBase58(), name: 'Local Master', metadataUri: 'https://example.com/master.json' };
    const mint = await masterGateway.build(master, reference); await masterGateway.send(mint.transaction);
    for (let i = 0; await masterGateway.reconcile(master, mint) !== 'READY'; i++) { if(i > 80) throw new Error('Master not finalized'); await sleep(500); }
    console.log('Actual Core Master created, frozen and finalized.');
    const gateway = createPurchaseGateway(rpc, sponsor.secretKey, PURCHASE_PROGRAM_ID, treasury.publicKey.toBase58());
    const price = emptyRecipients ? 100_000n : 10_000_000n;
    const commission = price * 500n / 10_000n;
    const listing = { master: master.assetAddress, seller: seller.publicKey.toBase58(), manifestHash: 'a'.repeat(64), personal: price, commercial: price * 2n, active: true };
    const revision = await gateway.syncListing(listing); assert.equal(revision, 1n); assert.equal(await gateway.syncListing(listing), 1n);
    console.log('Config initialized using upgrade authority; Master listing registered.');
    const id = randomUUID(), addresses = gateway.addresses(master.assetAddress, buyer.publicKey.toBase58(), 0);
    const record = { id, assetAddress: gateway.assetAddress(id), buyerAddress: buyer.publicKey.toBase58(), sellerAddress: seller.publicKey.toBase58(),
        listingAddress: addresses.listing, receiptAddress: addresses.receipt, priceLamports: price, commissionLamports: commission,
        revision, licenseType: 'PERSONAL', name: 'Local License', metadataUri: 'https://example.com/license.json',
        metadataHash: 'b'.repeat(64), manifestHash: listing.manifestHash, termsHash: 'c'.repeat(64), expiresAt: new Date(Date.now() + 90_000) };
    const draft = await gateway.build(record), partial = Transaction.from(draft.transaction);
    assert.equal(partial.signatures.find(s => s.publicKey.equals(sponsor.publicKey)).signature, null); partial.partialSign(buyer);
    const signed = await gateway.sign(record, draft.transaction, partial.serialize({ requireAllSignatures: false })); signed.lastValidBlockHeight = draft.lastValidBlockHeight;
    assert.equal(Transaction.from(signed.transaction).verifySignatures(), true);
    const before = await Promise.all([buyer, seller, treasury].map(k => connection.getBalance(k.publicKey, 'finalized')));
    if (emptyRecipients) {
        assert.equal(partial.instructions.length, 3);
        // Execute a deliberately invalid local purchase with the same sponsored
        // top-ups. All recipient credits must roll back when the contract rejects it.
        const invalid = Transaction.from(draft.transaction);
        invalid.instructions.at(-1).data.writeBigUInt64LE(price + 1n, 9);
        const assetSigner = Keypair.fromSeed(createHmac('sha256', sponsor.secretKey).update(`pasarpixel:license:${id}`).digest());
        invalid.sign(sponsor, buyer, assetSigner);
        const failedSignature = await connection.sendRawTransaction(invalid.serialize(), { skipPreflight: true });
        assert.ok((await connection.confirmTransaction(failedSignature, 'finalized')).value.err);
        assert.deepEqual(await Promise.all([buyer, seller, treasury].map(k => connection.getBalance(k.publicKey, 'finalized'))), before);
        assert.equal(await connection.getAccountInfo(new (require('@solana/web3.js').PublicKey)(record.receiptAddress)), null);
        console.log('Rejected purchase rolled back both sponsored recipient top-ups.');
    }
    await gateway.send(signed.transaction);
    for (let i = 0; ; i++) { const state = await gateway.reconcile(record, master.assetAddress, signed); if (state === 'CONFIRMED') break; if (state === 'FAILED' || i > 80) throw new Error(`Purchase ${state}`); await sleep(500); }
    const after = await Promise.all([buyer, seller, treasury].map(k => connection.getBalance(k.publicKey, 'finalized')));
    const minimum = await connection.getMinimumBalanceForRentExemption(0);
    assert.equal(before[0] - after[0], Number(price));
    assert.equal(after[1] - before[1], Math.max(Number(price - commission), minimum - before[1]));
    assert.equal(after[2] - before[2], Math.max(Number(commission), minimum - before[2]));
    try { await gateway.send(signed.transaction); } catch (error) { assert.match(error.message, /already been processed/); }
    assert.equal(await gateway.reconcile(record, master.assetAddress, { ...signed, status: 'CONFIRMED' }), 'CONFIRMED');
    assert.deepEqual(await Promise.all([buyer, seller, treasury].map(k => connection.getBalance(k.publicKey, 'finalized'))), after);
    console.log(`PASS: buyer pays exactly ${price} lamports, 95/5 proceeds plus necessary sponsored recipient rent, immutable License, matching receipt and safe rebroadcast.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
    global.fetch = realFetch; validator.kill('SIGTERM');
    if (validator.exitCode === null && !startupError) await Promise.race([new Promise(resolve => validator.once('exit', resolve)), sleep(5_000)]);
    if (validator.exitCode === null) validator.kill('SIGKILL'); log.end();
    if (!process.exitCode) rmSync(scratch, { recursive: true, force: true }); else console.error(`Local test logs: ${scratch}`);
});
