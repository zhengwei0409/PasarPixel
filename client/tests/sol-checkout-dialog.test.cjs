const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { runInNewContext } = require('node:vm');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const ts = require('typescript');
const code=ts.transpileModule(readFileSync(join(__dirname,'../src/components/marketplace/SolCheckoutDialog.tsx'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
function render({bound=null,connected=null,purchase,loading=false,error=false}={}){
    let mutations=0;const exports={};
    const container=({children})=>React.createElement('div',{},children);
    runInNewContext(code,{exports,console,require:name=>{
        if(['react','react/jsx-runtime','lucide-react'].includes(name))return require(name);
        if(name==='react-router-dom')return {Link:({to,children,...props})=>React.createElement('a',{href:to,...props},children)};
        if(name==='@tanstack/react-query')return {useQueryClient:()=>({setQueryData(){},invalidateQueries(){}}),useMutation:()=>({isPending:false,mutate(){mutations++;}})};
        if(name==='../ui/button')return {Button:({children,asChild,variant,...props})=>asChild?children:React.createElement('button',props,children)};
        if(name==='../ui/dialog')return {DialogContent:container,DialogClose:container,DialogHeader:container,DialogTitle:({children})=>React.createElement('h2',{},children),DialogDescription:({children})=>React.createElement('p',{},children)};
        if(name==='../../hooks/useWallet')return {useWallet:()=>({connectedAddress:connected,status:{data:{wallet:bound?{address:bound}:null},isPending:loading,isError:error,refetch(){}}})};
        if(name==='../../lib/phantom')return {getPhantom:()=>({})};
        if(name==='../../lib/solCheckout')return {checkoutWalletState:(s,a)=>!s.wallet?'unlinked':!a?'disconnected':s.wallet.address===a?'ready':'mismatch',CheckoutCancelled:class extends Error{},CheckoutSubmissionUnknown:class extends Error{}};
        if(name==='../../lib/price')return {formatLamportsSol:()=> '0.01 SOL'};
        if(['../../lib/apiClient','../../lib/errors','../../services/walletService'].includes(name))return {};
        throw new Error(`Unexpected dependency ${name}`);
    }});
    const markup=renderToStaticMarkup(React.createElement(exports.default,{userId:7,assetId:12,assetTitle:'PicPic',tier:'PERSONAL',offer:{enabled:true,personal:'10000000',terms:{PERSONAL:{hash:'terms',title:'Personal license',clauses:['Test terms']}}},purchase,onPurchase(){}}));
    assert.equal(mutations,0);return markup;
}
test('first-time checkout explains verification and permanence and keeps Pay behind wallet and terms steps',()=>{
    const html=render();assert.match(html,/PicPic/);assert.match(html,/Connect &amp; verify Phantom/);assert.match(html,/does not request payment/);assert.match(html,/cannot be replaced/);
    assert.match(html,/<button[^>]*disabled=""[^>]*>Pay 0.01 SOL/);assert.doesNotMatch(html,/href="\/settings"/);
});
test('linked but disconnected checkout asks only for connection',()=>{
    const html=render({bound:'saved-address'});assert.match(html,/Connect Phantom/);assert.match(html,/won&#x27;t need to verify it again/);assert.doesNotMatch(html,/Connect &amp; verify Phantom/);
});
test('wrong wallet shows both addresses and keeps payment disabled without a replacement action',()=>{
    const html=render({bound:'saved-address',connected:'other-address'});assert.match(html,/saved-address/);assert.match(html,/other-address/);assert.match(html,/Switch account in Phantom/);assert.match(html,/saved wallet stays the same/);assert.match(html,/<button[^>]*disabled=""[^>]*>Pay 0.01 SOL/);
});
test('verified wallet shows a separate explicit payment button and requires terms acceptance',()=>{
    const html=render({bound:'saved-address',connected:'saved-address'});assert.match(html,/Wallet verified/);assert.match(html,/Payment is requested only when you click Pay/);assert.match(html,/<button[^>]*disabled=""[^>]*>Pay 0.01 SOL/);assert.match(html,/type="checkbox"/);
});
test('pending and completed purchases show recovery or order links without wallet setup or a second Pay button',()=>{
    const pending=render({purchase:{status:'PENDING',id:'p'}});assert.match(pending,/Confirming purchase/);assert.match(pending,/You can close this dialog/);assert.doesNotMatch(pending,/>Pay 0.01 SOL/);
    const done=render({purchase:{status:'CONFIRMED',id:'p',orderId:9,explorerUrl:'https://explorer.solana.com/address/license?cluster=devnet'}});assert.match(done,/href="\/orders\/9"/);assert.match(done,/Your License NFT is ready/);assert.doesNotMatch(done,/>Pay 0.01 SOL/);
});
test('wallet status outages offer a local retry and never enable payment',()=>{
    const html=render({error:true});assert.match(html,/Unable to load your linked wallet/);assert.match(html,/Try again/);assert.match(html,/<button[^>]*disabled=""[^>]*>Pay 0.01 SOL/);
});
