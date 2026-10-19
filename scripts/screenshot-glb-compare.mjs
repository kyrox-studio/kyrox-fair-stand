/**
 * Her public/models/*.glb için origin/main (önce) vs çalışma ağacı (sonra) ekran görüntüsü.
 * Çıktı: audit/evidence/p0m-glb-compare/{before,after}/<name>.png
 */
import { createServer } from 'node:http';
import { readFileSync, mkdirSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outRoot = path.join(root, 'audit', 'evidence', 'p0m-glb-compare');
const modelsDir = path.join(root, 'public', 'models');

const HTML = `<!doctype html>
<html><head><meta charset="utf-8"><style>
html,body{margin:0;height:100%;background:#2a2a2e}
canvas{display:block;width:100%;height:100%}
</style></head><body>
<script type="importmap">{"imports":{
  "three":"https://unpkg.com/three@0.184.0/build/three.module.js",
  "three/addons/":"https://unpkg.com/three@0.184.0/examples/jsm/"
}}</script>
<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
try {
  const params = new URLSearchParams(location.search);
  const url = params.get('url');
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2a2a2e);
  const camera = new THREE.PerspectiveCamera(40, innerWidth/innerHeight, 0.01, 100);
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(1);
  document.body.appendChild(renderer.domElement);
  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const dir = new THREE.DirectionalLight(0xffffff, 1.1);
  dir.position.set(2, 4, 3);
  scene.add(dir);
  const controls = new OrbitControls(camera, renderer.domElement);
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  await MeshoptDecoder.ready;
  const gltf = await loader.loadAsync(url);
  const rootObj = gltf.scene;
  scene.add(rootObj);
  const box = new THREE.Box3().setFromObject(rootObj);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  rootObj.position.sub(center);
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  camera.position.set(maxDim * 1.4, maxDim * 1.1, maxDim * 1.6);
  controls.target.set(0, 0, 0);
  controls.update();
  renderer.render(scene, camera);
  window.__SHOT_READY__ = true;
} catch (error) {
  console.error(error);
  document.body.textContent = String(error);
  window.__SHOT_ERROR__ = String(error);
  window.__SHOT_READY__ = false;
}
</script></body></html>`;

function listGlbs() {
  return readdirSync(modelsDir).filter((n) => n.toLowerCase().endsWith('.glb')).sort();
}

function contentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.glb')) return 'model/gltf-binary';
  if (filePath.endsWith('.js')) return 'text/javascript';
  return 'application/octet-stream';
}

async function main() {
  const glbs = listGlbs();
  mkdirSync(path.join(outRoot, 'before'), { recursive: true });
  mkdirSync(path.join(outRoot, 'after'), { recursive: true });

  const beforeDir = path.join(outRoot, '_before_models');
  mkdirSync(beforeDir, { recursive: true });
  const sizes = [];

  for (const name of glbs) {
    const afterPath = path.join(modelsDir, name);
    const beforePath = path.join(beforeDir, name);
    const buf = execFileSync('git', ['show', `origin/main:public/models/${name}`], { maxBuffer: 64 * 1024 * 1024 });
    writeFileSync(beforePath, buf);
    sizes.push({
      file: name,
      beforeBytes: buf.length,
      afterBytes: statSync(afterPath).size,
    });
  }

  const viewerPath = path.join(outRoot, 'viewer.html');
  writeFileSync(viewerPath, HTML);

  const server = createServer((req, res) => {
    const u = new URL(req.url, 'http://127.0.0.1');
    let filePath;
    if (u.pathname === '/' || u.pathname === '/viewer.html') filePath = viewerPath;
    else if (u.pathname.startsWith('/before/')) filePath = path.join(beforeDir, path.basename(u.pathname));
    else if (u.pathname.startsWith('/after/')) filePath = path.join(modelsDir, path.basename(u.pathname));
    else {
      res.writeHead(404);
      res.end('missing');
      return;
    }
    try {
      const body = readFileSync(filePath);
      res.writeHead(200, {
        'Content-Type': contentType(filePath),
        'Access-Control-Allow-Origin': '*',
      });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end('missing');
    }
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });

  for (const name of glbs) {
    for (const side of ['before', 'after']) {
      const url = `http://127.0.0.1:${port}/viewer.html?url=/${side}/${encodeURIComponent(name)}`;
      page.on('pageerror', (err) => console.error('pageerror', side, name, err.message));
      page.on('console', (msg) => {
        if (msg.type() === 'error') console.error('console', side, name, msg.text());
      });
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120_000 });
      await page.waitForFunction(() => window.__SHOT_READY__ === true, null, { timeout: 180_000 });
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(outRoot, side, `${name}.png`) });
      console.log('shot', side, name);
    }
  }

  await browser.close();
  server.close();

  const report = [
    '# P0-M GLB önce/sonra',
    '',
    '| Dosya | Önce | Sonra | Kalan |',
    '|---|---:|---:|---:|',
    ...sizes.map((row) => {
      const keep = row.afterBytes / row.beforeBytes;
      return `| ${row.file} | ${(row.beforeBytes / 1024 / 1024).toFixed(2)} MB | ${(row.afterBytes / 1024 / 1024).toFixed(2)} MB | %${Math.round(keep * 100)} |`;
    }),
    '',
    `Toplam: ${(sizes.reduce((s, r) => s + r.beforeBytes, 0) / 1024 / 1024).toFixed(2)} → ${(sizes.reduce((s, r) => s + r.afterBytes, 0) / 1024 / 1024).toFixed(2)} MB`,
    '',
    'PNG: `before/<file>.png`, `after/<file>.png`.',
    '',
  ].join('\n');
  writeFileSync(path.join(outRoot, 'README.md'), report);
  console.log('done', outRoot);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
