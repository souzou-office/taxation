/**
 * 国税庁通達スクレイパー
 *
 * NTAサイトから通達HTMLを取得して data/ に保存する。
 * 取得後、parse.js でチャンキング・JSON化する。
 */

import { mkdir, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', '..', '..', 'data', 'raw');

// 通達の目次ページ一覧
const TSUTATSU_INDEX = {
  shotoku: {
    name: '所得税基本通達',
    indexUrl: 'https://www.nta.go.jp/law/tsutatsu/kihon/shotoku/01.htm',
  },
  hojin: {
    name: '法人税基本通達',
    indexUrl: 'https://www.nta.go.jp/law/tsutatsu/kihon/hojin/01.htm',
  },
  sozoku: {
    name: '相続税法基本通達',
    indexUrl: 'https://www.nta.go.jp/law/tsutatsu/kihon/sisan/sozoku/01.htm',
  },
  shohi: {
    name: '消費税法基本通達',
    indexUrl: 'https://www.nta.go.jp/law/tsutatsu/kihon/shohi/01.htm',
  },
  hyoka: {
    name: '財産評価基本通達',
    indexUrl: 'https://www.nta.go.jp/law/tsutatsu/kihon/sisan/hyoka/01.htm',
  },
};

async function fetchPage(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'ja,en;q=0.9',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.text();
}

async function main() {
  const target = process.argv[2] || 'shotoku';
  const config = TSUTATSU_INDEX[target];
  if (!config) {
    console.error(`Unknown target: ${target}`);
    console.error(`Available: ${Object.keys(TSUTATSU_INDEX).join(', ')}`);
    process.exit(1);
  }

  console.log(`Scraping: ${config.name}`);
  const outDir = join(DATA_DIR, target);
  await mkdir(outDir, { recursive: true });

  // TODO: 目次ページからリンク一覧を取得→各ページをfetch→保存
  console.log(`Fetching index: ${config.indexUrl}`);
  try {
    const html = await fetchPage(config.indexUrl);
    const outPath = join(outDir, 'index.html');
    await writeFile(outPath, html, 'utf-8');
    console.log(`Saved: ${outPath}`);
  } catch (err) {
    console.error(`Failed: ${err.message}`);
  }
}

main();
