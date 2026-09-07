import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import Busboy from 'busboy';

const PORT = Number(process.env.PORT || 10000);
const ROOT = process.env.AITHERFILES_STORAGE || path.join(process.cwd(), 'storage');
const MAX_STORAGE = 3 * 1024 * 1024 * 1024;
const PUBLIC = process.cwd();
fs.mkdirSync(ROOT, { recursive: true });

const safeId = id => /^[a-f0-9-]{16,128}$/i.test(id || '') ? id : null;
const userRoot = id => path.join(ROOT, id);
const usedBytes = async id => {
  const dir = userRoot(id); let total = 0;
  if (!fs.existsSync(dir)) return 0;
  for (const name of await fs.promises.readdir(dir)) {
    const st = await fs.promises.stat(path.join(dir, name));
    if (st.isFile()) total += st.size;
  }
  return total;
};
const json = (res, status, data) => { res.writeHead(status, {'content-type':'application/json; charset=utf-8','access-control-allow-origin':'*'}); res.end(JSON.stringify(data)); };
const fileName = name => path.basename(name).replace(/[\0<>:"/\\|?*]/g, '_').slice(0,180) || 'file';

async function upload(req, res, id) {
  const current = await usedBytes(id);
  const bb = Busboy({headers:req.headers, limits:{files:1, fileSize:MAX_STORAGE-current}});
  let saved = null, size = 0, error = null;
  await fs.promises.mkdir(userRoot(id), {recursive:true});
  bb.on('file', (_field, stream, info) => {
    const name = fileName(info.filename); const target = path.join(userRoot(id), `${crypto.randomUUID()}-${name}`);
    saved = {name, type:info.mimeType || 'application/octet-stream', target};
    const out = fs.createWriteStream(target);
    stream.on('data', chunk => { size += chunk.length; });
    stream.on('limit', () => { error = '3 GB storage limit reached'; stream.resume(); });
    stream.pipe(out);
    out.on('error', e => { error = e.message; });
  });
  bb.on('error', e => { error = e.message; });
  bb.on('finish', async () => {
    if (error || !saved) { if (saved?.target) fs.promises.rm(saved.target,{force:true}); return json(res, 400, {error:error || 'No file supplied'}); }
    json(res, 201, {name:saved.name, type:saved.type, size, id:path.basename(saved.target), added:Date.now()});
  });
  req.pipe(bb);
}

const server = http.createServer(async (req,res) => {
  const u = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === 'OPTIONS') { res.writeHead(204, {'access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,DELETE,OPTIONS','access-control-allow-headers':'content-type,x-aither-user'}); return res.end(); }
  const id = safeId(req.headers['x-aither-user']);
  if (u.pathname.startsWith('/api/')) {
    if (!id) return json(res,400,{error:'Missing X-Aither-User'});
    if (u.pathname === '/api/storage' && req.method === 'GET') return json(res,200,{used:await usedBytes(id), limit:MAX_STORAGE});
    if (u.pathname === '/api/files' && req.method === 'GET') {
      const dir=userRoot(id); await fs.promises.mkdir(dir,{recursive:true}); const names=await fs.promises.readdir(dir); const files=[];
      for (const name of names) { const st=await fs.promises.stat(path.join(dir,name)); if(st.isFile()) files.push({id:name,name:name.replace(/^[0-9a-f-]{36}-/,''),size:st.size,added:st.mtimeMs,type:'application/octet-stream'}); }
      return json(res,200,{files});
    }
    if (u.pathname === '/api/files' && req.method === 'POST') return upload(req,res,id);
    if (u.pathname.startsWith('/api/files/') && req.method === 'DELETE') {
      const name=path.basename(u.pathname.slice('/api/files/'.length)); if(name.includes('..')) return json(res,400,{error:'Invalid file'});
      await fs.promises.rm(path.join(userRoot(id),name),{force:true}); return json(res,200,{ok:true});
    }
    return json(res,404,{error:'Not found'});
  }
  let p = u.pathname === '/' ? '/index.html' : u.pathname;
  p = path.join(PUBLIC,p);
  if (!p.startsWith(PUBLIC)) { res.writeHead(403); return res.end('Forbidden'); }
  try { const data=await fs.promises.readFile(p); const ext=path.extname(p); const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json'}; res.writeHead(200,{'content-type':types[ext]||'application/octet-stream'}); res.end(data); } catch { res.writeHead(404); res.end('Not found'); }
});
server.listen(PORT, '0.0.0.0', () => console.log(`AitherFiles cloud server listening on ${PORT}`));
