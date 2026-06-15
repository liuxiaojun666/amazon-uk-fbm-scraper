import express from 'express';
import { readdirSync } from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const releaseDir = path.join(root, 'release');
const port = Number(process.env.RELEASE_PORT) || 8765;
const host = '0.0.0.0';

const zips = readdirSync(releaseDir)
  .filter((name) => name.endsWith('.zip'))
  .sort();

if (zips.length === 0) {
  console.error('release/ 目录下没有 zip，请先运行: npm run pack');
  process.exit(1);
}

const zipName = zips[zips.length - 1];

function lanAddresses() {
  const addrs = [];
  for (const interfaces of Object.values(os.networkInterfaces())) {
    for (const net of interfaces || []) {
      const isIPv4 = net.family === 'IPv4' || net.family === 4;
      if (isIPv4 && !net.internal) {
        addrs.push(net.address);
      }
    }
  }
  return [...new Set(addrs)];
}

const app = express();

app.get('/', (_req, res) => {
  res.type('html').send(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>项目下载</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 32rem; margin: 4rem auto; padding: 0 1rem; }
    a { display: inline-block; margin-top: 1rem; padding: .75rem 1.25rem; background: #ff9900; color: #111; text-decoration: none; border-radius: 6px; font-weight: 600; }
    p { color: #555; line-height: 1.6; }
  </style>
</head>
<body>
  <h1>Amazon UK Scraper</h1>
  <p>局域网内设备可点击下方按钮下载安装包。</p>
  <a href="/${zipName}" download>${zipName}</a>
</body>
</html>`);
});

app.use(
  express.static(releaseDir, {
    index: false,
    dotfiles: 'deny',
    setHeaders(res, filePath) {
      if (filePath.endsWith('.zip')) {
        res.setHeader('Content-Disposition', `attachment; filename="${path.basename(filePath)}"`);
      }
    },
  })
);

app.listen(port, host, () => {
  const ips = lanAddresses();
  console.log(`\n静态下载服务已启动（仅 release/ 中的 zip）\n`);
  console.log(`  本机: http://127.0.0.1:${port}/`);
  if (ips.length === 0) {
    console.log('  局域网: 未检测到 IPv4 地址，请确认已连接 WiFi');
  } else {
    for (const ip of ips) {
      console.log(`  局域网: http://${ip}:${port}/`);
    }
  }
  console.log(`\n  文件: ${zipName}`);
  console.log('  按 Ctrl+C 停止服务\n');
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`端口 ${port} 已被占用，可换端口: RELEASE_PORT=9000 npm run serve-release`);
  } else {
    console.error(err.message);
  }
  process.exit(1);
});
