const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Keypair, Transaction, SystemProgram, SystemInstruction } = require('@solana/web3.js');
const { createPurchaseGateway } = require('../dist/services/blockchain-service/src/lib/purchaseGateway');
const { DEVNET_GENESIS } = require('../dist/services/blockchain-service/src/lib/coreMint');
const rent=650240;
async function fixture(options,work){
    const sponsor=Keypair.generate(),buyer=Keypair.generate(),seller=Keypair.generate();
    const treasury=options.sharedRecipient?seller:options.separateTreasury?Keypair.generate():sponsor;
    const gateway=createPurchaseGateway('http://rpc.test',sponsor.secretKey,undefined,treasury.publicKey.toBase58(),options.maxCost);
    const addresses=gateway.addresses(Keypair.generate().publicKey.toBase58(),buyer.publicKey.toBase58(),0);
    const record={id:'rent-regression',assetAddress:gateway.assetAddress('rent-regression'),buyerAddress:buyer.publicKey.toBase58(),sellerAddress:seller.publicKey.toBase58(),listingAddress:addresses.listing,receiptAddress:addresses.receipt,priceLamports:100000n,commissionLamports:5000n,revision:1n,licenseType:'PERSONAL',name:'License',metadataUri:'https://example.com/nft',metadataHash:'a'.repeat(64),manifestHash:'b'.repeat(64),termsHash:'c'.repeat(64),expiresAt:new Date(Date.now()+90000)};
    const balances=new Map([[sponsor.publicKey.toBase58(),1_000_000_000],[buyer.publicKey.toBase58(),options.buyerBalance??100_000_000],[seller.publicKey.toBase58(),options.sellerBalance??0]]);
    if(!treasury.publicKey.equals(sponsor.publicKey)&&!treasury.publicKey.equals(seller.publicKey))balances.set(treasury.publicKey.toBase58(),options.treasuryBalance??0);
    const original=global.fetch,methods=[];let simulated;
    global.fetch=async(_input,init)=>{
        const {id,method,params}=JSON.parse(init.body);methods.push(method);let result;
        switch(method){
            case 'getGenesisHash':result=DEVNET_GENESIS;break;
            case 'getAccountInfo':{const amount=balances.get(params[0])??0;result={context:{slot:1},value:amount?{lamports:amount,data:['','base64'],owner:SystemProgram.programId.toBase58(),executable:false,rentEpoch:0}:null};break;}
            case 'getMinimumBalanceForRentExemption':result=rent;break;
            case 'getLatestBlockhash':result={context:{slot:1},value:{blockhash:Keypair.generate().publicKey.toBase58(),lastValidBlockHeight:100}};break;
            case 'getBalance':result={context:{slot:1},value:balances.get(params[0])};break;
            case 'getFeeForMessage':result={context:{slot:1},value:15000};break;
            case 'simulateTransaction':{
                simulated=Transaction.from(Buffer.from(params[0],'base64'));const topups=simulated.instructions.slice(0,-1).map(ix=>SystemInstruction.decodeTransfer(ix));
                const total=topups.reduce((s,t)=>s+Number(t.lamports),0),credit=treasury.publicKey.equals(sponsor.publicKey)?5000:0;
                const accountIndex=simulated.compileMessage().accountKeys.findIndex(k=>k.equals(buyer.publicKey));
                result={context:{slot:1},value:{err:options.rentError?{InsufficientFundsForRent:{account_index:accountIndex}}:null,logs:[],accounts:[{lamports:1_000_000_000-2_000_000-total+credit}]}};break;
            }
            default:throw new Error(`Unexpected RPC ${method}`);
        }
        return new Response(JSON.stringify({jsonrpc:'2.0',id,result}),{headers:{'content-type':'application/json'}});
    };
    try{await work({gateway,record,sponsor,buyer,seller,treasury,methods,simulated:()=>simulated});}finally{global.fetch=original;}
}
test('a tiny first payout sponsors exactly the rent shortfall and withholds sponsor and buyer signatures',()=>fixture({},async f=>{
    const draft=await f.gateway.build(f.record),tx=Transaction.from(draft.transaction),topup=SystemInstruction.decodeTransfer(tx.instructions[0]);
    assert.equal(tx.instructions.length,2);assert.ok(topup.fromPubkey.equals(f.sponsor.publicKey));assert.ok(topup.toPubkey.equals(f.seller.publicKey));assert.equal(BigInt(topup.lamports),555240n);
    assert.equal(tx.signatures.find(s=>s.publicKey.equals(f.buyer.publicKey)).signature,null);assert.equal(tx.signatures.find(s=>s.publicKey.equals(f.sponsor.publicKey)).signature,null);
    assert.equal(f.methods.includes('sendTransaction'),false);assert.equal(f.record.priceLamports,100000n);
}));
test('empty seller and separate treasury each receive only their shortfall, while funded recipients need none',async()=>{
    await fixture({separateTreasury:true},async f=>{const tx=Transaction.from((await f.gateway.build(f.record)).transaction);assert.equal(tx.instructions.length,3);assert.deepEqual(tx.instructions.slice(0,-1).map(ix=>BigInt(SystemInstruction.decodeTransfer(ix).lamports)),[555240n,645240n]);});
    await fixture({separateTreasury:true,sellerBalance:rent,treasuryBalance:rent},async f=>assert.equal(Transaction.from((await f.gateway.build(f.record)).transaction).instructions.length,1));
});
test('shared seller and treasury combine their proceeds before calculating a single top-up',()=>fixture({sharedRecipient:true},async f=>{
    const tx=Transaction.from((await f.gateway.build(f.record)).transaction);assert.equal(tx.instructions.length,2);assert.equal(BigInt(SystemInstruction.decodeTransfer(tx.instructions[0]).lamports),550240n);
}));
test('insufficient buyer funds and a below-rent remainder produce actionable errors before simulation',async()=>{
    for(const [buyerBalance,expected] of [[50000,/license costs/],[100001,/Keep at least/]])await fixture({buyerBalance},async f=>{await assert.rejects(f.gateway.build(f.record),expected);assert.equal(f.methods.includes('simulateTransaction'),false);});
});
test('recipient top-ups count towards the total sponsorship cap',()=>fixture({maxCost:2_500_000n},async f=>{
    await assert.rejects(f.gateway.build(f.record),/sponsorship limit/);assert.equal(f.methods.includes('sendTransaction'),false);
}));
test('a buyer rent error is identified by its transaction account index instead of a generic balance error',()=>fixture({rentError:true},async f=>{
    await assert.rejects(f.gateway.build(f.record),/minimum balance after paying/);
}));
