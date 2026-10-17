const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const {runInNewContext}=require('node:vm');
const ts=require('typescript');
const exportsObject={};runInNewContext(ts.transpileModule(readFileSync(join(__dirname,'../src/lib/nftDownloadName.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:exportsObject,Buffer,require});
const {nftDownloadName}=exportsObject;
test('private upload names retain their original extension and remove only the storage timestamp',()=>{
    assert.equal(nftDownloadName({name:'1792227247493-pic2.jpg',fileType:'image/jpeg'},0),'pic2.jpg');
    assert.equal(nftDownloadName({name:'Photo.JPEG',fileType:'image/jpeg'},0),'Photo.JPEG');
    assert.equal(nftDownloadName({name:'1792227247493-%E5%9B%BE%E7%89%87.jpg',fileType:'image/jpeg'},0),'图片.jpg');
});
test('old snapshots without names receive usable image, audio, font and model extensions',()=>{
    for(const [fileType,extension] of [['image/jpeg','jpg'],['image/png','png'],['audio/mpeg','mp3'],['font/ttf','ttf'],['model/gltf-binary','glb'],['application/zip','zip']])assert.equal(nftDownloadName({fileType},0),`original-1.${extension}`);
    assert.equal(nftDownloadName({},1),'original-2.bin');
    assert.equal(nftDownloadName({fileType:'application/octet-stream'},0,'1792227247493-source.blend'),'source.blend');
});
test('missing or incorrect image filename extensions are repaired from the immutable file type',()=>{
    assert.equal(nftDownloadName({name:'picture',fileType:'image/jpeg'},0),'picture.jpg');
    assert.equal(nftDownloadName({name:'picture.txt',fileType:'image/jpeg'},0),'picture.jpg');
});
test('ZIP filenames cannot introduce traversal paths and remain usable with Unicode names',()=>{
    assert.equal(nftDownloadName({name:'..%2F..%2Fpic2.jpg',fileType:'image/jpeg'},0),'pic2.jpg');
    assert.equal(nftDownloadName({name:'..',fileType:'image/jpeg'},0),'original-1.jpg');
    assert.equal(nftDownloadName({name:'声音.wav',fileType:'audio/wav'},0),'声音.wav');
    assert.ok(Buffer.byteLength(nftDownloadName({name:'图'.repeat(200)+'.jpg',fileType:'image/jpeg'},0))<=255);
});
