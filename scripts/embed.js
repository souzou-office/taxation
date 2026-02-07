/**
 * Embedding生成 + Vectorize投入スクリプト
 *
 * チャンク化された通達JSONを読み込み、
 * OpenAI text-embedding-3-small でベクトル化し、
 * Cloudflare Vectorize に投入する。
 *
 * 条文くんと同じembeddingモデルを使うことで、
 * 将来のインデックス統合を可能にする。
 *
 * Usage: OPENAI_API_KEY=xxx node scripts/embed.js [target]
 */

import { readFile, readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data', 'chunks');
const EMBEDDING_MODEL = 'text-embedding-3-small';
const BATCH_SIZE = 100;

async function getEmbeddings(texts) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is required');

  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: texts,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.data.map((d) => d.embedding);
}

/**
 * embeddingに使うテキストを生成
 * メタデータを付加して検索精度を上げる
 */
function buildEmbeddingText(chunk) {
  const parts = [];
  if (chunk.type) parts.push(chunk.type);
  if (chunk.number) parts.push(chunk.number);
  if (chunk.title) parts.push(chunk.title);
  if (chunk.lawRef) parts.push(chunk.lawRef);
  parts.push(chunk.text);
  return parts.join(' ');
}

async function main() {
  const target = process.argv[2] || 'shotoku';
  const chunkDir = join(DATA_DIR, target);

  const files = await readdir(chunkDir);
  const jsonFiles = files.filter((f) => f.endsWith('.json') && !f.startsWith('_'));

  console.log(`Loading ${jsonFiles.length} chunks from ${chunkDir}`);

  const chunks = [];
  for (const file of jsonFiles) {
    const data = JSON.parse(await readFile(join(chunkDir, file), 'utf-8'));
    chunks.push(data);
  }

  console.log(`Generating embeddings for ${chunks.length} chunks (model: ${EMBEDDING_MODEL})`);

  // バッチ処理
  const vectors = [];
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const texts = batch.map(buildEmbeddingText);
    const embeddings = await getEmbeddings(texts);

    for (let j = 0; j < batch.length; j++) {
      vectors.push({
        id: batch[j].id,
        values: embeddings[j],
        metadata: {
          type: batch[j].type,
          number: batch[j].number,
          title: batch[j].title,
          lawRef: batch[j].lawRef,
        },
      });
    }

    console.log(`  Embedded ${Math.min(i + BATCH_SIZE, chunks.length)}/${chunks.length}`);

    // レートリミット回避
    if (i + BATCH_SIZE < chunks.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  // TODO: Vectorize APIで投入
  // wrangler vectorize insert tsutatsu-embeddings --file=vectors.ndjson
  // または Cloudflare API 直接呼び出し

  // 一旦NDJSONで出力
  const ndjson = vectors.map((v) => JSON.stringify(v)).join('\n');
  const outPath = join(__dirname, '..', 'data', `${target}-vectors.ndjson`);
  const { writeFile: wf } = await import('fs/promises');
  await wf(outPath, ndjson, 'utf-8');
  console.log(`Saved ${vectors.length} vectors to ${outPath}`);
}

main();
