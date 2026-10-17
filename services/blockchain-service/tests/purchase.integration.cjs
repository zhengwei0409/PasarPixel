const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes, createHash } = require('node:crypto');
const { createServer } = require('node:http');
const { execFileSync } = require('node:child_process');
const { join } = require('node:path');
const { Keypair } = require('@solana/web3.js');
const { PrismaClient } = require('@pasarpixel/blockchain-client');
const { purchaseService } = require('../dist/services/blockchain-service/src/services/purchase.service');
const { purchaseAddresses, PURCHASE_PROGRAM_ID } = require('../dist/services/blockchain-service/src/lib/purchaseProtocol');
const { walletService } = require('../dist/services/blockchain-service/src/services/wallet.service');
const { createApp } = require('../dist/services/blockchain-service/src/app');

if (!process.env.TEST_DATABASE_URL) throw new Error('Set TEST_DATABASE_URL to a local disposable database');
const url = new URL(process.env.TEST_DATABASE_URL);
if (!['127.0.0.1','localhost'].includes(url.hostname)) throw new Error('Local database required');
const schema = `purchase_test_${randomBytes(8).toString('hex')}`; url.searchParams.set('schema',schema);
const db = new PrismaClient({ datasourceUrl: url.toString() });
const token = 'test-only-internal-token-01234567890123456789';
const address = () => Keypair.generate().publicKey.toBase58();
let nextUser = 100, server, service, options;
const sources = new Map(), revisions = new Map(), chainStates = new Map(), orders = new Map();
const chain = { builds: 0, sent: [], sendError: false, fulfillError: false, persisted: false };
const gateway = { programId: PURCHASE_PROGRAM_ID.toBase58(), sponsorAddress: address(), treasuryAddress: address(),
    addresses(master,buyer,tier) { const a = purchaseAddresses(PURCHASE_PROGRAM_ID,master,buyer,tier); return { listing:a.listing.toBase58(), receipt:a.receipt.toBase58() }; },
    assetAddress: id => Keypair.fromSeed(createHash('sha256').update(id).digest()).publicKey.toBase58(),
    syncListing: async state => { const body=JSON.stringify(state,(_k,v)=>typeof v==='bigint'?String(v):v); const previous=revisions.get(state.master);
        if (!previous || previous.body!==body) revisions.set(state.master,{body,revision:(previous?.revision??0n)+1n}); return revisions.get(state.master).revision; },
    build: async () => ({transaction:Uint8Array.from([++chain.builds]),lastValidBlockHeight:100n}),
    sign: async (record,draft,signed) => { if (!Buffer.from(signed).equals(Buffer.from('buyer-approved'))) throw new Error('Invalid signature');
        return {transaction:Uint8Array.from([...draft,2]),signature:`signature-${record.id}-${draft[0]}`,lastValidBlockHeight:100n}; },
    send: async bytes => { chain.persisted=Boolean(await db.purchaseAttempt.findFirst({where:{transaction:Buffer.from(bytes)}}));chain.sent.push(Buffer.from(bytes).toString('hex'));if(chain.sendError)throw new Error('RPC timeout'); },
    reconcile: async record => chainStates.get(record.id) || 'PENDING',
};
async function fixture() {
    const sellerId=nextUser++, buyerId=nextUser++, assetId=sellerId;
    const seller=await db.wallet.create({data:{userId:sellerId,address:address()}});
    const buyer=await db.wallet.create({data:{userId:buyerId,address:address()}});
    const master=await db.masterNft.create({data:{ownerWalletId:seller.id,assetId,assetAddress:address(),ownerAddress:seller.address,
        status:'READY',manifestHash:'a'.repeat(64),metadataUri:'https://example.com/master',name:'Master'}});
    sources.set(assetId,{available:true,assetId,sellerId,title:'Asset',listingRef:'opaque-reference',manifestHash:master.manifestHash,
        logoUri:'https://example.com/logo.png',personal:'10000000',commercial:'20000000'});
    const prepare=async(tier='PERSONAL')=>service.prepare(buyerId,assetId,tier,(await service.offer(buyerId,assetId)).terms[tier].hash);
    const submit=prepared=>service.submit(buyerId,prepared.purchase.id,Buffer.from('buyer-approved').toString('base64'));
    return {sellerId,buyerId,assetId,seller,buyer,master,prepare,submit};
}
before(async()=>{
    execFileSync(process.execPath,[require.resolve('prisma/build/index.js'),'migrate','deploy'],{cwd:join(__dirname,'..'),env:{...process.env,DATABASE_URL:url.toString()},stdio:'pipe'});
    server=createServer(async(req,res)=>{
        res.setHeader('content-type','application/json');
        if(req.url==='/auth/me') {
            const match=/^Bearer (buyer|seller)-(\d+)$/.exec(req.headers.authorization??'');
            if(!match){res.writeHead(401).end('{}');return;} res.end(JSON.stringify({userId:Number(match[2]),roles:[match[1].toUpperCase()]}));return;
        }
        if(req.headers['x-internal-token']!==token){res.writeHead(401).end('{}');return;}
        if(req.url.startsWith('/assets/')) {res.end(JSON.stringify(sources.get(Number(req.url.split('/')[2]))||{available:false}));return;}
        const id=req.url.split('/').at(-1);
        if(chain.fulfillError){res.writeHead(503).end('{}');return;}
        try { await service.proof(id); if(!orders.has(id))orders.set(id,{orderId:orders.size+1,orderItemId:orders.size+1});res.end(JSON.stringify(orders.get(id))); }
        catch {res.writeHead(409).end('{}');}
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    options={gateway,mainApiUrl:`http://127.0.0.1:${server.address().port}`,publicApiUrl:'https://api.example.com',internalToken:token};
    service=purchaseService(db,options);
});
after(async()=>{if(server)await new Promise(resolve=>server.close(resolve));await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);await db.$disconnect();});

test('purchase requires a ready public listing, bound buyer, correct terms and a positive enabled tier',async()=>{
    const f=await fixture();const offer=await service.offer(f.buyerId,f.assetId);
    await assert.rejects(service.prepare(f.buyerId,f.assetId,'PERSONAL','wrong'),/accept/);
    await assert.rejects(service.prepare(f.sellerId,f.assetId,'PERSONAL',offer.terms.PERSONAL.hash),/own listing/);
    await assert.rejects(service.prepare(nextUser++,f.assetId,'PERSONAL',offer.terms.PERSONAL.hash),/Bind/);
    sources.get(f.assetId).personal='0';await assert.rejects(f.prepare(),/unavailable/);
    sources.get(f.assetId).personal='10000000';sources.get(f.assetId).available=false;await assert.rejects(f.prepare(),/unavailable/);
    assert.equal(await db.purchaseIntent.count(),0);
    await assert.rejects(purchaseService(db,{...options,gateway:undefined}).prepare(f.buyerId,f.assetId,'PERSONAL',offer.terms.PERSONAL.hash),/unavailable/);
});

test('concurrent prepare creates one intent and immutable License metadata linked to the Master',async()=>{
    const f=await fixture();await Promise.all([f.prepare(),f.prepare()]);const p=(await f.prepare()).purchase;
    assert.equal(await db.purchaseIntent.count({where:{masterNftId:f.master.id}}),1);
    const metadata=JSON.parse((await db.nftMetadata.findUniqueOrThrow({where:{hash:p.metadataHash}})).body);
    assert.equal(metadata.masterAssetAddress,f.master.assetAddress);assert.equal(metadata.image,'https://example.com/logo.png');
    assert.equal(metadata.buyerWallet,f.buyer.address);assert.equal(metadata.licenseType,'PERSONAL');assert.equal(metadata.termsHash,p.termsHash);
    assert.ok(!JSON.stringify(metadata).includes('buyerId'));
    assert.equal((await walletService(db,'http://localhost:5173').getStatus(f.buyerId)).lockedReason,'PENDING_TRANSACTION');
    await db.purchaseIntent.update({where:{id:p.id},data:{status:'FAILED'}});
});

test('cross-account access, invalid signatures and changed prices cannot submit a purchase',async()=>{
    const f=await fixture();const p=await f.prepare();
    await assert.rejects(service.status(f.sellerId,p.purchase.id),/not found/);
    await assert.rejects(service.submit(f.buyerId,p.purchase.id,Buffer.from('wrong').toString('base64')),/signature/);
    sources.get(f.assetId).personal='20000000';await assert.rejects(f.submit(p),/listing changed/);
    assert.equal(await db.purchaseAttempt.count({where:{purchaseId:p.purchase.id}}),0);
    assert.equal((await service.status(f.buyerId,p.purchase.id)).purchase.status,'FAILED');
});

test('timeout and worker restart recover the stored transaction and fulfill exactly one order and License NFT',async()=>{
    const f=await fixture();const p=await f.prepare();await f.submit(p);const builds=chain.builds;
    chain.sendError=true;await service.tick();assert.equal(chain.persisted,true);
    const sent=chain.sent.at(-1);chain.sendError=false;
    const restarted=purchaseService(db,options);await restarted.tick();assert.equal(chain.sent.at(-1),sent);assert.equal(chain.builds,builds);
    chainStates.set(p.purchase.id,'CONFIRMED');await restarted.tick();
    const done=(await service.status(f.buyerId,p.purchase.id)).purchase;
    assert.equal(done.status,'CONFIRMED');assert.ok(done.orderId);
    assert.equal(await db.licenseNft.count({where:{masterNftId:f.master.id,holderWalletId:f.buyer.id}}),1);
    assert.equal((await f.prepare()).purchase.id,p.purchase.id);assert.equal(chain.builds,builds);
    assert.equal((await walletService(db,'http://localhost:5173').getStatus(f.buyerId)).lockedReason,'NFT_OWNERSHIP');
    assert.equal((await service.proof(p.purchase.id)).masterAssetAddress,f.master.assetAddress);
});

test('order-service outages keep the confirmed receipt and retry fulfillment without charging again',async()=>{
    const f=await fixture();const p=await f.prepare();await f.submit(p);chainStates.set(p.purchase.id,'CONFIRMED');
    chain.fulfillError=true;await service.tick();assert.equal((await service.status(f.buyerId,p.purchase.id)).purchase.status,'CONFIRMED');
    assert.equal((await service.status(f.buyerId,p.purchase.id)).purchase.orderId,null);
    const builds=chain.builds;chain.fulfillError=false;await service.tick();await service.tick();
    assert.ok((await service.status(f.buyerId,p.purchase.id)).purchase.orderId);assert.equal(chain.builds,builds);
});

test('two concurrent workers fulfill one confirmed purchase and retain one License projection',async()=>{
    const f=await fixture();const p=await f.prepare();await f.submit(p);chainStates.set(p.purchase.id,'CONFIRMED');
    await Promise.all([service.tick(),purchaseService(db,options).tick()]);
    const done=(await service.status(f.buyerId,p.purchase.id)).purchase;
    assert.equal(done.status,'CONFIRMED');assert.ok(done.orderId);
    assert.equal(await db.purchaseAttempt.count({where:{purchaseId:p.purchase.id}}),1);
    assert.equal(await db.licenseNft.count({where:{masterNftId:f.master.id,holderWalletId:f.buyer.id}}),1);
});

test('definite transaction failure permits a retry with the same purchase reference and NFT address',async()=>{
    const f=await fixture();const p=await f.prepare();await f.submit(p);chainStates.set(p.purchase.id,'FAILED');await service.tick();
    assert.equal((await walletService(db,'http://localhost:5173').getStatus(f.buyerId)).canChange,true);
    const retry=await f.prepare();assert.equal(retry.purchase.id,p.purchase.id);assert.equal(retry.purchase.assetAddress,p.purchase.assetAddress);
    await db.purchaseIntent.update({where:{id:p.purchase.id},data:{status:'FAILED'}});
});

test('expired unsigned quotes unlock a buyer and an unused wallet can be rebound before retry',async()=>{
    const f=await fixture();const p=await f.prepare();
    await db.purchaseIntent.update({where:{id:p.purchase.id},data:{expiresAt:new Date(0)}});await service.tick();
    assert.equal((await walletService(db,'http://localhost:5173').getStatus(f.buyerId)).canChange,true);
    const newAddress=address();await db.wallet.update({where:{id:f.buyer.id},data:{address:newAddress}});
    const retry=await f.prepare();assert.equal(retry.purchase.buyerAddress,newAddress);assert.notEqual(retry.purchase.receiptAddress,p.purchase.receiptAddress);
    await db.purchaseIntent.update({where:{id:p.purchase.id},data:{status:'FAILED'}});
});

test('full unsigned-u64 lamport prices are stored exactly without PostgreSQL signed-bigint truncation',async()=>{
    const f=await fixture();sources.get(f.assetId).personal='18446744073709551615';
    const p=(await f.prepare()).purchase;assert.equal(p.priceLamports,'18446744073709551615');assert.equal(p.commissionLamports,'922337203685477580');
    await db.purchaseIntent.update({where:{id:p.id},data:{status:'FAILED'}});
});

test('purchase routes enforce buyer and internal-service access separately',async()=>{
    const f=await fixture();const app=createServer(createApp(db,options.mainApiUrl,'http://localhost:5173',{
        ...options,purchaseGateway:gateway,gateway:undefined,clientOrigin:'http://localhost:5173'}));
    await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${app.address().port}`;
    try {
        assert.equal((await fetch(`${base}/blockchain/offers/${f.assetId}`)).status,401);
        assert.equal((await fetch(`${base}/blockchain/offers/${f.assetId}`,{headers:{authorization:`Bearer seller-${f.sellerId}`}})).status,403);
        assert.equal((await fetch(`${base}/blockchain/offers/${f.assetId}`,{headers:{authorization:`Bearer buyer-${f.buyerId}`}})).status,200);
        assert.equal((await fetch(`${base}/blockchain/internal/purchases/${randomBytes(18).toString('hex')}`)).status,401);
    } finally {await new Promise(resolve=>app.close(resolve));}
});
