// Default: read-only Devnet deployment check. --deploy explicitly starts upload.
require('dotenv').config({ quiet: true });
const { readFileSync, writeFileSync, existsSync } = require('node:fs');
const { resolve, dirname, join } = require('node:path');
const { execFileSync } = require('node:child_process');
const { Connection, Keypair, PublicKey } = require('@solana/web3.js');
const { DEVNET_GENESIS } = require('../dist/services/blockchain-service/src/lib/coreMint');
const { PURCHASE_PROGRAM_ID } = require('../dist/services/blockchain-service/src/lib/purchaseProtocol');
async function main() {
    const rpc=process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    const connection=new Connection(rpc,'finalized');
    if(await connection.getGenesisHash()!==DEVNET_GENESIS)throw new Error('Deployment is restricted to Solana Devnet');
    const sponsorFile=resolve(process.env.PLATFORM_WALLET_FILE || '.secrets/devnet-sponsor.json');
    const programFile=resolve(process.env.PURCHASE_PROGRAM_KEYPAIR || '.secrets/purchase-program.json');
    const sponsor=Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(sponsorFile,'utf8'))));
    const program=Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(programFile,'utf8'))));
    if(!program.publicKey.equals(PURCHASE_PROGRAM_ID))throw new Error('Program key does not match the source program ID; restore the original deployment key');
    const binary=resolve(__dirname,'../../../programs/target/deploy/pasar_purchase.so');
    const bytes=readFileSync(binary),size=bytes.length;
    const bufferFile=join(dirname(programFile),'purchase-buffer.json');
    const buffer=existsSync(bufferFile)?Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(bufferFile,'utf8')))):null;
    const bufferAccount=buffer?await connection.getAccountInfo(buffer.publicKey,'confirmed'):null;
    const rents=await Promise.all([size+45,size+37,36].map(n=>connection.getMinimumBalanceForRentExemption(n)));
    const needed=rents.reduce((a,b)=>a+b,0)+100_000_000-(bufferAccount?.lamports||0), balance=await connection.getBalance(sponsor.publicKey);
    console.log(JSON.stringify({network:'Devnet',programId:program.publicKey.toBase58(),sponsor:sponsor.publicKey.toBase58(),programBytes:size,balanceSol:balance/1e9,estimatedPeakSol:needed/1e9,mode:process.argv.includes('--deploy')?'deploy':'read-only'},null,2));
    if(!process.argv.includes('--deploy'))return;
    if(await connection.getAccountInfo(new PublicKey(PURCHASE_PROGRAM_ID)))throw new Error('Program already exists; inspect it before authorizing an upgrade');
    if(balance<needed)throw new Error('Insufficient free Devnet SOL for program storage and temporary upload buffer; keep PURCHASE_ENABLED=false');
    // Explicit buffer signer avoids CLI-generated recovery phrases appearing in logs.
    if(!existsSync(bufferFile))writeFileSync(bufferFile,JSON.stringify([...Keypair.generate().secretKey]),{mode:0o600,flag:'wx'});
    if(process.argv.includes('--paced'))await require('./paced-program-upload.cjs').upload(connection,sponsor,buffer || Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(bufferFile,'utf8')))),bytes);
    execFileSync(process.env.SOLANA_CLI || 'solana',['program','deploy',binary,'--url',rpc,'--program-id',programFile,'--keypair',sponsorFile,'--fee-payer',sponsorFile,'--upgrade-authority',sponsorFile,'--buffer',bufferFile,'--max-len',String(size),'--use-rpc'],{stdio:'inherit'});
    const deployed=await connection.getAccountInfo(program.publicKey,'finalized');
    if(!deployed?.executable)throw new Error('Program is not finalized yet; keep checkout disabled and inspect deployment');
    console.log('Purchase program deployed. Configure the shared internal token and enable PURCHASE_ENABLED, then restart blockchain-service.');
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
