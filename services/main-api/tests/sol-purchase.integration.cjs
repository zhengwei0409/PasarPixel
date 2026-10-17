const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes, randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { execFileSync } = require('node:child_process');
const { runInNewContext } = require('node:vm');
const { PrismaClient } = require('@prisma/client');
const ts = require('typescript');
if (!process.env.TEST_DATABASE_URL) throw new Error('Local disposable TEST_DATABASE_URL required');
const url=new URL(process.env.TEST_DATABASE_URL);if(!['localhost','127.0.0.1'].includes(url.hostname))throw new Error('Local database required');
const schema=`sol_order_test_${randomBytes(8).toString('hex')}`;url.searchParams.set('schema',schema);
const db=new PrismaClient({datasourceUrl:url.toString()});
const token='test-only-internal-token-01234567890123456789';
let asset,proof,order,active=true,outage=false;const events=[];
const blockchain={validInternalToken:value=>value===token,activeAccount:async()=>active,purchaseProof:async()=>{if(outage)throw new Error('RPC offline');return proof;}};
function load(path,dependencies){const exports={};runInNewContext(ts.transpileModule(readFileSync(join(__dirname,path),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,{exports,console,Buffer,process,require:name=>name in dependencies?dependencies[name]:require(name)});return exports;}
const entitlement=load('../src/lib/solEntitlement.ts',{'./blockchain':blockchain});
const handlers=load('../src/controllers/blockchainCheckout.controller.ts',{'../lib/prisma':{prisma:db},'../../../../shared/utils/solPrice':{parseSolLamports:()=>10_000_000n},'../lib/blockchain':blockchain,'./nftSnapshot.controller':{publicLogoUri:async()=> 'https://example.com/logo'},'../lib/publisher':{publishOrderPaid:async x=>events.push(x),publishAssetSold:async x=>events.push(x)}});
const response=()=>({code:200,status(code){this.code=code;return this;},json(body){this.body=body;return this;},set(){return this;},end(){return this;},setHeader(){}});
const request=()=>({headers:{'x-internal-token':token},params:{reference:proof.purchaseRef}});
before(async()=>{
    execFileSync(process.execPath,[require.resolve('prisma/build/index.js'),'migrate','deploy'],{cwd:join(__dirname,'..'),env:{...process.env,DATABASE_URL:url.toString()},stdio:'pipe'});
    await db.userProfile.createMany({data:[{userId:7,name:'Buyer'},{userId:8,name:'Seller'}]});
    asset=await db.asset.create({data:{sellerId:8,title:'Original',category:'IMAGE',listingType:'BLOCKCHAIN',status:'PUBLISHED',priceSolPersonal:'0.01'}});
    await db.assetMintSnapshot.create({data:{assetId:asset.id,title:'Original',manifestHash:'a'.repeat(64),previewHash:'b'.repeat(64),originals:[{key:`nft-originals/${'c'.repeat(64)}`,name:'original.png'}]}});
    proof={status:'CONFIRMED',purchaseRef:randomUUID(),assetId:asset.id,buyerId:7,sellerId:8,buyerAddress:'bound-wallet',sellerAddress:'seller-wallet',assetAddress:'license',masterAssetAddress:'master',receiptAddress:'receipt',priceLamports:'18446744073709551615',commissionLamports:'922337203685477580',txSignature:'signature',metadataUri:'https://example.com/license',licenseType:'PERSONAL',termsVersion:'test-version',termsUri:'https://example.com/terms',termsHash:'d'.repeat(64),manifestHash:'a'.repeat(64)};
});
after(async()=>{await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);await db.$disconnect();});
test('only authenticated internal finalized proofs can create a SOL order',async()=>{
    const denied=response();await handlers.fulfillBlockchainPurchase({...request(),headers:{}},denied);assert.equal(denied.code,401);
    proof.status='PENDING';const pending=response();await handlers.fulfillBlockchainPurchase(request(),pending);assert.equal(pending.code,409);assert.equal(await db.order.count(),0);
    proof.status='CONFIRMED';const hash=proof.manifestHash;proof.manifestHash='f'.repeat(64);const mismatch=response();await handlers.fulfillBlockchainPurchase(request(),mismatch);assert.equal(mismatch.code,409);proof.manifestHash=hash;
});
test('concurrent fulfillment makes one exact-u64 order and preserves private original snapshots',async()=>{
    const a=response(),b=response();await Promise.all([handlers.fulfillBlockchainPurchase(request(),a),handlers.fulfillBlockchainPurchase(request(),b)]);
    assert.equal(a.body.orderId,b.body.orderId);assert.equal(await db.order.count(),1);assert.equal(await db.orderItem.count(),1);assert.equal(events.length,2);
    order=await db.order.findUniqueOrThrow({where:{id:a.body.orderId},include:{orderItems:true}});
    assert.equal(order.paymentMethod,'SOL');assert.equal(order.totalLamports,proof.priceLamports);assert.equal(order.totalAmount.toString(),'0');
    assert.equal(order.orderItems[0].price.toString(),'0');assert.equal(order.orderItems[0].commissionLamports,proof.commissionLamports);
    assert.equal(order.orderItems[0].originalSnapshot[0].key,`nft-originals/${'c'.repeat(64)}`);
    assert.equal((await db.order.aggregate({_sum:{totalAmount:true},where:{paymentMethod:'STRIPE',paymentStatus:'COMPLETED'}}))._sum.totalAmount,null);
});
test('downloads require matching receipt, wallet, buyer and current access; RPC outages remain retryable',async()=>{
    assert.equal(await entitlement.solEntitlement(order,7),null);
    for(const field of ['buyerId','buyerAddress','assetAddress','masterAssetAddress','receiptAddress','licenseType','termsHash','manifestHash','priceLamports']){
        const saved=proof[field];proof[field]=typeof saved==='number'?999:'wrong';const result=await entitlement.solEntitlement(order,7);assert.equal(result.status,403);assert.equal(result.purchaseVerified,false);proof[field]=saved;
    }
    order.orderItems[0].accessRevokedAt=new Date();assert.equal((await entitlement.solEntitlement(order,7)).purchaseVerified,true);order.orderItems[0].accessRevokedAt=null;
    active=false;assert.equal((await entitlement.solEntitlement(order,7)).status,403);active=true;
    outage=true;assert.equal((await entitlement.solEntitlement(order,7)).status,503);outage=false;
    assert.equal(await entitlement.solEntitlement({paymentMethod:'STRIPE',orderItems:[]},7),null);
});
test('database rejects incomplete SOL accounting and altered commission without changing an order',async()=>{
    for(const data of [{totalLamports:null},{totalAmount:1},{totalLamports:'18446744073709551616'}])await assert.rejects(db.order.update({where:{id:order.id},data}));
    await assert.rejects(db.orderItem.update({where:{id:order.orderItems[0].id},data:{commissionLamports:'1'}}));
    assert.equal((await db.order.findUniqueOrThrow({where:{id:order.id}})).totalLamports,proof.priceLamports);
});
