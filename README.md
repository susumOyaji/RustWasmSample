# Rust WebAssembly Yahoo Integration App

動的なRust WebAssemblyアプリケーションで、Yahooコンテンツプロキシとマルチタブブラウジング機能を備えています。

## 主な機能

### WebAssembly基本機能
- **Hello World表示** - Rustから呼び出される基本的な挨拶機能
- **パーソナライズされた挨拶** - ユーザー名を入力してカスタム挨拶を生成
- **計算機能** - WebAssemblyでの数値計算デモ
- **タイムスタンプ取得** - リアルタイムタイムスタンプ表示

### Yahoo統合機能
- **Yahooホームページプロキシ** - アプリ内でYahooコンテンツを表示
- **Yahoo Newsプロキシ** - ニュース記事リストの取得と表示
- **新しいタブ機能** - Yahoo.comとYahoo Newsを直接ブラウザで開く
- **CORS対応** - プロキシサーバーによる外部コンテンツアクセス

## 技術スタック

- **Rust** - WebAssemblyコンパイル用
- **WebAssembly (WASM)** - ブラウザでのRust実行
- **JavaScript** - WebAssemblyとの連携
- **Python Flask** - プロキシサーバー
- **HTML/CSS** - フロントエンドUI

## ファイル構成

```
├── src/lib.rs              # Rustソースコード
├── Cargo.toml              # Rustプロジェクト設定
├── index.html              # メインWebページ
├── main.js                 # JavaScript連携
├── style.css               # スタイルシート
├── server.py               # 統合HTTPサーバー
├── proxy_server.py         # 専用プロキシサーバー
├── pyproject.toml          # Python依存関係
└── pkg/                    # WebAssemblyビルド成果物
    ├── hello_wasm.js
    └── hello_wasm_bg.wasm
```

## セットアップと実行

### 1. 依存関係のインストール

**Rust (WebAssembly用):**
```bash
# Rustがインストールされていない場合
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# wasm-packのインストール
cargo install wasm-pack
```

**Python依存関係:**
```bash
pip install flask flask-cors requests beautifulsoup4 trafilatura
```

### 2. WebAssemblyビルド

```bash
wasm-pack build --target web --out-dir pkg
```

### 3. サーバー起動

**統合サーバー（推奨）:**
```bash
python server.py --port 5000
```

**または個別にプロキシサーバーも起動:**
```bash
python proxy_server.py
```

### 4. アクセス

ブラウザで `http://localhost:5000` にアクセス

## API エンドポイント

### プロキシAPI
- `GET /api/proxy/yahoo` - Yahooホームページコンテンツ
- `GET /api/proxy/yahoo/news` - Yahoo Newsコンテンツ
- `GET /api/status` - APIステータス確認

### WebAssembly関数
- `greet(name)` - パーソナライズされた挨拶
- `hello_world()` - 基本Hello World
- `add(a, b)` - 数値加算
- `get_timestamp()` - 現在のタイムスタンプ

## 開発

### Rustコードの変更
1. `src/lib.rs` を編集
2. `wasm-pack build --target web --out-dir pkg` でリビルド
3. ブラウザをリフレッシュ

### フロントエンドの変更
1. `index.html`, `main.js`, `style.css` を編集
2. ブラウザをリフレッシュ

## トラブルシューティング

### CORSエラー
- 統合サーバー（server.py）を使用してください
- プロキシ機能でCORS問題を回避しています

### WebAssemblyロードエラー
- `pkg/` フォルダが存在し、適切なファイルが含まれているか確認
- `wasm-pack build` を再実行

### プロキシエラー
- インターネット接続を確認
- Yahoo.comへのアクセスが可能か確認

## ライセンス

MIT License

## 作成者

Replit AI Assistant を使用して開発