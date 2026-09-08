import express from 'express';
import cors from 'cors';
import multer from 'multer';
import admin from 'firebase-admin';
import {S3Client,HeadBucketCommand,CreateBucketCommand,ListObjectsV2Command,PutObjectCommand,DeleteObjectCommand,GetObjectCommand} from '@aws-sdk/client-s3';
import {getSignedUrl} from '@aws-sdk/s3-request-presigner';

const app=express();
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:5*1024*1024*1024}});
const PORT=Number(process.env.PORT||8787);
const BUCKET=process.env.S3_BUCKET||'aitherfiles';
const ORIGIN=process.env.AITHERFILES_ORIGIN||'*';
const ENDPOINT=process.env.S3_ENDPOINT||'https://files.fsd1.gozunga.com';
const REGION=process.env.S3_REGION||'SiouxFalls';
if(!process.env.FIREBASE_SERVICE_ACCOUNT_JSON)throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is required');
if(!process.env.S3_ACCESS_KEY||!process.env.S3_SECRET_KEY)throw new Error('S3_ACCESS_KEY and S3_SECRET_KEY are required');
admin.initializeApp({credential:admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON))});
const s3=new S3Client({endpoint:ENDPOINT,region:REGION,forcePathStyle:true,credentials:{accessKeyId:process.env.S3_ACCESS_KEY,secretAccessKey:process.env.S3_SECRET_KEY},forcePathStyle:true});
app.use(cors({origin:ORIGIN==='*'?true:ORIGIN}));
app.use(express.json());
async function auth(req,res,next){try{const h=req.headers.authorization||'';if(!h.startsWith('Bearer '))return res.status(401).json({error:'Missing Firebase ID token'});req.user=await admin.auth().verifyIdToken(h.slice(7));next()}catch{res.status(401).json({error:'Invalid or expired Firebase ID token'})}}
const safeName=n=>String(n||'file').replace(/[\\/#?%*:|"<>]/g,'_').slice(0,180)||'file';
const prefix=uid=>`users/${uid}/`;
const keyFor=(uid,n)=>`${prefix(uid)}${Date.now()}-${crypto.randomUUID()}-${safeName(n)}`;
async function ensureBucket(){try{await s3.send(new HeadBucketCommand({Bucket:BUCKET}))}catch(e){if(e.$metadata?.httpStatusCode===404||e.name==='NotFound'||e.name==='NoSuchBucket')await s3.send(new CreateBucketCommand({Bucket:BUCKET}));else throw e}}
app.get('/health',async(_req,res)=>{try{await ensureBucket();res.json({ok:true,storage:'Gozunga',s3Compatible:true,endpoint:ENDPOINT})}catch(e){res.status(503).json({ok:false,error:e.message})}});
app.get('/files',auth,async(req,res)=>{try{await ensureBucket();const out=await s3.send(new ListObjectsV2Command({Bucket:BUCKET,Prefix:prefix(req.user.uid)}));const files=(out.Contents||[]).filter(o=>o.Key).map(o=>({key:o.Key,name:o.Key.split('/').pop().replace(/^\d+-[0-9a-f-]+-/,'') ,size:Number(o.Size||0),added:o.LastModified||null,type:'application/octet-stream'}));res.json({files})}catch(e){res.status(500).json({error:e.message})}});
app.post('/files',auth,upload.single('file'),async(req,res)=>{try{if(!req.file)return res.status(400).json({error:'No file uploaded'});await ensureBucket();const key=keyFor(req.user.uid,req.file.originalname);await s3.send(new PutObjectCommand({Bucket:BUCKET,Key:key,Body:req.file.buffer,ContentLength:req.file.size,ContentType:req.file.mimetype||'application/octet-stream'}));res.status(201).json({key,name:safeName(req.file.originalname),size:req.file.size})}catch(e){res.status(500).json({error:e.message})}});
app.get('/files/:key/url',auth,async(req,res)=>{try{const key=decodeURIComponent(req.params.key);if(!key.startsWith(prefix(req.user.uid)))return res.status(403).json({error:'Forbidden'});const url=await getSignedUrl(s3,new GetObjectCommand({Bucket:BUCKET,Key:key}),{expiresIn:900});res.json({url})}catch(e){res.status(404).json({error:'File not found'})}});
app.delete('/files/:key',auth,async(req,res)=>{try{const key=decodeURIComponent(req.params.key);if(!key.startsWith(prefix(req.user.uid)))return res.status(403).json({error:'Forbidden'});await s3.send(new DeleteObjectCommand({Bucket:BUCKET,Key:key}));res.status(204).end()}catch(e){res.status(500).json({error:e.message})}});
app.listen(PORT,()=>console.log(`AitherFiles Gozunga S3 API listening on ${PORT}`));
