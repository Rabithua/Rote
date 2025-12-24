# Rote 自前ホスティングガイド

このガイドでは、Rote を自前ホスティングで素早くデプロイする方法を説明します。  
デプロイ方法としては、Docker を利用することを推奨します。

---

## 1. クイックスタート

Rote には 2 つの主なデプロイ方法があります。用途に合ったものを選んでください。

### 方法 1：Docker Hub イメージを利用（汎用）

最も一般的で、多くの環境で利用できる方法です。

1. **設定ファイルを準備する**

   プロジェクトの [**docker-compose.yml**](https://github.com/Rabithua/Rote/blob/main/docker-compose.yml) をサーバーにコピーします。

2. **環境変数を設定して起動する**

   `docker-compose` 実行時に、環境変数を直接指定して起動できます。  
   実行前に `ip` と `password` を必ず自分の環境に合わせて変更してください。

   ```bash
   # 最新イメージを利用（デフォルト）
   VITE_API_BASE=http://<your-ip-address>:18000 \
   POSTGRES_PASSWORD=your-secure-password \
   IMAGE_TAG=latest \
   docker-compose up -d

   # 特定バージョンを利用（例：v1.0.0）
   VITE_API_BASE=http://<your-ip-address>:18000 \
   POSTGRES_PASSWORD=your-secure-password \
   IMAGE_TAG=v1.0.0 \
   docker-compose up -d
   ```

   起動が完了すると：
   - バックエンド：`http://<your-ip-address>:18000`
   - フロントエンド：`http://<your-ip-address>:18001`

### 方法 2：Dokploy を利用（推奨）

Dokploy は、Docker ベースのアプリケーションを GUI で管理できるオープンソースのデプロイプラットフォームです。

1. **Dokploy にアクセス**

   ブラウザで Dokploy の管理画面を開きます。

2. **テンプレートからデプロイ**

   `Create Service` -> `Template` -> `Rote` を検索 -> `Create`

3. **カスタムドメインを設定（任意）**
   - デフォルトでは、Dokploy が自動生成したドメインが使用されます。
   - 独自ドメインを使いたい場合は、環境変数を次のように変更してください：

     ```bash
     VITE_API_BASE=http://your-domain.com
     # または
     VITE_API_BASE=https://your-domain.com
     ```

---

## 2. 設定項目

Rote は主に環境変数で設定します。

### 1. 必須設定

- **VITE_API_BASE**  
  フロントエンドがアクセスするバックエンド API のベース URL です。  
  実際のデプロイ先と必ず一致させてください。

  ```bash
  VITE_API_BASE=http://your-ip-address:18000
  VITE_API_BASE=https://your-domain.com
  ```

### 2. 任意設定

- **POSTGRES_PASSWORD**  
  PostgreSQL のパスワード。  
  デフォルトは `rote_password_123` ですが、**本番環境では必ず変更してください**。

- **IMAGE_TAG**  
  使用する Docker イメージのタグ（デフォルト：`latest`）。  
  例えば：

  ```bash
  IMAGE_TAG=v1.0.0
  ```

### 3. 高度な設定

OAuth、ファイルストレージ、メール送信などの詳細設定は、デプロイ後に管理画面から行えます。  
初回アクセス時には初期設定ウィザードが表示され、そこで各種項目を設定できます。

---

## 3. 使用ポート

デフォルトでは、Rote は次のポートを使用します：

- **18000** – バックエンド API
- **18001** – フロントエンド Web
- **5432** – PostgreSQL（コンテナ内部のみ、外部には公開されません）

ポートを変更したい場合は、`docker-compose.yml` の `ports` 設定を編集してください。

---

## 4. バックアップと移行

Rote は Docker ボリュームにデータを保存するため、バックアップやサーバー移行が比較的簡単です。

### 1. バックアップ

#### 1.1 データベースのバックアップ

ホストマシンで以下を実行します：

```bash
# データベースをエクスポート
docker exec rote-postgres pg_dump -U rote rote > rote_backup_$(date +%Y%m%d).sql
```

#### 1.2 ファイルストレージのバックアップ

S3 / R2 などのクラウドストレージを使用している場合は、各プロバイダの推奨手順に従ってバックアップしてください。

---

### 2. データ移行

#### 2.1 新しいサーバーに Rote をデプロイ

「クイックスタート」の手順に従って、新しいサーバーに Rote をデプロイします。

#### 2.2 データベースをリストア

バックアップしたファイルを新しいサーバーにコピーし、以下を実行します：

```bash
# データベースをインポート
docker exec -i rote-postgres psql -U rote rote < rote_backup_YYYYMMDD.sql
```

#### 2.3 ファイルストレージの移行

S3 / R2 などのクラウドストレージを利用している場合、同じ Bucket と認証情報を使えば、通常は追加の移行作業は不要です。

---

## 5. よくある質問（FAQ）

### 1. サービスが起動しない

- **ポート競合の確認**  
  `18000` と `18001` のポートが、他のプロセスに使用されていないか確認してください。

- **Docker の状態を確認**
  - `docker ps` でコンテナが起動しているか確認
  - `docker logs rote-backend` でバックエンドのログを確認
  - `docker logs rote-postgres` でデータベースのログを確認

- **環境変数を確認**  
  `VITE_API_BASE` などの値が正しく設定されているか確認してください。

### 2. フロントエンドからバックエンドに接続できない

- **VITE_API_BASE の確認**  
  設定した URL にブラウザから直接アクセスできるか確認します。

- **ネットワーク / リバースプロキシの確認**  
  Nginx や Caddy などを利用している場合、プロキシ設定（パス、ポート、ヘッダなど）が正しいか確認してください。

- **ファイアウォールの確認**  
  80 / 443 / 18000 / 18001 ポートへのアクセスがブロックされていないか確認してください。

### 3. データベース接続エラー

- **データベースコンテナの確認**  
  `docker logs rote-postgres` を確認し、PostgreSQL が正常に起動しているかを確認します。

- **接続文字列の確認**  
  ユーザー名、パスワード、ホスト、ポート、DB 名が正しいかを確認してください。

- **初期化待ち**  
  初回起動時はデータベースの初期化に時間がかかる場合があります。その間は一時的に接続エラーが出ることがあります。

### 4. バージョンアップの手順

1. **データをバックアップ**  
   上記「バックアップ」の手順に従って、データベースとストレージをバックアップします。

2. **新しいイメージを取得**

   ```bash
   # 最新イメージを取得
   docker-compose pull

   # 特定バージョンを取得（例：v1.0.0）
   IMAGE_TAG=v1.0.0 docker-compose pull
   ```

3. **サービスを再起動**

   ```bash
   docker-compose up -d
   ```

---

## 6. サポート

デプロイ中に問題が発生した場合は、以下の方法で問い合わせが可能です：

- **GitHub Issues：** https://github.com/rabithua/rote/issues
- **重大なセキュリティ脆弱性：** rabithua@gmail.com
