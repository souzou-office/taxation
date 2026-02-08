/**
 * 通達HTMLパーサー + チャンカー
 *
 * スクレイピングしたHTMLを条文くんと同じ項単位でチャンキングし、
 * JSON形式で出力する。
 *
 * HTML構造 (NTA通達ページ):
 *   h2          → 見出し（経済的利益 等）
 *   p.indent1   → 通達番号 + 柱書（<strong>で番号）
 *   p.indent2   → (1)(2)(3) 子項目
 *   p.indent3   → (イ)(ロ)(ハ) さらに深い項目（indent2に付加）
 *
 * 出力: 条文くんと同じ形式
 *   親チャンク: 柱書 + ただし書 + 表 + 算式
 *   子チャンク: (1)(2)(3) 各項
 *   (注): 直前チャンクに付加
 *
 * Usage: node packages/scraper/src/parse.js [target]
 */

import { readFile, writeFile, readdir, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', '..', '..', 'data');

/**
 * 通達番号を正規化
 * "36−15" → "36-15" (全角ハイフン→半角)
 */
function normalizeNumber(str) {
  return str
    .replace(/\s+/g, '')
    .replace(/[−–—]/g, '-')
    .replace(/[　]/g, '')
    .trim();
}

/**
 * (注) かどうか判定
 */
function isNote(text) {
  return /^\s*[（(]\s*注\s*[）)]/.test(text);
}

/**
 * (1)(2)(3) の番号を抽出
 */
function extractItemNumber(text) {
  const match = text.match(/^\s*[（(]\s*(\d+)\s*[）)]/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * 通達本文から参照先通達番号を抽出
 */
function extractRefs(text) {
  // "36-15" "2-1-3" "69の4-24の6" のようなパターン
  const pattern = /\d{1,3}(?:の\d{1,3})*[-－]\d{1,3}(?:[-－]\d{1,3})?(?:の\d{1,3})*/g;
  const matches = text.match(pattern) || [];
  return [...new Set(matches.map(normalizeNumber))];
}

/**
 * 通達HTMLから通達番号単位のチャンクを抽出する
 */
function parseTsutatsuPage(html, type) {
  const $ = cheerio.load(html);
  const chunks = [];

  let currentTitle = '';
  let currentNumber = '';
  let currentLawRef = '';
  let parentText = '';
  let parentChunk = null;
  let lastChunk = null;

  const bodyArea = $('#bodyArea');
  if (!bodyArea.length) return chunks;

  // h2の前にある法令関係の情報を抽出するヘルパー
  function extractLawRef(heading) {
    // "法第36条《収入金額》関係" のようなパターン
    const match = heading.match(/法第?\d+条(?:の\d+)?/);
    return match ? match[0] : '';
  }

  bodyArea.children().each((_, el) => {
    const $el = $(el);
    const tagName = el.tagName?.toLowerCase();

    // h2 = 見出し
    if (tagName === 'h2') {
      const text = $el.text().trim().replace(/[（()）]/g, (m) => m);
      // 括弧を除去して見出しテキストを取得
      currentTitle = text.replace(/^[（(]/, '').replace(/[)）]$/, '');
      currentLawRef = extractLawRef(text);
      return;
    }

    // p.indent1 = 通達番号 + 本文
    if (tagName === 'p' && $el.hasClass('indent1')) {
      const text = $el.text().trim();
      const strong = $el.find('strong').first().text().trim();

      // 通達番号パターン（共通）
      const numberPattern =
        /(\d{1,3}(?:の\d{1,3})*[-－–—]\d{1,3}(?:[-－–—]\d{1,3})?(?:の\d{1,3})*)/;

      // 1. <strong> に通達番号があるかチェック
      let numberMatch = strong.match(numberPattern);

      // 2. strongに番号がない場合、テキスト全体の先頭から探す
      //    例: <strong>36</strong>－15　本文... → text="36－15　本文..."
      if (!numberMatch) {
        numberMatch = text.match(numberPattern);
      }

      const articleMatch = strong.match(/(\d+)\s*条/);
      // "2", "3" のような連番は同じ通達の続き
      // ただし、テキスト全体から通達番号が見つかった場合はcontinuationではない
      const continuationMatch = strong.match(/^(\d+)$/);

      if (numberMatch) {
        // 新しい通達番号が始まった
        currentNumber = normalizeNumber(numberMatch[1]);

        // 親チャンクを作成
        // 通達番号部分をテキストから除去して本文を取得
        const bodyText = text.replace(numberMatch[0], '').trim();
        parentChunk = {
          id: `${type}-${currentNumber}`,
          type,
          number: currentNumber,
          section: 0,
          title: currentTitle,
          lawRef: currentLawRef,
          text: bodyText,
          refs: [],
        };
        parentText = bodyText;
        chunks.push(parentChunk);
        lastChunk = parentChunk;
      } else if (articleMatch && !continuationMatch) {
        // "95条" のような形式の通達番号
        currentNumber = articleMatch[1];

        const bodyText = text.replace(strong, '').trim();
        parentChunk = {
          id: `${type}-${currentNumber}`,
          type,
          number: currentNumber,
          section: 0,
          title: currentTitle,
          lawRef: currentLawRef,
          text: bodyText,
          refs: [],
        };
        parentText = bodyText;
        chunks.push(parentChunk);
        lastChunk = parentChunk;
      } else if (continuationMatch && parentChunk) {
        // 同じ通達の第2項、第3項 → 親チャンクに追加
        const bodyText = text.replace(strong, '').trim();
        parentChunk.text += '\n' + strong + '　' + bodyText;
        lastChunk = parentChunk;
      } else if (isNote(text) && lastChunk) {
        // (注) → 直前チャンクに付加
        lastChunk.text += '\n' + text;
      } else if (parentChunk) {
        // その他のindent1 → 親チャンクに追加
        parentChunk.text += '\n' + text;
        lastChunk = parentChunk;
      }
      return;
    }

    // p.indent2 = (1)(2)(3) 子項目
    if (tagName === 'p' && $el.hasClass('indent2')) {
      const text = $el.text().trim();

      if (isNote(text) && lastChunk) {
        // (注) → 直前チャンクに付加
        lastChunk.text += '\n' + text;
        return;
      }

      const itemNum = extractItemNumber(text);
      if (itemNum && parentChunk) {
        // 子チャンクを作成
        const childChunk = {
          id: `${type}-${currentNumber}-${itemNum}`,
          type,
          number: currentNumber,
          section: itemNum,
          title: currentTitle,
          lawRef: currentLawRef,
          parentId: parentChunk.id,
          text: text,
          refs: [],
        };
        chunks.push(childChunk);
        lastChunk = childChunk;
      } else if (lastChunk) {
        // 番号なしのindent2 → 直前チャンクに追加
        lastChunk.text += '\n' + text;
      }
      return;
    }

    // p.indent3 以降 = さらに深い項目 → 直前チャンクに付加
    if (tagName === 'p' && /indent[3-9]/.test($el.attr('class') || '')) {
      const text = $el.text().trim();
      if (lastChunk && text) {
        lastChunk.text += '\n' + text;
      }
      return;
    }

    // table = 表 → 親チャンクに付加（テキスト化）
    if (tagName === 'table' && parentChunk) {
      const rows = [];
      $el.find('tr').each((_, tr) => {
        const cells = [];
        $(tr)
          .find('th, td')
          .each((_, td) => {
            cells.push($(td).text().trim());
          });
        rows.push(cells.join(' | '));
      });
      if (rows.length) {
        parentChunk.text += '\n[表]\n' + rows.join('\n');
      }
      return;
    }
  });

  // 全チャンクのrefsを抽出
  for (const chunk of chunks) {
    chunk.refs = extractRefs(chunk.text).filter((ref) => ref !== chunk.number);
  }

  return chunks;
}

async function main() {
  const target = process.argv[2] || 'shotoku';
  const rawDir = join(DATA_DIR, 'raw', target);
  const outDir = join(DATA_DIR, 'chunks', target);
  await mkdir(outDir, { recursive: true });

  let files;
  try {
    files = await readdir(rawDir);
  } catch {
    console.error(`No raw data found: ${rawDir}`);
    console.error('Run the scraper first: node packages/scraper/src/index.js ' + target);
    process.exit(1);
  }

  const htmlFiles = files.filter((f) => f.endsWith('.htm') || f.endsWith('.html'));
  // 目次・メニューページを除外
  const contentFiles = htmlFiles.filter(
    (f) => f !== 'index.html' && f !== 'index.htm' && f !== 'menu.htm' && !f.startsWith('01')
  );

  console.log(`Parsing ${contentFiles.length} files from ${rawDir}`);

  let allChunks = [];
  for (const file of contentFiles) {
    const html = await readFile(join(rawDir, file), 'utf-8');
    const chunks = parseTsutatsuPage(html, target);
    console.log(`  ${file}: ${chunks.length} chunks`);
    allChunks = allChunks.concat(chunks);
  }

  // 重複ID除去（同じ通達番号が複数ページにまたがる場合）
  const seen = new Set();
  allChunks = allChunks.filter((chunk) => {
    if (seen.has(chunk.id)) return false;
    seen.add(chunk.id);
    return true;
  });

  // チャンクをJSONとして保存
  for (const chunk of allChunks) {
    const outPath = join(outDir, `${chunk.id}.json`);
    await writeFile(outPath, JSON.stringify(chunk, null, 2), 'utf-8');
  }

  // 全チャンクのインデックスも保存
  const index = allChunks.map((c) => ({
    id: c.id,
    number: c.number,
    section: c.section,
    title: c.title,
    lawRef: c.lawRef,
    parentId: c.parentId,
  }));
  await writeFile(join(outDir, '_index.json'), JSON.stringify(index, null, 2), 'utf-8');

  console.log(`\nTotal: ${allChunks.length} chunks saved to ${outDir}`);
}

main();
