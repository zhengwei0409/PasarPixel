const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');
const { Keypair, PublicKey, Transaction, TransactionInstruction, SystemProgram } = require('@solana/web3.js');
const code = ts.transpileModule(readFileSync(join(__dirname,'../src/lib/solPurchase.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
function fixture() {
    const sponsor=Keypair.generate(),buyer=Keypair.generate(),seller=Keypair.generate(),asset=Keypair.generate(),master=Keypair.generate();
    const program=new PublicKey('2HpUk2sbKNzheHtEYXxiDVF7hPCEE2bZrhzctYhCUdjJ');
    const listing=PublicKey.findProgramAddressSync([Buffer.from('listing'),master.publicKey.toBuffer()],program)[0];
    const receipt=PublicKey.findProgramAddressSync([Buffer.from('receipt'),listing.toBuffer(),buyer.publicKey.toBuffer(),Buffer.from([0])],program)[0];
    const config=PublicKey.findProgramAddressSync([Buffer.from('config')],program)[0];
    const expiry=new Date(Date.now()+90_000),data=Buffer.alloc(137);
    Buffer.from([21,93,113,154,193,160,242,168]).copy(data);data.writeBigUInt64LE(10_000_000n,9);data.writeBigUInt64LE(1n,17);data.writeBigInt64LE(BigInt(Math.floor(expiry.getTime()/1000)),25);
    Buffer.from('a'.repeat(64),'hex').copy(data,65);Buffer.from('b'.repeat(64),'hex').copy(data,97);
    const keys=[sponsor.publicKey,config,buyer.publicKey,listing,seller.publicKey,sponsor.publicKey,receipt,asset.publicKey,new PublicKey('CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d'),SystemProgram.programId];
    const tx=new Transaction({feePayer:sponsor.publicKey,recentBlockhash:Keypair.generate().publicKey.toBase58()}).add(new TransactionInstruction({programId:program,keys:keys.map((pubkey,i)=>({pubkey,isSigner:[0,2,7].includes(i),isWritable:[0,2,4,5,6,7].includes(i)})),data}));
    tx.partialSign(asset);
    const quote={id:'reference',status:'AWAITING_SIGNATURE',programId:program.toBase58(),licenseType:'PERSONAL',buyerAddress:buyer.publicKey.toBase58(),sellerAddress:seller.publicKey.toBase58(),sponsorAddress:sponsor.publicKey.toBase58(),treasuryAddress:sponsor.publicKey.toBase58(),listingAddress:listing.toBase58(),receiptAddress:receipt.toBase58(),assetAddress:asset.publicKey.toBase58(),priceLamports:'10000000',revision:'1',termsHash:'a'.repeat(64),metadataHash:'b'.repeat(64),expiresAt:expiry.toISOString(),transaction:tx.serialize({requireAllSignatures:false}).toString('base64')};
    const expected={masterAddress:master.publicKey.toBase58(),priceLamports:quote.priceLamports,licenseType:quote.licenseType,termsHash:quote.termsHash};
    const state={address:quote.buyerAddress,session:true,calls:0};
    const provider={isConnected:true,publicKey:buyer.publicKey,signTransaction:async tx=>{state.calls++;tx.partialSign(buyer);return tx;}};
    const exports={};runInNewContext(code,{exports,Buffer,Date,require:name=>name==='./phantom'?{getConnectedAddress:()=>state.address}:require(name)});
    return {quote,expected,state,provider,buyer,sponsor,seller,asset,tx,sign:()=>exports.signSolPurchase(provider,quote,expected,()=>{if(!state.session)throw new Error('Session changed');})};
}
test('Phantom signs only the verified bound-wallet purchase and preserves the exact message',async()=>{
    const f=fixture(),signed=Transaction.from(Buffer.from(await f.sign(),'base64'));
    assert.ok(signed.serializeMessage().equals(f.tx.serializeMessage()));assert.equal(signed.verifySignatures(false),true);assert.equal(f.state.calls,1);
    assert.ok(signed.signatures.find(s=>s.publicKey.equals(f.buyer.publicKey)).signature);
});
test('changed quotes, expired approvals, wallet mismatches and tampered recipients fail before Phantom opens',async()=>{
    for(const change of [f=>{f.quote.priceLamports='1';},f=>{f.quote.termsHash='c'.repeat(64);},f=>{f.quote.expiresAt=new Date(0).toISOString();},f=>{f.state.address=Keypair.generate().publicKey.toBase58();},f=>{f.quote.programId=Keypair.generate().publicKey.toBase58();},f=>{f.tx.instructions[0].keys[4].pubkey=Keypair.generate().publicKey;f.quote.transaction=f.tx.serialize({requireAllSignatures:false,verifySignatures:false}).toString('base64');},f=>{f.quote.expiresAt=new Date(Date.now()+120_000).toISOString();}]){
        const f=fixture();change(f);await assert.rejects(f.sign());assert.equal(f.state.calls,0);
    }
});
test('account or wallet switches and extension message changes during signing cannot be submitted',async()=>{
    for(const change of [f=>{f.state.session=false;},f=>{f.state.address=null;},f=>{f.tx.instructions[0].data[9]=0;}]){
        const f=fixture();f.provider.signTransaction=async tx=>{change(f);if(f.state.session&&f.state.address)tx.instructions[0].data[9]=0;tx.partialSign(f.buyer);return tx;};await assert.rejects(f.sign());
    }
});

test('platform-funded recipient rent top-ups are allowed without changing the buyer payment',async()=>{
    for (const separateTreasury of [false, true]) {
    const f=fixture();f.tx.instructions.unshift(SystemProgram.transfer({fromPubkey:f.sponsor.publicKey,toPubkey:f.seller.publicKey,lamports:555240n}));
    if (separateTreasury) {
        const treasury = Keypair.generate().publicKey;
        f.quote.treasuryAddress = treasury.toBase58(); f.tx.instructions.at(-1).keys[5].pubkey = treasury;
        f.tx.instructions.unshift(SystemProgram.transfer({fromPubkey:f.sponsor.publicKey,toPubkey:treasury,lamports:645240n}));
    }
    f.tx.partialSign(f.asset);f.quote.transaction=f.tx.serialize({requireAllSignatures:false}).toString('base64');
    const signed=Transaction.from(Buffer.from(await f.sign(),'base64'));
    assert.equal(signed.instructions.length,separateTreasury?3:2);assert.ok(signed.serializeMessage().equals(f.tx.serializeMessage()));assert.equal(f.state.calls,1);
    }
});

test('rent top-ups cannot debit the buyer, change recipients, exceed the cap or repeat a recipient',async()=>{
    for(const instructions of [f=>[SystemProgram.transfer({fromPubkey:f.buyer.publicKey,toPubkey:f.seller.publicKey,lamports:1})],f=>[SystemProgram.transfer({fromPubkey:f.sponsor.publicKey,toPubkey:Keypair.generate().publicKey,lamports:1})],f=>[SystemProgram.transfer({fromPubkey:f.sponsor.publicKey,toPubkey:f.seller.publicKey,lamports:30000001})],f=>[1,2].map(()=>SystemProgram.transfer({fromPubkey:f.sponsor.publicKey,toPubkey:f.seller.publicKey,lamports:1}))]){
        const f=fixture();f.tx.instructions.unshift(...instructions(f));f.quote.transaction=f.tx.serialize({requireAllSignatures:false,verifySignatures:false}).toString('base64');await assert.rejects(f.sign(),/does not match/);assert.equal(f.state.calls,0);
    }
});
