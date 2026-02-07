# 通達検索プロジェクト (taxation)

## 概要
国税庁の法令解釈通達をembeddingしてベクトル検索できるようにするプロジェクト。
将来的に「条文くん」(joubun-kun) とマージ予定。

## アーキテクチャ
- **フロント**: React + Vite → Cloudflare Pages
- **API**: Cloudflare Workers + Vectorize + R2
- **Embedding**: Cloudflare Workers AI `@cf/baai/bge-m3`（条文くんと同じモデル）
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
条文くんと同じ項単位チャンキング + 親チャンク方式。

### 基本ルール
- 1通達番号 = 1親チャンク（柱書・表・算式を含む）
- (1)(2)(3) = 子チャンク（親IDを持つ）
- ただし書 = 親チャンクに含める（条文くんと同じ）
- (注) = 直前チャンクに付加
- サイズ上限は設けない（意味単位優先）

### メタデータ
- type: 通達種別（shotoku, hojin, sozoku, shohi, hyoka, sochiho）
- number: 通達番号（"36-15", "69の4-24の6"）
- section: 項番号（0=柱書, 1=(1), 2=(2)...）
- title: 見出し
- lawRef: 対応法令条文（"法第36条"）
- refs: 参照先通達番号の配列
- parentId: 親チャンクID（子チャンクの場合）

### embedding対象テキスト
メタデータを付加して検索精度を向上:
```
{type} {number} {title} {lawRef}
[柱書] ...（親チャンクの本文）
[本項] (3) ...（当該項の本文）
```

### ID体系
- 親: `{type}-{number}` → `shotoku-36-15`, `hyoka-185`
- 子: `{type}-{number}-{section}` → `shotoku-36-15-1`
- 枝番: `sochiho-69の4-24の6`（通達番号をそのまま使用）

## 重要な制約
- embeddingモデルは `@cf/baai/bge-m3` で固定（条文くんとの互換性、Cloudflare Workers AI）
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
