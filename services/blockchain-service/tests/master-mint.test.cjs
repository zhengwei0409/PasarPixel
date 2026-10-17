const { test } = require('node:test');
const assert = require('node:assert/strict');
const { masterMetadata, mintAuthorization, contentHash } = require('../dist/lib/masterMetadata');
const { createCoreGateway, MintBuildError, DEVNET_GENESIS } = require('../dist/lib/coreMint');
const { createUmi } = require('@metaplex-foundation/umi-bundle-defaults');
const { getCreateV2InstructionDataSerializer, getUpdateV1InstructionDataSerializer, MPL_CORE_PROGRAM_ID } = require('@metaplex-foundation/mpl-core');

test('Master metadata is deterministic, commits to the manifest and excludes account/order/storage internals', () => {
    const source = { title: 'Example', listingRef: 'opaque-ref', manifestHash: 'a'.repeat(64), manifestUri: 'https://example.com/manifest',
        previewUri: 'https://example.com/preview', assetId: 33, sellerId: 99, fileUrl: 'https://private.example/original', email: 'secret@example.com' };
    const first = masterMetadata(source, 'wallet');
    assert.deepEqual(first, masterMetadata(source, 'wallet'));
    assert.equal(contentHash(first.body), first.hash);
    assert.equal(JSON.parse(first.body).contentManifestHash, source.manifestHash);
    assert.ok(!first.body.includes('private.example'));
    assert.ok(!first.body.includes('secret@example.com'));
    assert.ok(!first.body.includes('sellerId'));
    assert.notEqual(first.hash, masterMetadata(source, 'other-wallet').hash);
});

test('mint approvals have unique nonces and commit to domain, wallet, NFT, metadata and expiry', () => {
    const approval = mintAuthorization('http://localhost:5173', 'asset', 'wallet', 'https://metadata.example/hash');
    assert.match(approval.message, /Network: Solana Devnet\nOwner: wallet\nAsset: asset\nMetadata: https:\/\/metadata.example\/hash/);
    assert.ok(approval.message.includes(`Authorization: ${approval.authorizationId}`));
    assert.notEqual(approval.message, mintAuthorization('http://localhost:5173', 'asset', 'wallet', 'https://metadata.example/hash').message);
    assert.ok(approval.expiresAt > new Date());
});

test('the same mint operation derives exactly one NFT signer, distinct from other operations', () => {
    const key = createUmi('http://localhost:1').eddsa.generateKeypair();
    const first = createCoreGateway('http://localhost:1', key.secretKey);
    const restarted = createCoreGateway('http://localhost:1', key.secretKey);
    assert.equal(first.assetAddress('operation-1'), restarted.assetAddress('operation-1'));
    assert.notEqual(first.assetAddress('operation-1'), first.assetAddress('operation-2'));
});

test('Mainnet and truncated chain IDs are rejected before any transaction can be built or sent', async () => {
    const previous = global.fetch;
    const key = createUmi('http://localhost:1').eddsa.generateKeypair();
    try {
        for (const genesis of ['5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp', 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1']) {
            const methods = [];
            global.fetch = async (_input, init) => {
                const { method, id } = JSON.parse(init.body);
                methods.push(method);
                return new Response(JSON.stringify({ jsonrpc: '2.0', id, result: genesis }), { headers: { 'content-type': 'application/json' } });
            };
            const gateway = createCoreGateway('https://rpc.example', key.secretKey);
            await assert.rejects(gateway.build({ assetAddress: gateway.assetAddress('test') }, 'test'), MintBuildError);
            await assert.rejects(gateway.send(new Uint8Array()), MintBuildError);
            assert.ok(methods.every(method => method === 'getGenesisHash'));
        }
    } finally { global.fetch = previous; }
});

test('SDK atomically creates a frozen NFT and removes update authority without the conflicting ImmutableMetadata plugin', async () => {
    const previous = global.fetch;
    const umi = createUmi('https://rpc.example');
    const key = umi.eddsa.generateKeypair();
    let simulatedTransaction;
    const methods = [];
    global.fetch = async (_input, init) => {
        const { method, params, id } = JSON.parse(init.body);
        methods.push(method);
        let result;
        switch (method) {
            case 'getGenesisHash': result = DEVNET_GENESIS; break;
            case 'getLatestBlockhash': result = { context: { slot: 1 }, value: { blockhash: '11111111111111111111111111111111', lastValidBlockHeight: 100 } }; break;
            case 'getBalance': result = { context: { slot: 1 }, value: 1000000000 }; break;
            case 'getFeeForMessage': result = { context: { slot: 1 }, value: 10000 }; break;
            case 'simulateTransaction': simulatedTransaction = params[0]; result = { context: { slot: 1 }, value: { err: null, accounts: [{ lamports: 990000000 }] } }; break;
            default: throw new Error(`Unexpected RPC method ${method}`);
        }
        return new Response(JSON.stringify({ jsonrpc: '2.0', id, result }), { headers: { 'content-type': 'application/json' } });
    };
    try {
        const gateway = createCoreGateway('https://rpc.example', key.secretKey);
        const master = { assetAddress: gateway.assetAddress('op'), ownerAddress: umi.eddsa.generateKeypair().publicKey, name: 'Master', metadataUri: 'https://example.com/nft.json' };
        const signed = await gateway.build(master, 'op');
        assert.equal(Buffer.from(signed.transaction).toString('base64'), simulatedTransaction);
        assert.equal(signed.lastValidBlockHeight, 100n);
        const tx = umi.transactions.deserialize(signed.transaction);
        assert.equal(tx.message.header.numRequiredSignatures, 2);
        assert.ok(tx.signatures.every(signature => signature.some(byte => byte !== 0)));
        const instructions = tx.message.instructions;
        assert.equal(instructions.length, 2);
        assert.ok(instructions.every(instruction => tx.message.accounts[instruction.programIndex] === MPL_CORE_PROGRAM_ID));
        const created = getCreateV2InstructionDataSerializer().deserialize(instructions[0].data)[0];
        assert.equal(created.name, master.name);
        assert.equal(created.uri, master.metadataUri);
        const freeze = created.plugins.value.find(pair => pair.plugin.__kind === 'PermanentFreezeDelegate');
        assert.equal(freeze.plugin.fields[0].frozen, true);
        assert.equal(freeze.authority.value.__kind, 'None');
        // A real Devnet simulation rejects authority removal if ImmutableMetadata
        // is added first. Update authority None supplies metadata immutability.
        assert.equal(created.plugins.value.length, 1);
        const locked = getUpdateV1InstructionDataSerializer().deserialize(instructions[1].data)[0];
        assert.equal(locked.newUpdateAuthority.value.__kind, 'None');
        assert.ok(!methods.includes('sendTransaction'));
        const capped = createCoreGateway('https://rpc.example', key.secretKey, 1n);
        await assert.rejects(capped.build(master, 'op'), /sponsorship limit/);
    } finally { global.fetch = previous; }
});

test('RPC reconciliation never declares success from a signature alone and only unlocks definite failures', async () => {
    const previous = global.fetch;
    const umi = createUmi('https://rpc.example');
    const gateway = createCoreGateway('https://rpc.example', umi.eddsa.generateKeypair().secretKey);
    const master = { assetAddress: gateway.assetAddress('recovery') };
    const attempt = { signature: require('bs58').default.encode(new Uint8Array(64)), lastValidBlockHeight: 100n };
    let status = null, height = 100;
    global.fetch = async (_input, init) => {
        const { method, id } = JSON.parse(init.body);
        let result;
        switch (method) {
            case 'getGenesisHash': result = DEVNET_GENESIS; break;
            case 'getSignatureStatuses': result = { context: { slot: 1 }, value: [status] }; break;
            case 'getAccountInfo': result = { context: { slot: 1 }, value: null }; break;
            case 'getBlockHeight': result = height; break;
            default: throw new Error(`Unexpected RPC method ${method}`);
        }
        return new Response(JSON.stringify({ jsonrpc: '2.0', id, result }), { headers: { 'content-type': 'application/json' } });
    };
    try {
        assert.equal(await gateway.reconcile(master, attempt), 'PENDING');
        height = 101;
        assert.equal(await gateway.reconcile(master, attempt), 'FAILED');
        status = { slot: 1, confirmations: 1, err: null, confirmationStatus: 'confirmed' };
        assert.equal(await gateway.reconcile(master, attempt), 'PENDING');
        status = { slot: 1, confirmations: null, err: null, confirmationStatus: 'finalized' };
        assert.equal(await gateway.reconcile(master, attempt), 'PENDING');
        status.err = { InstructionError: [0, { Custom: 1 }] };
        assert.equal(await gateway.reconcile(master, attempt), 'FAILED');
    } finally { global.fetch = previous; }
});
