/**
 * 通達HTMLパーサー + チャンカー
 *
 * スクレイピングしたHTMLを通達番号単位でチャンキングし、
 * JSON形式で出力する。
 *
 * 出力形式:
 * {
 *   "id": "shotoku-36-15",
 *   "type": "shotoku",           // 通達種別
 *   "number": "36-15",           // 通達番号
 *   "title": "経済的利益",       // 見出し
 *   "lawRef": "法第36条",        // 対応法令条文
 *   "text": "...",               // 本文全体
 *   "refs": ["36-16", "36-17"],  // 参照先通達番号
 * }
 */

import { readFile, writeFile, readdir, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', '..', '..', 'data');

/**
 * 通達HTMLから通達番号単位のチャンクを抽出する
 */
function parseTsutatsuPage(html, type) {
  const $ = cheerio.load(html);
  const chunks = [];

  // TODO: NTAのHTML構造に合わせてパーサーを実装
  // 典型的な構造:
  // - 通達番号が太字 or h3/h4 で記載
  // - 本文がその後に続く
  // - (1)(2)(3) の項目はインデントまたはリストで記載
  // - (注) は別段落

  return chunks;
}

/**
 * 通達本文から参照先通達番号を抽出する
 */
function extractRefs(text) {
  // 「36-15」「2-1-3」のようなパターンをマッチ
  const pattern = /\d{1,3}[-－]\d{1,3}(?:[-－]\d{1,3})?/g;
  const matches = text.match(pattern) || [];
  return [...new Set(matches)];
}

async function main() {
  const target = process.argv[2] || 'shotoku';
  const rawDir = join(DATA_DIR, 'raw', target);
  const outDir = join(DATA_DIR, 'chunks', target);
  await mkdir(outDir, { recursive: true });

  const files = await readdir(rawDir);
  const htmlFiles = files.filter((f) => f.endsWith('.html') && f !== 'index.html');

  let allChunks = [];
  for (const file of htmlFiles) {
    const html = await readFile(join(rawDir, file), 'utf-8');
    const chunks = parseTsutatsuPage(html, target);
    allChunks = allChunks.concat(chunks);
  }

  // チャンクをJSONとして保存
  for (const chunk of allChunks) {
    const outPath = join(outDir, `${chunk.id}.json`);
    await writeFile(outPath, JSON.stringify(chunk, null, 2), 'utf-8');
  }

  // 全チャンクのインデックスも保存
  const index = allChunks.map((c) => ({
    id: c.id,
    number: c.number,
    title: c.title,
    lawRef: c.lawRef,
  }));
  await writeFile(join(outDir, '_index.json'), JSON.stringify(index, null, 2), 'utf-8');

  console.log(`Parsed ${allChunks.length} chunks from ${htmlFiles.length} files`);
}

main();
