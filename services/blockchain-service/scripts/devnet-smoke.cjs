// Manual SDK smoke test: creates ONE test-only NFT, using only Devnet SOL.
// No marketplace listing/order is created. Repeat only when testing code changes.
require('dotenv/config');
const { readFileSync, writeFileSync } = require('node:fs');
const { randomUUID } = require('node:crypto');
const { createUmi } = require('@metaplex-foundation/umi-bundle-defaults');
const { keypairIdentity } = require('@metaplex-foundation/umi');
const { transfer, burn, safeFetchAssetV1, updateV1, updatePlugin } = require('@metaplex-foundation/mpl-core');
const { createCoreGateway } = require('../dist/services/blockchain-service/src/lib/coreMint');

(async () => {
    const secret = Uint8Array.from(JSON.parse(readFileSync(process.env.PLATFORM_WALLET_FILE || '.secrets/devnet-sponsor.json', 'utf8')));
    const rpc = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    const umi = createUmi(rpc);
    const recovery = process.argv.includes('--resume') ? JSON.parse(readFileSync('.secrets/devnet-smoke-result.json', 'utf8')) : null;
    const owner = recovery ? umi.eddsa.createKeypairFromSecretKey(Uint8Array.from(recovery.ownerSecretKey)) : umi.eddsa.generateKeypair();
    const gateway = createCoreGateway(rpc, secret);
    const reference = randomUUID();
    const master = recovery ? { assetAddress: recovery.assetAddress, ownerAddress: recovery.ownerAddress, name: recovery.name, metadataUri: recovery.metadataUri } : { assetAddress: gateway.assetAddress(reference), ownerAddress: owner.publicKey, name: 'PasarPixel Devnet smoke',
        metadataUri: `data:application/json;base64,${Buffer.from(JSON.stringify({ name: 'PasarPixel Devnet smoke', description: 'SDK integration test only' })).toString('base64')}` };
    const attempt = recovery ? { signature: recovery.signature, lastValidBlockHeight: BigInt(recovery.lastValidBlockHeight), transaction: Uint8Array.from(Buffer.from(recovery.transaction, 'base64')) } : await gateway.build(master, reference);
    // Keep recovery data even if sending or waiting times out.
    if (!recovery) writeFileSync('.secrets/devnet-smoke-result.json', JSON.stringify({ ...master, signature: attempt.signature, ownerSecretKey: Array.from(owner.secretKey),
        lastValidBlockHeight: String(attempt.lastValidBlockHeight), transaction: Buffer.from(attempt.transaction).toString('base64') }), { mode: 0o600 });
    if (!recovery) await gateway.send(attempt.transaction);
    console.log(`${recovery ? 'Checking saved' : 'Submitted'} Devnet smoke mint: ${attempt.signature}`);
    let ready = false;
    for (let i = 0; i < 30; i++) {
        const state = await gateway.reconcile(master, attempt);
        if (state === 'FAILED') throw new Error('Smoke mint failed');
        if (state === 'READY') { ready = true; break; }
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    if (!ready) throw new Error('Still pending; recovery data saved in .secrets/devnet-smoke-result.json');
    umi.use(keypairIdentity(owner));
    const asset = await safeFetchAssetV1(umi, master.assetAddress);
    const rejected = [];
    const sponsor = umi.eddsa.createKeypairFromSecretKey(secret);
    const { createSignerFromKeypair } = require('@metaplex-foundation/umi');
    const sponsorSigner = createSignerFromKeypair(umi, sponsor);
    const operations = [
        ['transfer', () => transfer(umi, { asset, newOwner: umi.eddsa.generateKeypair().publicKey }), [9], /permanent_freeze_delegate.*Reject/],
        ['burn', () => burn(umi, { asset }), [9], /permanent_freeze_delegate.*Reject/],
        ['metadata update', () => updateV1(umi, { asset: asset.publicKey, authority: sponsorSigner, newUri: 'https://example.com/changed.json' }), [9, 20, 26]],
        ['thaw', () => updatePlugin(umi, { asset: asset.publicKey, authority: sponsorSigner, plugin: { type: 'PermanentFreezeDelegate', frozen: false } }), [9, 26]],
    ];
    for (const [name, operation, codes, reason] of operations) {
        // Owner wallet has no funds: use the sponsor as fee payer so failure
        // cannot be attributed to missing fees. Simulate only, never send.
        umi.payer = sponsorSigner;
        const transaction = await operation().buildAndSign(umi);
        const response = await fetch(rpc, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
            jsonrpc: '2.0', id: 1, method: 'simulateTransaction', params: [Buffer.from(umi.transactions.serialize(transaction)).toString('base64'), { encoding: 'base64', sigVerify: true }],
        }), signal: AbortSignal.timeout(15000) });
        const result = await response.json();
        if (!result.result?.value?.err) throw new Error(`${name} was unexpectedly allowed`);
        const instructionError = result.result.value.err.InstructionError;
        if (instructionError?.[0] !== 0 || !codes.includes(instructionError?.[1]?.Custom) ||
            (reason && !result.result.value.logs?.some(log => reason.test(log)))) {
            console.error(JSON.stringify({ operation: name, error: result.result.value.err, logs: result.result.value.logs }));
            throw new Error(`${name} failed for an unexpected reason; use --resume to recheck this NFT`);
        }
        rejected.push(name);
    }
    console.log(JSON.stringify({ status: 'READY', network: 'Solana Devnet', assetAddress: master.assetAddress, owner: master.ownerAddress,
        rejectedOperations: rejected, explorer: `https://explorer.solana.com/address/${master.assetAddress}?cluster=devnet` }));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
