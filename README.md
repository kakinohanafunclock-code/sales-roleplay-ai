# SES営業ロープレAI

営業部向けAIロールプレイシステム

## デプロイ方法

### Netlifyにデプロイ

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy)

### 環境変数の設定

Netlify管理画面で以下を設定してください：

```
CLAUDE_API_KEY=sk-ant-api03-your-key-here
```

## ファイル構成

```
.
├── index.html
├── styles.css
├── app.js
├── models/
│   └── avatar.vrm (VRMファイルを配置)
├── netlify/
│   └── functions/
│       └── claude-proxy.js
└── netlify.toml
```

## VRMファイルの配置

`models/avatar.vrm` にVRMファイルを配置してください。

## 使い方

1. URLにアクセス
2. 難易度・業界・シーンを選択
3. マイクボタンで話す
