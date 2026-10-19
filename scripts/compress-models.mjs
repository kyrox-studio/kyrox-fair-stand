/**
 * public/models/*.glb → yalnız Meshopt (aynı dosya adı).
 * `optimize` kullanılmaz: malzeme/mesh birleştirme, dedup, join, palette yok.
 *
 * Kullanım: npm run compress:models
 *
 * Araç projeye bağımlılık olarak eklenmez: @gltf-transform/cli, yüksek seviye güvenlik
 * açığı olan braces/micromatch zincirini getirir ve CI'daki `npm audit` kapısını kırar.
 * Yalnız model yeniden sıkıştırılırken npx ile sabit sürümden indirilip çalıştırılır.
 */
import { spawnSync } from 'node:child_process';
import { readdirSync, statSync, copyFileSync, mkdtempSync, rmSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const modelsDir = path.join(root, 'public', 'models');
// Mevcut modeller bu sürümle sıkıştırıldı; aynı çıktıyı almak için sabit tutulur.
const GLTF_TRANSFORM_CLI = '@gltf-transform/cli@4.5.1';

// npx kabuk olmadan çalıştırılır (Windows'ta shell:true argümanları kaçışsız birleştirir).
// `npm run compress:models` npm_execpath verir; npx-cli.js aynı klasördedir.
function npxInvocation(args) {
  const npmCli = process.env.npm_execpath;
  if (npmCli && /npm-cli\.js$/i.test(npmCli)) {
    return { command: process.execPath, args: [path.join(path.dirname(npmCli), 'npx-cli.js'), ...args] };
  }
  if (process.platform === 'win32') {
    throw new Error("Windows'ta npm üzerinden çalıştır: npm run compress:models");
  }
  return { command: 'npx', args };
}

function listGlbs() {
  return readdirSync(modelsDir)
    .filter((name) => name.toLowerCase().endsWith('.glb'))
    .map((name) => ({
      name,
      abs: path.join(modelsDir, name),
      bytes: statSync(path.join(modelsDir, name)).size,
    }))
    .sort((a, b) => b.bytes - a.bytes);
}

function formatMb(bytes) {
  return (bytes / (1024 * 1024)).toFixed(2);
}

function compressOne(src, dest) {
  const { command, args } = npxInvocation(['--yes', GLTF_TRANSFORM_CLI, 'meshopt', src, dest, '--level', 'high']);
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.status !== 0) {
    const detail = [result.stderr, result.stdout].filter(Boolean).join('\n');
    throw new Error(`gltf-transform meshopt failed for ${path.basename(src)}:\n${detail}`);
  }
}

function main() {
  const glbs = listGlbs();
  if (glbs.length === 0) {
    console.error('public/models altında .glb yok.');
    process.exit(1);
  }

  const tmp = mkdtempSync(path.join(tmpdir(), 'fair-stand-compress-'));
  let beforeTotal = 0;
  let afterTotal = 0;

  console.log('Meshopt-only sıkıştırma (malzeme/mesh adları korunur)\n');
  try {
    for (const file of glbs) {
      beforeTotal += file.bytes;
      const out = path.join(tmp, file.name);
      compressOne(file.abs, out);
      const afterBytes = statSync(out).size;
      afterTotal += afterBytes;
      const keep = afterBytes / file.bytes;
      console.log(
        `${file.name.padEnd(40)} ${formatMb(file.bytes).padStart(7)} → ${formatMb(afterBytes).padStart(7)} MB  (kalan %${Math.round(keep * 100)})`,
      );
      copyFileSync(out, `${file.abs}.tmp`);
      renameSync(`${file.abs}.tmp`, file.abs);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  const save = 1 - afterTotal / beforeTotal;
  console.log(
    `\nTOPLAM  ${formatMb(beforeTotal)} → ${formatMb(afterTotal)} MB  (küçülme %${Math.round(save * 100)})`,
  );
}

main();
