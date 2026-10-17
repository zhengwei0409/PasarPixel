const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');
function load(file, dependencies, globals={}) {
    const exports={};runInNewContext(ts.transpileModule(readFileSync(join(__dirname,'../src/lib',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,...globals,require:name=>dependencies[name]});return exports;
}
function fixture(bound=null,address='buyer-wallet') {
    const calls={connect:0,message:0,prepare:0,transaction:0,submit:0,verify:0,steps:[],purchases:[]};
    const key={toString:()=>address};
    const provider={isPhantom:true,isConnected:false,publicKey:null,connect:async()=>{calls.connect++;provider.isConnected=true;provider.publicKey=key;return {publicKey:key};},signMessage:async()=>{calls.message++;return {publicKey:key,signature:new Uint8Array(64)};},signTransaction:async()=>{calls.transaction++;return 'signed-transaction';}};
    const window=new EventTarget();window.phantom={solana:provider};window.sessionStorage={getItem:()=>null,setItem(){},removeItem(){}};
    const phantom=load('phantom.ts',{}, {window,Event,URL,TextEncoder,btoa});
    const flow=load('solCheckout.ts',{'./phantom':phantom,'./solPurchase':{signSolPurchase:async(p,_quote,_expected,session)=>{session();return p.signTransaction();}}});
    const state={status:{wallet:bound?{address:bound}:null,canChange:true,network:'solana:devnet',lockedReason:null},session:true};
    const session=()=>{if(!state.session)throw new Error('Session changed');};
    const walletApi={status:async()=>state.status,challenge:async()=>({challengeId:'challenge',address,network:'solana:devnet',expiresAt:new Date(Date.now()+60_000).toISOString(),message:'PasarPixel wallet binding\nDomain: localhost:5173\nURI: http://localhost:5173/settings\nNonce: test'}),verify:async(_id,_signature,options)=>{calls.verify++;assert.equal(options.onlyIfUnbound,true);state.status={...state.status,wallet:{address}};return state.status;}};
    const quote={enabled:true,purchase:{id:'same-purchase',status:'AWAITING_SIGNATURE'}};
    const paymentApi={status:walletApi.status,prepare:async()=>{calls.prepare++;return quote;},submit:async(id,bytes)=>{calls.submit++;assert.equal(id,'same-purchase');assert.equal(bytes,'signed-transaction');return {enabled:true,purchase:{id,status:'PENDING'}};}};
    const input={assetId:12,masterAddress:'master',priceLamports:'10000000',licenseType:'PERSONAL',termsHash:'hash'};
    const save=()=>{},step=s=>calls.steps.push(s),onPurchase=p=>calls.purchases.push(p);
    return {flow,phantom,provider,calls,state,walletApi,paymentApi,quote,connect:()=>flow.connectCheckoutWallet(provider,walletApi,session,'http://localhost:5173',save,step),pay:()=>flow.paySolCheckout(provider,input,paymentApi,session,onPurchase,save,step)};
}
test('first-time checkout connects and verifies once, then waits for a separate Pay action',async()=>{
    const f=fixture();await f.connect();assert.equal(f.calls.connect,1);assert.equal(f.calls.message,1);assert.equal(f.calls.verify,1);
    assert.equal(f.calls.prepare,0);assert.equal(f.calls.transaction,0);assert.equal(f.calls.submit,0);
    assert.equal(f.flow.checkoutWalletState(f.state.status,f.phantom.getConnectedAddress()),'ready');
    assert.equal((await f.pay()).purchase.status,'PENDING');assert.equal(f.calls.transaction,1);assert.equal(f.calls.submit,1);
});
test('an already linked wallet reconnects without another verification signature',async()=>{
    const f=fixture('buyer-wallet');await f.connect();assert.equal(f.calls.message,0);assert.equal(f.calls.verify,0);assert.equal((await f.pay()).purchase.status,'PENDING');
});
test('a different wallet is shown as mismatch and cannot silently replace an unused binding or start payment',async()=>{
    const f=fixture('saved-wallet');await f.connect();assert.equal(f.flow.checkoutWalletState(f.state.status,f.phantom.getConnectedAddress()),'mismatch');
    assert.equal(f.state.status.wallet.address,'saved-wallet');assert.equal(f.calls.message,0);assert.equal(f.calls.verify,0);
    await assert.rejects(f.pay(),/linked wallet/);assert.equal(f.calls.prepare,0);assert.equal(f.calls.submit,0);
});
test('binding changes before verification stop the flow without requesting a signature',async()=>{
    const f=fixture();let reads=0;f.walletApi.status=async()=>++reads===1?f.state.status:{...f.state.status,wallet:{address:'another-wallet'}};
    await assert.rejects(f.connect(),/just linked/);assert.equal(f.calls.message,0);assert.equal(f.calls.verify,0);
});
test('connect and verification cancellations preserve an unpaid checkout and permit retry',async()=>{
    for(const stage of ['connect','signMessage']){
        const f=fixture(),original=f.provider[stage];f.provider[stage]=async()=>{throw {code:4001,message:'User rejected'};};
        await assert.rejects(f.connect(),error=>error instanceof f.flow.CheckoutCancelled && /No payment was submitted/.test(error.message));
        assert.equal(f.calls.prepare,0);assert.equal(f.calls.submit,0);f.provider[stage]=original;await f.connect();assert.equal(f.state.status.wallet.address,'buyer-wallet');
    }
});
test('payment rejection never submits and the same prepared purchase can be retried',async()=>{
    const f=fixture();await f.connect();const original=f.provider.signTransaction;f.provider.signTransaction=async()=>{throw {code:4001};};
    await assert.rejects(f.pay(),error=>error instanceof f.flow.CheckoutCancelled);assert.equal(f.calls.submit,0);assert.equal(f.calls.purchases[0].purchase.id,'same-purchase');
    f.provider.signTransaction=original;await f.pay();assert.equal(f.calls.submit,1);assert.equal(f.calls.purchases[1].purchase.id,'same-purchase');
});
test('submission failures are uncertain rather than labelled cancelled or unpaid',async()=>{
    const f=fixture();await f.connect();f.paymentApi.submit=async()=>{throw new Error('Network timeout');};
    await assert.rejects(f.pay(),error=>error instanceof f.flow.CheckoutSubmissionUnknown && !/No payment/.test(error.message));
    assert.equal(f.calls.purchases[0].purchase.id,'same-purchase');
});
test('session or wallet switches before payment cannot prepare or submit a transaction',async()=>{
    for(const change of [f=>{f.state.session=false;},f=>{f.provider.publicKey={toString:()=> 'other-wallet'};},f=>{f.provider.isConnected=false;}]){
        const f=fixture();await f.connect();change(f);await assert.rejects(f.pay());assert.equal(f.calls.prepare,0);assert.equal(f.calls.submit,0);
    }
});
test('an already pending purchase resumes status without another payment signature',async()=>{
    const f=fixture();await f.connect();f.quote.purchase.status='PENDING';assert.equal((await f.pay()).purchase.status,'PENDING');assert.equal(f.calls.transaction,0);assert.equal(f.calls.submit,0);
});
