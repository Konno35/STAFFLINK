# StaffLink

派遣会社向け勤怠管理SaaS。スタッフはLINE Mini Appで打刻し、管理者はWeb管理画面で確認・管理する。

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────┐
│  LINE Mini App (stafflink-app.netlify.app)              │
│  app/ (React + Vite + LIFF)                            │
│  netlify/functions/ (Netlify Functions = API サーバー)  │
└──────────────────────────┬──────────────────────────────┘
                           │ Supabase (PostgreSQL)
┌──────────────────────────┴──────────────────────────────┐
│  Admin Web App (stafflink-admin.netlify.app)            │
│  admin/ (React + Vite + Supabase Auth)                 │
│  /api/* → stafflink-app.netlify.app/api/* (proxy)      │
└─────────────────────────────────────────────────────────┘
```

- **Netlify Functions** はすべて `netlify/functions/` に置かれ、LINE App サイトでのみホストされる
- **Admin App** は同 Functions をプロキシ経由で呼び出す（CORS回避）
- **DB** は Supabase (PostgreSQL)、マルチテナント構成

---

## Netlify サイト設定

### 1. LINE Mini App サイト (`stafflink-app.netlify.app`)

**Build settings**
| 項目 | 値 |
|---|---|
| Base directory | _(空欄)_ |
| Build command | `npm install && cd app && npm install && npm run build` |
| Publish directory | `app/dist` |
| Functions directory | `netlify/functions` |

**Environment variables**

| 変数名 | 説明 | 取得場所 |
|---|---|---|
| `SUPABASE_URL` | SupabaseプロジェクトURL | Supabase → Project Settings → API → Project URL |
| `SUPABASE_SERVICE_KEY` | service_role キー（秘密） | Supabase → Project Settings → API → service_role → secret |
| `VITE_LIFF_ID` | LIFF ID | LINE Developers → LIFF |
| `LINE_CHANNEL_ID` | LINEチャネルID | LINE Developers → Basic settings |
| `ADMIN_SECRET` | テナント管理APIの保護用シークレット（任意の文字列） | 自分で決めて設定 |

> `VITE_API_BASE` は設定不要（`/api` がデフォルト）

---

### 2. Admin Web App サイト (`stafflink-admin.netlify.app`)

**Build settings**
| 項目 | 値 |
|---|---|
| Base directory | `admin` |
| Build command | `npm install && npm run build` |
| Publish directory | `dist` |

> `admin/netlify.toml` により `/api/*` は `stafflink-app.netlify.app/api/*` へプロキシされる

**Environment variables**

| 変数名 | 説明 | 取得場所 |
|---|---|---|
| `VITE_SUPABASE_URL` | SupabaseプロジェクトURL | Supabase → Project Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | anon キー（公開可） | Supabase → Project Settings → API → anon → public |
| `VITE_LIFF_ID` | LIFF ID（スタッフ招待リンク生成に使用） | LINE Developers → LIFF |

> `VITE_API_BASE` は `admin/netlify.toml` の `[build.environment]` で `/api` に設定済み

---

## Supabase 設定

- **Authentication → URL Configuration**
  - Site URL: `https://stafflink-admin.netlify.app`
  - Redirect URLs に `https://stafflink-admin.netlify.app/**` を追加

- **Authentication → Providers → Google**
  - Google Cloud Console で OAuth クライアントを作成し、クライアントID/シークレットを設定
  - 承認済みリダイレクトURIに Supabase のコールバックURL (`https://<project>.supabase.co/auth/v1/callback`) を追加

- **Database**
  - `docs/supabase/schema.sql` を新規DBに適用（初回のみ）
  - `docs/supabase/schema-migrations.sql` を既存DBに追加適用

---

## admin_accounts への初期レコード登録

Admin Web App に初めてGoogleログインした後、Supabase SQL Editor で以下を実行する。

```sql
-- 1. ログインしたアカウントのSupabase Auth UIDを確認
-- Supabase UI → Authentication → Users → メールアドレスの行のUID

-- 2. テナントIDを確認
SELECT id, name FROM tenants;

-- 3. admin_accounts に登録
INSERT INTO admin_accounts (supabase_uid, tenant_id, email)
VALUES (
  '<Authentication → Users で確認したUID>',
  '<tenants テーブルのid>',
  '<ログインしたメールアドレス>'
);
```

---

## デプロイ

### LINE Mini App サイト（Netlify CLI）

このリポジトリは `stafflink-app.netlify.app` にリンク済み（`.netlify/state.json`）。

```bash
# 初回のみ：Netlify にログイン＆リンク確認
netlify status

# プレビューデプロイ（動作確認用）
netlify deploy

# 本番デプロイ
netlify deploy --prod
```

環境変数の設定・確認：

```bash
# 一覧表示
netlify env:list

# 設定
netlify env:set SUPABASE_URL "https://xxxx.supabase.co"
netlify env:set SUPABASE_SERVICE_KEY "eyJ..."
netlify env:set VITE_LIFF_ID "2010022290-xxxxxxxx"
netlify env:set LINE_CHANNEL_ID "2010022290"
netlify env:set ADMIN_SECRET "任意の文字列"
```

> 環境変数を変更したら再デプロイが必要

---

### Admin Web App サイト（GitHub 連携による自動デプロイ）

`master` ブランチへの `git push` で Netlify が自動検知し `stafflink-admin.netlify.app` にデプロイされる。

```bash
git push origin master  # → Netlify が自動ビルド・デプロイ
```

手動でデプロイしたい場合は Netlify UI → **Deploys → Trigger deploy** から実行。

---

## ローカル開発

### LINE Mini App

```bash
cp app/.env.example app/.env.local
# app/.env.local に VITE_LIFF_ID を設定
cd app
npm install
npm run dev
```

### Admin Web App

```bash
cp admin/.env.example admin/.env.local
# admin/.env.local に VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / VITE_LIFF_ID を設定
cd admin
npm install
npm run dev
```

### Netlify Functions（ローカル）

```bash
cp .env.example .env
# .env に SUPABASE_URL / SUPABASE_SERVICE_KEY / VITE_LIFF_ID / LINE_CHANNEL_ID / ADMIN_SECRET を設定
npm install
npx netlify dev
```

---

## ディレクトリ構成

```
StaffLink/
├── app/                  # LINE Mini App フロントエンド (React + Vite)
├── admin/                # Admin Web App フロントエンド (React + Vite)
│   └── netlify.toml      # Admin サイト専用ビルド設定・プロキシ設定
├── netlify/
│   └── functions/        # Netlify Functions (API サーバー)
│       └── lib/          # 共通ライブラリ (DB接続・認証)
├── docs/
│   ├── supabase/
│   │   ├── schema.sql             # 初回DB構築用
│   │   └── schema-migrations.sql  # 追加マイグレーション
│   └── gas/
│       └── StaffLink.gs           # GASテンプレート (スプレッドシート連携)
└── netlify.toml          # LINE App サイト専用ビルド設定
```
