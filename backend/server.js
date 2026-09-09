import express from 'express';
import cors from 'cors';

const app = express();
const PORT = Number(process.env.PORT || 8787);
const ORIGIN = process.env.AITHERFILES_ORIGIN || '*';
const BACKEND = (process.env.AITHER_BACKEND_URL || 'https://aitherbackendnew.onrender.com').replace(/\/$/, '');

app.use(cors({ origin: ORIGIN === '*' ? true : ORIGIN }));

function authHeaders(req) {
  const authorization = req.headers.authorization;
  return authorization ? { authorization } : {};
}

async function proxyJson(req, res, path, init = {}) {
  try {
    const response = await fetch(`${BACKEND}${path}`, {
      ...init,
      headers: { ...authHeaders(req), ...(init.headers || {}) }
    });
    const text = await response.text();
    res.status(response.status);
    const contentType = response.headers.get('content-type');
    if (contentType) res.set('content-type', contentType);
    res.send(text);
  } catch {
    res.status(502).json({ error: 'AitherBackendNew is unavailable.' });
  }
}

app.get('/health', async (req, res) => {
  await proxyJson(req, res, '/api/storage/health');
});

app.get('/files', async (req, res) => {
  await proxyJson(req, res, '/api/storage/files');
});

// Stream multipart uploads directly to AitherBackendNew instead of buffering
// the entire file in AitherFiles.
app.post('/files', async (req, res) => {
  try {
    const response = await fetch(`${BACKEND}/api/storage/files`, {
      method: 'POST',
      headers: {
        ...authHeaders(req),
        'content-type': req.headers['content-type'] || ''
      },
      body: req,
      duplex: 'half'
    });
    const text = await response.text();
    res.status(response.status);
    const contentType = response.headers.get('content-type');
    if (contentType) res.set('content-type', contentType);
    res.send(text);
  } catch {
    res.status(502).json({ error: 'AitherBackendNew is unavailable.' });
  }
});

app.get('/files/:key/url', async (req, res) => {
  const key = decodeURIComponent(req.params.key);
  await proxyJson(req, res, `/api/storage/files/url?key=${encodeURIComponent(key)}`);
});

app.delete('/files/:key', async (req, res) => {
  const key = decodeURIComponent(req.params.key);
  await proxyJson(req, res, `/api/storage/files?key=${encodeURIComponent(key)}`, { method: 'DELETE' });
});

app.listen(PORT, () => console.log(`AitherFiles proxy listening on ${PORT}; storage is handled by AitherBackendNew`));
