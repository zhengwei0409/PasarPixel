const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const {test} = require('node:test');
const {runInNewContext} = require('node:vm');
const ts = require('typescript');
const code=ts.transpileModule(readFileSync(join(__dirname,'../src/controllers/asset.controller.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const validation={};
runInNewContext(ts.transpileModule(readFileSync(join(__dirname,'../src/lib/assetSpecifications.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:validation});
const original={id:3,assetId:1,purpose:'ORIGINAL',fileUrl:'https://bucket.test/assets/7/1/model.GLB',previewUrl:null,fileType:'application/octet-stream',fileSize:20};
const draft={id:1,sellerId:7,status:'DRAFT',category:'THREE_D_MODEL',listingType:'TRADITIONAL',pricePersonal:'0',priceCommercial:null,files:[original,{id:4,purpose:'PREVIEW',fileType:'image/png',fileUrl:'https://bucket.test/cover.png'}]};
function harness(asset=draft, failCopy=false){
    const copies=[],updates=[],deleted=[]; let created;
    const prisma={asset:{findUnique:async()=>asset,update:async({data})=>({...asset,...data})},assetFile:{findUnique:async()=>asset.files.find(f=>f.id===3),delete:async()=>{},create:async({data})=>(created={id:3,...data}),update:async({data})=>{updates.push(data);return {...(created??original),...data};}}};
    const exports={};
    runInNewContext(code,{exports,process:{env:{S3_BUCKET_NAME:'bucket',AWS_REGION:'region'}},console:{error(){}},require:name=>name==='../lib/assetSpecifications'?validation:name==='../lib/prisma'?{prisma}:name==='../lib/s3'?{deleteObject:async key=>deleted.push(key),extractKeyFromUrl:url=>new URL(url).pathname.slice(1),copyObjectForPreview:async(source,key)=>{copies.push({source,key});if(failCopy)throw Error('storage');return 'https://bucket.test/'+key;}}:{}});
    const res={statusCode:200,status(value){this.statusCode=value;return this;},json(value){this.body=value;},send(){}};
    const req={user:{userId:7},params:{id:'1',fileId:'3'},body:{}};
    return {exports,res,req,copies,updates,deleted};
}
test('existing source GLB gets a public copy without changing its original purpose',async()=>{
    const h=harness();await h.exports.reuseGlbPreview(h.req,h.res);
    assert.equal(h.res.statusCode,200);assert.equal(h.res.body.purpose,'ORIGINAL');
    assert.equal(h.res.body.fileUrl,original.fileUrl);assert.equal(h.res.body.previewUrl,'https://bucket.test/previews/7/1/source-3.glb');
    assert.deepEqual(JSON.parse(JSON.stringify(h.copies)),[{source:'assets/7/1/model.GLB',key:'previews/7/1/source-3.glb'}]);
});
test('a prepared GLB is reused idempotently',async()=>{
    const h=harness({...draft,files:[{...original,previewUrl:'https://bucket.test/previews/existing.glb'}]});await h.exports.reuseGlbPreview(h.req,h.res);
    assert.equal(h.res.statusCode,200);assert.equal(h.copies.length,0);
});
test('reuse enforces ownership, draft status, category and original GLB file membership',async()=>{
    for(const [asset,status] of [[null,404],[{...draft,sellerId:8},403],[{...draft,status:'PUBLISHED'},409],[{...draft,category:'ANIMATION'},400],[{...draft,files:[]},400],[{...draft,files:[{...original,purpose:'PREVIEW'}]},400],[{...draft,files:[{...original,fileUrl:'https://bucket.test/source.fbx'}]},400]]){
        const h=harness(asset);await h.exports.reuseGlbPreview(h.req,h.res);assert.equal(h.res.statusCode,status);assert.equal(h.copies.length,0);
    }
});
test('storage failure leaves the source intact and permits retry',async()=>{
    const h=harness(draft,true);await h.exports.reuseGlbPreview(h.req,h.res);assert.equal(h.res.statusCode,502);assert.equal(h.updates.length,0);
});
test('new Step 1 GLB upload automatically receives a public preview',async()=>{
    const h=harness();h.req.body={key:'assets/7/1/model.GLB',fileType:'application/octet-stream',fileSize:20,purpose:'ORIGINAL'};
    await h.exports.registerFile(h.req,h.res);assert.equal(h.res.statusCode,201);assert.equal(h.copies.length,1);assert.equal(h.res.body.purpose,'ORIGINAL');assert(h.res.body.previewUrl.endsWith('.glb'));
});
test('non-GLB uploads do not create model previews',async()=>{
    const h=harness();h.req.body={key:'assets/7/1/model.fbx',fileType:'application/octet-stream',fileSize:20,purpose:'ORIGINAL'};
    await h.exports.registerFile(h.req,h.res);assert.equal(h.res.statusCode,201);assert.equal(h.copies.length,0);
});
test('3D submission accepts a reused GLB and rejects a missing GLB preview',async()=>{
    for(const [file,status] of [[{...original,previewUrl:'https://bucket.test/previews/source.glb'},200],[original,400]]){
        const h=harness({...draft,files:[file,draft.files[1]]});await h.exports.submitForReview(h.req,h.res);assert.equal(h.res.statusCode,status);
    }
});
test('deleting a source file also deletes its public preview copy',async()=>{
    const h=harness({...draft,files:[{...original,previewUrl:'https://bucket.test/previews/7/1/source-3.glb'}]});await h.exports.deleteFile(h.req,h.res);
    assert.equal(h.res.statusCode,204);assert.deepEqual(h.deleted,['assets/7/1/model.GLB','previews/7/1/source-3.glb']);
});
test('cover is required for video, animation and 3D',async()=>{
    for (const [category, extension, mime] of [['VIDEO','mp4','video/mp4'],['ANIMATION','glb','model/gltf-binary'],['THREE_D_MODEL','glb','model/gltf-binary']]) {
        const files=[{...original,fileUrl:`https://bucket.test/source.${extension}`,fileType:mime,previewUrl:'https://bucket.test/previews/source.glb'},
            ...(category==='ANIMATION'?[{id:5,purpose:'PREVIEW',fileUrl:'https://bucket.test/preview.mp4',fileType:'video/mp4'}]:[])];
        const h=harness({...draft,category,files});await h.exports.submitForReview(h.req,h.res);
        assert.equal(h.res.statusCode,400,category);assert.match(h.res.body.error,/cover image/);
    }
});
