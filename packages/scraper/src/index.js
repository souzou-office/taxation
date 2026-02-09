/**
 * 国税庁通達スクレイパー (Playwright版)
 *
 * NTAサイトから通達HTMLをヘッドレスブラウザで取得して data/raw/ に保存する。
 * Shift_JIS → UTF-8 変換もここで行う。
 *
 * Usage: node packages/scraper/src/index.js [target]
 *   target: shotoku, hojin, sozoku, shohi, hyoka, sochiho (default: shotoku)
 *
 * 事前に: npx playwright install chromium
 */

import { mkdir, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', '..', '..', 'data', 'raw');

// 通達の目次ページ一覧
const TSUTATSU_INDEX = {
  shotoku: {
    name: '所得税基本通達',
    indexUrl: 'https://www.nta.go.jp/law/tsutatsu/kihon/shotoku/01.htm',
    baseUrl: 'https://www.nta.go.jp/law/tsutatsu/kihon/shotoku/',
  },
  hojin: {
    name: '法人税基本通達',
    indexUrl: 'https://www.nta.go.jp/law/tsutatsu/kihon/hojin/01.htm',
    baseUrl: 'https://www.nta.go.jp/law/tsutatsu/kihon/hojin/',
  },
  sozoku: {
    name: '相続税法基本通達',
    indexUrl: 'https://www.nta.go.jp/law/tsutatsu/kihon/sisan/sozoku2/01.htm',
    baseUrl: 'https://www.nta.go.jp/law/tsutatsu/kihon/sisan/sozoku2/',
  },
  shohi: {
    name: '消費税法基本通達',
    indexUrl: 'https://www.nta.go.jp/law/tsutatsu/kihon/shohi/01.htm',
    baseUrl: 'https://www.nta.go.jp/law/tsutatsu/kihon/shohi/',
  },
  hyoka: {
    name: '財産評価基本通達',
    indexUrl: 'https://www.nta.go.jp/law/tsutatsu/kihon/sisan/hyoka_new/01.htm',
    baseUrl: 'https://www.nta.go.jp/law/tsutatsu/kihon/sisan/hyoka_new/',
  },
  sochiho: {
    name: '租税特別措置法通達（相続税）',
    indexUrl: 'https://www.nta.go.jp/law/tsutatsu/kobetsu/sozoku/sochiho/080708/01.htm',
    baseUrl: 'https://www.nta.go.jp/law/tsutatsu/kobetsu/sozoku/sochiho/080708/',
  },
};

// リクエスト間の待機時間 (ms)
const DELAY = 2000;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function scrapeTarget(target) {
  const config = TSUTATSU_INDEX[target];
  const outDir = join(DATA_DIR, target);
  await mkdir(outDir, { recursive: true });

  console.log(`\n========================================`);
  console.log(`Scraping: ${config.name} (${target})`);
  console.log(`Output: ${outDir}`);
  console.log(`========================================`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    locale: 'ja-JP',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  try {
    // 1. 目次ページからリンク一覧を取得
    console.log(`Fetching index: ${config.indexUrl}`);
    const indexPage = await context.newPage();
    await indexPage.goto(config.indexUrl, { waitUntil: 'domcontentloaded' });

    // 目次ページのHTMLを保存
    const indexHtml = await indexPage.content();
    await writeFile(join(outDir, 'index.html'), indexHtml, 'utf-8');

    // 通達本文ページへのリンクを抽出
    const links = await indexPage.evaluate((baseUrl) => {
      const anchors = document.querySelectorAll('#contents a, #bodyArea a');
      const urls = [];
      for (const a of anchors) {
        const href = a.getAttribute('href');
        if (!href) continue;
        // 相対URL → 絶対URL
        const url = new URL(href, document.location.href).href;
        // 通達本文ページのみ（同じディレクトリ配下の.htmファイル）
        if (url.includes('.htm') && !url.includes('#') && url !== document.location.href) {
          urls.push(url);
        }
      }
      return [...new Set(urls)];
    }, config.baseUrl);

    console.log(`Found ${links.length} pages`);
    await indexPage.close();

    // 2. 各ページを取得して保存
    for (let i = 0; i < links.length; i++) {
      const url = links[i];
      const relativePath = url.replace(config.baseUrl, '');
      const filename = relativePath.replace(/\//g, '_');
      console.log(`  [${i + 1}/${links.length}] ${filename}`);

      try {
        const page = await context.newPage();
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

        const html = await page.content();
        await writeFile(join(outDir, filename), html, 'utf-8');
        await page.close();
      } catch (err) {
        console.error(`  Failed: ${err.message}`);
      }

      if (i < links.length - 1) {
        await sleep(DELAY);
      }
    }

    console.log(`Done: ${links.length} pages saved for ${target}`);
    return links.length;
  } finally {
    await browser.close();
  }
}

async function main() {
  const target = process.argv[2] || 'shotoku';

  if (target === 'all') {
    // 全通達を順番にスクレイピング
    const targets = Object.keys(TSUTATSU_INDEX);
    console.log(`Scraping all targets: ${targets.join(', ')}`);
    const results = {};
    for (const t of targets) {
      results[t] = await scrapeTarget(t);
    }
    console.log(`\n========================================`);
    console.log(`All done!`);
    for (const [t, count] of Object.entries(results)) {
      console.log(`  ${t}: ${count} pages`);
    }
    return;
  }

  const config = TSUTATSU_INDEX[target];
  if (!config) {
    console.error(`Unknown target: ${target}`);
    console.error(`Available: ${Object.keys(TSUTATSU_INDEX).join(', ')}, all`);
    process.exit(1);
  }

  await scrapeTarget(target);
}

main();
