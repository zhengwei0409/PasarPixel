const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Keypair, Transaction } = require('@solana/web3.js');
const { createPurchaseGateway } = require('../dist/services/blockchain-service/src/lib/purchaseGateway');
const { purchaseInstruction, PURCHASE_PROGRAM_ID } = require('../dist/services/blockchain-service/src/lib/purchaseProtocol');
const { DEVNET_GENESIS } = require('../dist/services/blockchain-service/src/lib/coreMint');
function fixture() {
    const sponsor=Keypair.generate(),buyer=Keypair.generate(),seller=Keypair.generate(),asset=Keypair.generate();
    const gateway=createPurchaseGateway('http://127.0.0.1:1',sponsor.secretKey),master=Keypair.generate().publicKey.toBase58();
    const addresses=gateway.addresses(master,buyer.publicKey.toBase58(),0);
    const record={id:'test-reference',assetAddress:asset.publicKey.toBase58(),buyerAddress:buyer.publicKey.toBase58(),sellerAddress:seller.publicKey.toBase58(),listingAddress:addresses.listing,receiptAddress:addresses.receipt,priceLamports:10_000_000n,commissionLamports:500_000n,revision:1n,licenseType:'PERSONAL',name:'License',metadataUri:'https://example.com/nft',metadataHash:'a'.repeat(64),manifestHash:'b'.repeat(64),termsHash:'c'.repeat(64),expiresAt:new Date(Date.now()+90_000)};
    const tx=new Transaction({feePayer:sponsor.publicKey,recentBlockhash:Keypair.generate().publicKey.toBase58()}).add(purchaseInstruction(PURCHASE_PROGRAM_ID,sponsor.publicKey,sponsor.publicKey,record));tx.partialSign(asset);
    return {sponsor,buyer,gateway,record,tx,draft:tx.serialize({requireAllSignatures:false})};
}
async function genesis(value,work){const original=global.fetch;const methods=[];global.fetch=async(_url,init)=>{const request=JSON.parse(init.body);methods.push(request.method);assert.equal(request.method,'getGenesisHash');return new Response(JSON.stringify({jsonrpc:'2.0',id:request.id,result:value}),{headers:{'content-type':'application/json'}});};try{await work(methods);}finally{global.fetch=original;}}
test('platform co-signs only the original message with a real bound-buyer Ed25519 signature',async()=>genesis(DEVNET_GENESIS,async()=>{
    const f=fixture();f.tx.partialSign(f.buyer);const result=await f.gateway.sign(f.record,f.draft,f.tx.serialize({requireAllSignatures:false}));
    const full=Transaction.from(result.transaction);assert.equal(full.verifySignatures(),true);assert.ok(full.serializeMessage().equals(f.tx.serializeMessage()));
    assert.ok(full.signatures.find(s=>s.publicKey.equals(f.sponsor.publicKey)).signature);
}));
test('changed recipients, missing buyer and forged buyer signatures never receive the sponsor signature',async()=>genesis(DEVNET_GENESIS,async()=>{
    for(const change of [f=>{f.tx.instructions[0].keys[4].pubkey=Keypair.generate().publicKey;},f=>{},f=>{f.tx.addSignature(f.buyer.publicKey,Buffer.alloc(64,1));}]){
        const f=fixture();change(f);await assert.rejects(f.gateway.sign(f.record,f.draft,f.tx.serialize({requireAllSignatures:false,verifySignatures:false})),/modified|must sign|invalid/);
    }
}));
test('full Devnet genesis is required before building, signing, sending or reconciling purchases',async()=>{
    for(const chain of ['5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp','EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZB'])await genesis(chain,async methods=>{
        const f=fixture();for(const op of [()=>f.gateway.build(f.record),()=>f.gateway.sign(f.record,f.draft,f.draft),()=>f.gateway.send(f.draft),()=>f.gateway.reconcile(f.record,'unused',{})])await assert.rejects(op(),/restricted to Solana Devnet/);
        assert.equal(methods.length,4);
    });
});
