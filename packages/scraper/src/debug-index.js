/**
 * 目次ページのリンク構造を調査するデバッグスクリプト
 *
 * Usage: node packages/scraper/src/debug-index.js [target]
 */

import { readFile, readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', '..', '..', 'data', 'raw');

const target = process.argv[2] || 'sozoku';
const indexPath = join(DATA_DIR, target, 'index.html');

try {
  const html = await readFile(indexPath, 'utf-8');
  const $ = cheerio.load(html);

  console.log(`=== ${target} index.html ===`);
  console.log(`Title: ${$('title').text()}`);

  // 主要なコンテナ要素をチェック
  for (const sel of ['#contents', '#bodyArea', '#mainArea', '.contents_area', 'main', '#main']) {
    const el = $(sel);
    if (el.length) {
      const links = el.find('a[href]');
      console.log(`\n${sel}: found (${links.length} links)`);
      links.each((i, a) => {
        if (i < 20) console.log(`  ${$(a).attr('href')} → ${$(a).text().trim().substring(0, 60)}`);
      });
      if (links.length > 20) console.log(`  ... and ${links.length - 20} more`);
    }
  }

  // 全aタグも確認
  const allLinks = $('a[href]');
  console.log(`\nTotal <a> tags on page: ${allLinks.length}`);

  // .htm リンクだけ抽出
  const htmLinks = [];
  allLinks.each((i, a) => {
    const href = $(a).attr('href');
    if (href && href.includes('.htm') && !href.includes('#')) {
      htmLinks.push(href);
    }
  });
  console.log(`.htm links: ${htmLinks.length}`);
  htmLinks.forEach((href) => console.log(`  ${href}`));
} catch (err) {
  console.error(`Cannot read ${indexPath}: ${err.message}`);

  // rawディレクトリの中身を確認
  try {
    const files = await readdir(join(DATA_DIR, target));
    console.log(`\nFiles in ${target}/:`, files);
  } catch {
    console.log(`No directory: ${join(DATA_DIR, target)}`);
  }
}
