# 音声ファイル圧縮ツール

100MB以上の音声ファイルを100MB未満に圧縮するWebアプリケーションです。

## 特徴

- **ffmpeg.wasm使用**: ブラウザ上で直接音声ファイルを圧縮
- **CDN経由**: jsDelivr CDNからライブラリを読み込むため、ローカルインストール不要
- **Cross-Origin Isolation対応**: COI ServiceWorkerにより自動的に設定

## セットアップ方法

### 方法1: ローカルサーバーで実行（開発・テスト用）

1. **サーバー起動.bat**をダブルクリック
2. ブラウザで `http://localhost:8000` にアクセス

### 方法2: GitHub Pagesでホスティング（推奨・不特定多数向け）

#### セットアップ手順

1. **GitHubリポジトリを作成**
   - GitHubにログイン
   - 新しいリポジトリを作成（例: `audio-compressor`）

2. **ファイルをアップロード**
   - このフォルダの以下のファイルをアップロード：
     - `index.html`
     - `script.js`
     - `style.css`
     - `.github/workflows/deploy.yml`（GitHub Actions用、オプション）

3. **GitHub Pagesで公開**
   - リポジトリの **Settings** → **Pages** に移動
   - **Source** で **Deploy from a branch** を選択
   - **Branch** で `main` または `master` を選択
   - **Save** をクリック

4. **公開されたURLにアクセス**
   - 数分後、`https://[ユーザー名].github.io/[リポジトリ名]/` でアクセス可能になります

#### Cross-Origin Isolationについて

**GitHub Pagesでは、HTTPヘッダーを直接設定できません。** そのため、以下の方法でCross-Origin Isolationを有効にします：

**方法A: COI ServiceWorkerを使用（推奨・既に実装済み）**
- `index.html`にCOI ServiceWorkerが含まれています
- ページを読み込むと、自動的にCross-Origin Isolationが有効になります
- **ページを開いた後、一度再読み込み（F5）してください**

**方法B: NetlifyやVercelを使用（より確実）**
- NetlifyやVercelでは、`_headers`ファイルでHTTPヘッダーを設定できます
- より確実にCross-Origin Isolationを有効にできます

### 方法3: その他のホスティングサービス

- **Netlify**: ドラッグ&ドロップでデプロイ可能
- **Vercel**: GitHub連携で自動デプロイ
- **Cloudflare Pages**: 無料で高速

## 使用方法

1. 100MB以上の音声ファイルを選択
2. 自動的に圧縮処理が開始されます
3. 圧縮完了後、ダウンロードボタンから保存できます

## 技術仕様

- **ffmpeg.wasm**: jsDelivr CDN経由（`https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/umd/ffmpeg.min.js`）
- **COI ServiceWorker**: Cross-Origin Isolationを自動設定
- **対応形式**: MP3、WAV、OGG、WebMなど（ffmpeg.wasmがサポートする形式）

## 注意事項

- 圧縮により音質が低下する可能性があります
- 大きなファイルの処理には時間がかかります
- 処理中はブラウザを閉じないでください
- **ローカルファイルとして直接開くことはできません**（file://プロトコルでは動作しません）
- 必ずローカルサーバーまたはホスティングサービスで実行してください

## トラブルシューティング

### FFmpegが読み込まれない場合

1. ローカルサーバーで実行しているか確認
2. ブラウザのコンソールでエラーを確認
3. COI ServiceWorkerが正しく読み込まれているか確認

### 圧縮が失敗する場合

1. ファイルサイズが500MB以下か確認
2. サポートされている音声形式か確認
3. ブラウザのメモリが不足していないか確認
