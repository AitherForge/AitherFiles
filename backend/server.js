import express from 'express';
import cors from 'cors';
import multer from 'multer';
import admin from 'firebase-admin';
import { Client } from 'minio';

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 * 1024 } });
const PORT = Number(process.env.PORT || 8787);
const BUCKET = process.env.MINIO_BUCKET || 'aitherfiles';
const ORIGIN = process.env.AITHERFILES_ORIGIN || '*';

if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is required');
}
if (!process.env.MINIO_ENDPOINT || !process.env.MINIO_ACCESS_KEY || !process.env.MINIO_SECRET_KEY) {
  throw new Error('MINIO_ENDPOINT, MINIO_ACCESS_KEY and MINIO_SECRET_KEY are required');
}

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)) });

const minio = new Client({
  endPoint: process.env.MINIO_ENDPOINT,
  port: Number(process.env.MINIO_PORT || 443),
  useSSL: String(process.env.MINIO_USE_SSL || 'true') === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY,
  secretKey: process.env.MINIO_SECRET_KEY
});

app.use(cors({ origin: ORIGIN === '*' ? true : ORIGIN }));
app.use(express.json());

async function auth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing Firebase ID token' });
    req.user = await admin.auth().verifyIdToken(header.slice(7));
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired Firebase ID token' });
  }
}

const safeName = name => String(name || 'file').replace(/[\\/#?%*:|"<>]/g, '_').slice(0, 180) || 'file';
const prefixFor = uid => `users/${uid}/`;
const keyFor = (uid, name) => `${prefixFor(uid)}${Date.now()}-${crypto.randomUUID()}-${safeName(name)}`;

async function ensureBucket() {
  if (!(await minio.bucketExists(BUCKET))) await minio.makeBucket(BUCKET);
}

app.get('/health', async (_req, res) => {
  try { await ensureBucket(); res.json({ ok: true, storage: 'minio' }); }
  catch (e) { res.status(503).json({ ok: false, error: e.message }); }
});

app.get('/files', auth, async (req, res) => {
  try {
    const items = [];
    const stream = minio.listObjectsV2(BUCKET, prefixFor(req.user.uid), true);
    for await (const obj of stream) {
      if (!obj.name) continue;
      const name = obj.name.split('/').pop().replace(/^\d+-[0-9a-f-]+-/, '');
      items.push({ key: obj.name, name, size: Number(obj.size || 0), added: obj.lastModified || null, type: 'application/octet-stream' });
    }
    res.json({ files: items });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/files', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    await ensureBucket();
    const key = keyFor(req.user.uid, req.file.originalname);
    await minio.putObject(BUCKET, key, req.file.buffer, req.file.size, { 'Content-Type': req.file.mimetype || 'application/octet-stream' });
    res.status(201).json({ key, name: safeName(req.file.originalname), size: req.file.size });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/files/:key/url', auth, async (req, res) => {
  try {
    const key = decodeURIComponent(req.params.key);
    if (!key.startsWith(prefixFor(req.user.uid))) return res.status(403).json({ error: 'Forbidden' });
    const url = await minio.presignedGetObject(BUCKET, key, 15 * 60);
    res.json({ url });
  } catch (e) { res.status(404).json({ error: 'File not found' }); }
});

app.delete('/files/:key', auth, async (req, res) => {
  try {
    const key = decodeURIComponent(req.params.key);
    if (!key.startsWith(prefixFor(req.user.uid))) return res.status(403).json({ error: 'Forbidden' });
    await minio.removeObject(BUCKET, key);
    res.status(204).end();
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(PORT, () => console.log(`AitherFiles MinIO API listening on ${PORT}`));
