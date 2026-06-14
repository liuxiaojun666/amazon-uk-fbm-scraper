import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import dotenv from 'dotenv';
import { jobManager } from './job-manager.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.WEB_PORT) || 3456;

const app = express();
app.use(express.json());
app.use(express.static(path.join(ROOT, 'public')));

function parseJobOptions(body) {
  const keyword = String(body.keyword || '').trim();
  if (!keyword) {
    return { error: 'keyword is required' };
  }

  const options = {
    keyword,
    fulfillment: body.fulfillment || 'fbm',
    limit: body.limit != null && body.limit !== '' ? Number(body.limit) : 0,
    minPrice: body.minPrice != null && body.minPrice !== '' ? Number(body.minPrice) : undefined,
    maxPrice: body.maxPrice != null && body.maxPrice !== '' ? Number(body.maxPrice) : undefined,
    minDeliveryDays:
      body.minDeliveryDays != null && body.minDeliveryDays !== ''
        ? Number(body.minDeliveryDays)
        : undefined,
    maxDeliveryDays:
      body.maxDeliveryDays != null && body.maxDeliveryDays !== ''
        ? Number(body.maxDeliveryDays)
        : undefined,
    allFbm: Boolean(body.allFbm),
    provinceMode: body.provinceMode || 'include',
    excludeProvinces: body.excludeProvinces,
    headed: Boolean(body.headed),
    skipProxyCheck: Boolean(body.skipProxyCheck),
    noPostcode: Boolean(body.noPostcode),
    postcode: body.postcode?.trim() || undefined,
  };

  return { options };
}

app.get('/api/jobs/current', (_req, res) => {
  const running = jobManager.getRunningJob();
  const job = running || jobManager.lastJob;
  if (!job) {
    return res.json({ job: null });
  }
  res.json({ job: jobManager.sanitizeJob(job) });
});

app.post('/api/jobs', (req, res) => {
  const parsed = parseJobOptions(req.body);
  if (parsed.error) {
    return res.status(400).json({ error: parsed.error });
  }

  const result = jobManager.createJob(parsed.options);
  if (result.error) {
    return res.status(result.status).json({ error: result.error });
  }

  res.status(201).json({ job: result.job });
});

app.get('/api/jobs/:id', (req, res) => {
  const job = jobManager.getJob(req.params.id);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  res.json({ job: jobManager.sanitizeJob(job) });
});

app.post('/api/jobs/:id/cancel', (req, res) => {
  const result = jobManager.cancelJob(req.params.id);
  if (result.error) {
    return res.status(result.status).json({ error: result.error });
  }
  res.json({ job: result.job });
});

app.get('/api/jobs/:id/stream', (req, res) => {
  const job = jobManager.getJob(req.params.id);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const send = (event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  const unsubscribe = jobManager.subscribe(req.params.id, send);

  req.on('close', () => {
    unsubscribe?.();
  });
});

app.get('/api/jobs/:id/download/:format', (req, res) => {
  const job = jobManager.getJob(req.params.id);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  const format = req.params.format;
  const filePath = format === 'csv' ? job.csvPath : format === 'json' ? job.jsonPath : null;

  if (!filePath) {
    return res.status(400).json({ error: 'Invalid format, use json or csv' });
  }

  res.download(filePath, path.basename(filePath), (err) => {
    if (err && !res.headersSent) {
      res.status(404).json({ error: 'File not found' });
    }
  });
});

app.listen(PORT, () => {
  console.log(`Amazon scraper web UI: http://localhost:${PORT}`);
  if (process.env.HTTP_PROXY) {
    console.log(`Proxy: ${process.env.HTTP_PROXY}`);
  }
});
