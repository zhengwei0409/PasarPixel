// Optional public-RPC fallback: idempotent, paced Upgradeable Loader v3 writes.
// Final deployment remains the official Solana CLI's responsibility.
const { PublicKey, Transaction, TransactionInstruction, SystemProgram } = require('@solana/web3.js');
const LOADER=new PublicKey('BPFLoaderUpgradeab1e11111111111111111111111');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function confirmed(connection,signatures){
    for(let i=0;i<75;i++){
        const statuses=(await connection.getSignatureStatuses(signatures)).value;
        if(statuses.some(s=>s?.err))throw new Error('Program upload transaction failed; preserve the buffer and retry');
        if(statuses.every(s=>s && ['confirmed','finalized'].includes(s.confirmationStatus)))return;
        await sleep(1000);
    }
    throw new Error('Program upload confirmation timed out; rerun to resume the same buffer');
}
async function upload(connection,sponsor,buffer,binary){
    let info=await connection.getAccountInfo(buffer.publicKey,'confirmed');
    if(!info){
        const block=await connection.getLatestBlockhash('confirmed');
        const rent=await connection.getMinimumBalanceForRentExemption(binary.length+37);
        const tx=new Transaction({feePayer:sponsor.publicKey,...block}).add(SystemProgram.createAccount({fromPubkey:sponsor.publicKey,newAccountPubkey:buffer.publicKey,lamports:rent,space:binary.length+37,programId:LOADER}),new TransactionInstruction({programId:LOADER,keys:[{pubkey:buffer.publicKey,isSigner:false,isWritable:true},{pubkey:sponsor.publicKey,isSigner:false,isWritable:false}],data:Buffer.alloc(4)}));
        tx.sign(sponsor,buffer);await confirmed(connection,[await connection.sendRawTransaction(tx.serialize())]);
        info=await connection.getAccountInfo(buffer.publicKey,'confirmed');
    }
    if(!info?.owner.equals(LOADER)||info.data.length!==binary.length+37||info.data.readUInt32LE(0)!==1||info.data[4]!==1||!info.data.subarray(5,37).equals(sponsor.publicKey.toBuffer()))throw new Error('Upload buffer owner, length or authority does not match');
    const chunks=[];
    for(let offset=0;offset<binary.length;offset+=1000){const bytes=binary.subarray(offset,offset+1000);if(!info.data.subarray(37+offset,37+offset+bytes.length).equals(bytes))chunks.push({offset,bytes});}
    console.log(`Resuming ${chunks.length} missing program chunks at a controlled RPC rate.`);
    for(let start=0;start<chunks.length;start+=20){
        const block=await connection.getLatestBlockhash('confirmed'),signatures=[];
        for(const {offset,bytes} of chunks.slice(start,start+20)){
            // bincode(UpgradeableLoaderInstruction::Write): u32 tag, u32 offset,
            // u64 Vec length, bytes. Matches solana-loader-v3-interface.
            const data=Buffer.alloc(16+bytes.length);data.writeUInt32LE(1);data.writeUInt32LE(offset,4);data.writeBigUInt64LE(BigInt(bytes.length),8);bytes.copy(data,16);
            const tx=new Transaction({feePayer:sponsor.publicKey,...block}).add(new TransactionInstruction({programId:LOADER,keys:[{pubkey:buffer.publicKey,isSigner:false,isWritable:true},{pubkey:sponsor.publicKey,isSigner:true,isWritable:false}],data}));tx.sign(sponsor);
            signatures.push(await connection.sendRawTransaction(tx.serialize(),{skipPreflight:false,maxRetries:3}));await sleep(600);
        }
        await confirmed(connection,signatures);console.log(`Program chunks confirmed: ${Math.min(start+20,chunks.length)}/${chunks.length}`);
    }
    const verified=await connection.getAccountInfo(buffer.publicKey,'confirmed');
    if(!verified?.data.subarray(37).equals(binary))throw new Error('Uploaded buffer bytes do not match the compiled program');
    console.log('Full upload buffer matches the compiled program.');
}
module.exports={upload};
