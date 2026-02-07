# 通達検索プロジェクト (taxation)

## 概要
国税庁の法令解釈通達をembeddingしてベクトル検索できるようにするプロジェクト。
将来的に「条文くん」(joubun-kun) とマージ予定。

## アーキテクチャ
- **フロント**: React + Vite → Cloudflare Pages
- **API**: Cloudflare Workers + Vectorize + R2
- **Embedding**: OpenAI text-embedding-3-small（条文くんと同じモデル）
- **スクレイピング**: Node.js + cheerio

## ディレクトリ構成
```
apps/web/          - フロントエンド (React + Vite)
packages/scraper/  - スクレイピング・パース・チャンキング
worker/            - Cloudflare Worker (検索API)
scripts/           - embedding生成スクリプト
data/              - スクレイピングデータ (.gitignore済)
```

## チャンキング戦略
- 通達番号単位を基本チャンクとする
- メタデータ: type, number, title, lawRef, refs
- 長い通達はサブ分割（section フィールドで管理）
- embedding対象テキストにはメタデータを付加して検索精度を向上

## 重要な制約
- embeddingモデルは `text-embedding-3-small` で固定（条文くんとの互換性）
- Vectorizeインデックス名: `tsutatsu-embeddings`（別indexで開発→マージ時に統合）
- R2バケット名: `tsutatsu-data`

## 対象通達
- 所得税基本通達
- 法人税基本通達
- 相続税法基本通達
- 消費税法基本通達
- 財産評価基本通達
- 国税通則法関係通達
- 措置法通達
