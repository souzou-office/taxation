/**
 * HTMLファイルの構造を調査するデバッグスクリプト
 * Usage: node packages/scraper/src/debug.js [file]
 */
import { readFile, readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', '..', '..', 'data', 'raw');

async function debugFile(filePath) {
  const html = await readFile(filePath, 'utf-8');
  const $ = cheerio.load(html);

  console.log(`\n=== ${filePath} ===`);
  console.log(`File size: ${html.length} chars`);

  // bodyAreaの存在確認
  const bodyArea = $('#bodyArea');
  console.log(`#bodyArea found: ${bodyArea.length > 0}`);

  if (!bodyArea.length) {
    // 他のIDを探す
    console.log('Looking for alternative containers...');
    ['#contents', '#main', '.imp-cnt-tsutatsu', '#mainArea'].forEach(sel => {
      const el = $(sel);
      if (el.length) console.log(`  Found: ${sel} (${el.children().length} children)`);
    });
    return;
  }

  // bodyArea直下の子要素を列挙
  console.log(`\n#bodyArea children (${bodyArea.children().length} total):`);
  bodyArea.children().each((i, el) => {
    const $el = $(el);
    const tag = el.tagName?.toLowerCase();
    const cls = $el.attr('class') || '';
    const text = $el.text().trim().substring(0, 100);
    if (i < 30) {
      console.log(`  [${i}] <${tag} class="${cls}"> ${text}`);
    }
  });

  // h2の数
  const h2s = bodyArea.find('h2');
  console.log(`\nh2 count: ${h2s.length}`);
  h2s.each((i, el) => {
    if (i < 5) console.log(`  h2[${i}]: ${$(el).text().trim().substring(0, 80)}`);
  });

  // indent1の数
  const indent1 = bodyArea.find('p.indent1');
  console.log(`\np.indent1 count: ${indent1.length}`);
  indent1.each((i, el) => {
    if (i < 5) {
      const $el = $(el);
      const strong = $el.find('strong').first().text().trim();
      const text = $el.text().trim().substring(0, 100);
      console.log(`  indent1[${i}]: strong="${strong}" text="${text}"`);
    }
  });

  // indent2の数
  const indent2 = bodyArea.find('p.indent2');
  console.log(`p.indent2 count: ${indent2.length}`);
}

async function main() {
  const target = process.argv[2];

  if (target && target.endsWith('.htm')) {
    // 特定ファイルを調査
    await debugFile(target);
  } else {
    // 0チャンクだったファイルを調査
    const dir = join(DATA_DIR, target || 'shotoku');
    const files = await readdir(dir);
    const testFiles = ['05_02.htm', '05_03.htm', '05_05.htm', '04_05.htm'];
    for (const f of testFiles) {
      if (files.includes(f)) {
        await debugFile(join(dir, f));
      }
    }
    // 成功しているファイルも1つ見る
    const okFiles = ['05_04.htm', '02_06.htm'];
    for (const f of okFiles) {
      if (files.includes(f)) {
        await debugFile(join(dir, f));
        break;
      }
    }
  }
}

main();
