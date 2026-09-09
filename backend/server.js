import express from 'express';
import cors from 'cors';
import multer from 'multer';
import admin from 'firebase-admin';

const app=express();
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:5*1024*1024*1024}});
const PORT=Number(process.env.PORT||8787);
const ORIGIN=process.env.AITHERFILES_ORIGIN||'*';

if(!process.env.FIREBASE_SERVICE_ACCOUNT_JSON)throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is required');
if(!process.env.FIREBASE_STORAGE_BUCKET)throw new Error('FIREBASE_STORAGE_BUCKET is required');

admin.initializeApp({
  credential:admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)),
  storageBucket:process.env.FIREBASE_STORAGE_BUCKET
});

const bucket=admin.storage().bucket();
app.use(cors({origin:ORIGIN==='*'?true:ORIGIN}));
app.use(express.json());

async function auth(req,res,next){
  try{
    const h=req.headers.authorization||'';
    if(!h.startsWith('Bearer '))return res.status(401).json({error:'Missing Firebase ID token'});
    req.user=await admin.auth().verifyIdToken(h.slice(7));
    next();
  }catch{
    res.status(401).json({error:'Invalid or expired Firebase ID token'});
  }
}

const safeName=n=>String(n||'file').replace(/[\\/#?%*:|"<>]/g,'_').slice(0,180)||'file';
const prefix=uid=>`users/${uid}/`;
const keyFor=(uid,n)=>`${prefix(uid)}${Date.now()}-${crypto.randomUUID()}-${safeName(n)}`;

app.get('/health',async(_req,res)=>{
  try{
    await bucket.getFiles({maxResults:1});
    res.json({ok:true,storage:'Firebase Storage'});
  }catch(e){
    res.status(503).json({ok:false,error:e.message});
  }
});

app.get('/files',auth,async(req,res)=>{
  try{
    const [files]=await bucket.getFiles({prefix:prefix(req.user.uid)});
    res.json({files:files.map(file=>({
      key:file.name,
      name:file.name.split('/').pop().replace(/^\d+-[0-9a-f-]+-/,'') ,
      size:Number(file.metadata?.size||0),
      added:file.metadata?.timeCreated||null,
      type:file.metadata?.contentType||'application/octet-stream'
    }))});
  }catch(e){
    res.status(500).json({error:e.message});
  }
});

app.post('/files',auth,upload.single('file'),async(req,res)=>{
  try{
    if(!req.file)return res.status(400).json({error:'No file uploaded'});
    const key=keyFor(req.user.uid,req.file.originalname);
    const file=bucket.file(key);
    await file.save(req.file.buffer,{
      resumable:false,
      metadata:{contentType:req.file.mimetype||'application/octet-stream'}
    });
    res.status(201).json({key,name:safeName(req.file.originalname),size:req.file.size});
  }catch(e){
    res.status(500).json({error:e.message});
  }
});

app.get('/files/:key/url',auth,async(req,res)=>{
  try{
    const key=decodeURIComponent(req.params.key);
    if(!key.startsWith(prefix(req.user.uid)))return res.status(403).json({error:'Forbidden'});
    const [url]=await bucket.file(key).getSignedUrl({
      action:'read',
      expires:Date.now()+15*60*1000
    });
    res.json({url});
  }catch(e){
    res.status(404).json({error:'File not found'});
  }
});

app.delete('/files/:key',auth,async(req,res)=>{
  try{
    const key=decodeURIComponent(req.params.key);
    if(!key.startsWith(prefix(req.user.uid)))return res.status(403).json({error:'Forbidden'});
    await bucket.file(key).delete({ignoreNotFound:true});
    res.status(204).end();
  }catch(e){
    res.status(500).json({error:e.message});
  }
});

app.listen(PORT,()=>console.log(`AitherFiles Firebase Storage API listening on ${PORT}`));
