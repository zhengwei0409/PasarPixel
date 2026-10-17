// One real Devnet purchase of the existing SDK-test Master. No marketplace order.
// Recovery is automatic: existing signed bytes are reused, never a second purchase.
require('dotenv').config({quiet:true});
const { readFileSync, writeFileSync, existsSync } = require('node:fs');
const { randomUUID, createHash } = require('node:crypto');
const assert = require('node:assert/strict');
const { Keypair, Connection, Transaction, SystemProgram, PublicKey } = require('@solana/web3.js');
const { PrismaClient } = require('@pasarpixel/blockchain-client');
const { createPurchaseGateway } = require('../dist/services/blockchain-service/src/lib/purchaseGateway');
const { DEVNET_GENESIS } = require('../dist/services/blockchain-service/src/lib/coreMint');
const { licenseTerms } = require('../dist/shared/utils/licenseTerms');
const file='.secrets/devnet-purchase-smoke.json';
const hash=body=>createHash('sha256').update(body).digest('hex');
const save=value=>writeFileSync(file,JSON.stringify(value,(_k,v)=>typeof v==='bigint'?String(v):v),{mode:0o600});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const db=new PrismaClient();
async function main(){
    const rpc=process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',connection=new Connection(rpc,'finalized');
    if(await connection.getGenesisHash()!==DEVNET_GENESIS)throw new Error('Devnet only');
    const sponsor=Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(process.env.PLATFORM_WALLET_FILE || '.secrets/devnet-sponsor.json','utf8'))));
    const master=JSON.parse(readFileSync('.secrets/devnet-smoke-result.json','utf8'));
    const gateway=createPurchaseGateway(rpc,sponsor.secretKey,undefined,process.env.PLATFORM_TREASURY_ADDRESS);
    let recovery=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):null;
    if(!recovery){const buyer=Keypair.generate();recovery={buyerSecretKey:[...buyer.secretKey],id:randomUUID()};save(recovery);}
    const buyer=Keypair.fromSecretKey(Uint8Array.from(recovery.buyerSecretKey));
    if(!recovery.attempt){
        if(!recovery.funding){
            const block=await connection.getLatestBlockhash('finalized');
            const tx=new Transaction({feePayer:sponsor.publicKey,...block}).add(SystemProgram.transfer({fromPubkey:sponsor.publicKey,toPubkey:buyer.publicKey,lamports:20_000_000}));tx.sign(sponsor);
            recovery.funding={bytes:tx.serialize().toString('base64'),signature:require('bs58').default.encode(tx.signature),...block};save(recovery);
        }
        const funding=recovery.funding;
        const status=(await connection.getSignatureStatuses([funding.signature],{searchTransactionHistory:true})).value[0];
        if(!status || status.confirmationStatus!=='finalized'){
            try{await connection.sendRawTransaction(Buffer.from(funding.bytes,'base64'));}catch(error){if(!/already been processed/.test(error.message))throw error;}
            const result=await connection.confirmTransaction({signature:funding.signature,blockhash:funding.blockhash,lastValidBlockHeight:funding.lastValidBlockHeight},'finalized');if(result.value.err)throw new Error('Test buyer funding failed');
        }
        const ready=await db.masterNft.findFirstOrThrow({where:{status:'READY'}});
        const response=await fetch(`${process.env.MAIN_API_URL}/assets/${ready.assetId}/purchase-source`,{headers:{'x-internal-token':process.env.INTERNAL_SERVICE_TOKEN},signal:AbortSignal.timeout(15_000)});
        if(!response.ok)throw new Error('Unable to read the public logo snapshot');const source=await response.json();
        const agreement=JSON.stringify(licenseTerms('PERSONAL')),termsHash=hash(agreement);
        const publicBase=process.env.PUBLIC_API_URL || 'http://localhost:8000';
        const body=JSON.stringify({name:'PasarPixel test License',image:source.logoUri,masterAssetAddress:master.assetAddress,buyerWallet:buyer.publicKey.toBase58(),sellerWallet:master.ownerAddress,licenseType:'PERSONAL',purchaseRef:recovery.id,termsHash,termsVersion:licenseTerms('PERSONAL').version,termsUri:`${publicBase}/blockchain/metadata/${termsHash}`,contentManifestHash:'a'.repeat(64),description:'Devnet integration test only; no marketplace order.'});
        const metadataHash=hash(body);
        await db.nftMetadata.upsert({where:{hash:termsHash},create:{hash:termsHash,body:agreement},update:{}});
        await db.nftMetadata.upsert({where:{hash:metadataHash},create:{hash:metadataHash,body},update:{}});
        const state={master:master.assetAddress,seller:master.ownerAddress,manifestHash:'a'.repeat(64),personal:10_000_000n,commercial:20_000_000n,active:true};
        const revision=await gateway.syncListing(state),addresses=gateway.addresses(master.assetAddress,buyer.publicKey.toBase58(),0);
        const record={id:recovery.id,assetAddress:gateway.assetAddress(recovery.id),buyerAddress:buyer.publicKey.toBase58(),sellerAddress:master.ownerAddress,listingAddress:addresses.listing,receiptAddress:addresses.receipt,priceLamports:10_000_000n,commissionLamports:500_000n,revision,licenseType:'PERSONAL',name:'PasarPixel test License',metadataUri:`${publicBase}/blockchain/metadata/${metadataHash}`,metadataHash,manifestHash:state.manifestHash,termsHash,expiresAt:new Date(Date.now()+90_000)};
        const draft=await gateway.build(record),partial=Transaction.from(draft.transaction);partial.partialSign(buyer);
        const signed=await gateway.sign(record,draft.transaction,partial.serialize({requireAllSignatures:false}));
        recovery.record=record;recovery.attempt={signature:signed.signature,transaction:Buffer.from(signed.transaction).toString('base64'),lastValidBlockHeight:draft.lastValidBlockHeight};
        recovery.before={buyer:await connection.getBalance(buyer.publicKey,'finalized'),seller:await connection.getBalance(new PublicKey(master.ownerAddress),'finalized')};save(recovery);
    }
    const record={...recovery.record,priceLamports:BigInt(recovery.record.priceLamports),commissionLamports:BigInt(recovery.record.commissionLamports),revision:BigInt(recovery.record.revision),expiresAt:new Date(recovery.record.expiresAt)};
    const attempt={...recovery.attempt,transaction:Buffer.from(recovery.attempt.transaction,'base64'),lastValidBlockHeight:BigInt(recovery.attempt.lastValidBlockHeight)};
    for(let i=0;;i++){
        const state=await gateway.reconcile(record,master.assetAddress,attempt);
        if(state==='CONFIRMED')break;if(state==='FAILED')throw new Error('Saved test transaction failed or expired; inspect recovery before preparing another');
        if(i>40)throw new Error('Still pending; rerun this script to resume the saved transaction');
        if(i===0){try{await gateway.send(attempt.transaction);}catch(error){if(!/already been processed/.test(error.message))throw error;}}
        await sleep(2000);
    }
    const after={buyer:await connection.getBalance(buyer.publicKey,'finalized'),seller:await connection.getBalance(new PublicKey(master.ownerAddress),'finalized')};
    assert.equal(recovery.before.buyer-after.buyer,10_000_000);assert.equal(after.seller-recovery.before.seller,9_500_000);
    recovery.verified=true;save(recovery);
    console.log(JSON.stringify({status:'CONFIRMED',network:'Devnet',masterAssetAddress:master.assetAddress,licenseAssetAddress:record.assetAddress,receiptAddress:record.receiptAddress,signature:attempt.signature,buyerPaidLamports:'10000000',sellerReceivedLamports:'9500000',commissionLamports:'500000',explorer:`https://explorer.solana.com/address/${record.assetAddress}?cluster=devnet`},null,2));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(()=>db.$disconnect());
