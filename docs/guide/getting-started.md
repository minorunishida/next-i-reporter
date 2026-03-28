# はじめに

Next i-Reporter を使い始めるためのセットアップ手順です。

## 前提条件

| 項目 | 要件 |
|------|------|
| Node.js | 22 以上 |
| OpenAI API Key | GPT-5.1 対応のキー |
| ブラウザ | Chrome / Edge / Firefox (最新版) |

## インストール

```bash
git clone <リポジトリURL>
cd next-i-reporter
npm install
```

## 環境変数の設定

プロジェクトルートに `.env.local` を作成します。

```bash
# 必須: OpenAI API Key
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx

# オプション: 使用するモデル (デフォルト: gpt-5.1)
OPENAI_MODEL=gpt-5.1
```

## 起動

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開きます。

![アップロード画面](/screenshots/upload.png)

## 次のステップ

セットアップが完了したら、[基本フロー](./basic-flow) で操作の流れを確認しましょう。
