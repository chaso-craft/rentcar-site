# Supabase 本番連携セットアップ

予約・料金・車両設定を **みんなで共有**し、管理者画面で全員の予約を見られるようにする手順です。

---

## 1. SQL を実行する（必須）

1. [Supabase Dashboard](https://supabase.com/dashboard) でプロジェクト **レントカーサイト** を開く  
2. 左メニュー **SQL** → **New query**  
3. `supabase/schema.sql` の内容をすべて貼り付けて **Run**  
4. 成功メッセージが出ればOK  

---

## 2. anon キーをサイトに入れる（必須）

1. **Project Settings（歯車） → API**  
2. **anon public** キーをコピー  
3. プロジェクト内の `supabase-config.js` を開き、次のように貼る  

```js
window.RENTCAR_SUPABASE_URL = "https://pppwmaaucxkijywlkulj.supabase.co";
window.RENTCAR_SUPABASE_ANON_KEY = "ここにanonキー";
```

`service_role` キーは **書かない**でください。

---

## 3. 管理者ユーザーを作る（必須）

1. Supabase 左メニュー **Authentication → Users**  
2. **Add user** → **Create new user**  
3. 管理者用のメールとパスワードを設定（例: 店舗用 Gmail）  
4. **Auto Confirm User** にチェックを入れる（確認メールなしで即ログイン可）  
5. このメール／パスワードで `admin.html` にログインします  

パスワードを忘れた場合は、同じ画面でユーザーを選び **Send password recovery**、または削除して新規作成してください。

※ Authentication → Providers → Email の「Confirm email」がオンの場合は、確認メールを完了するか、開発中は Confirm email をオフにしてください。

---

## 4. 予約確認メール（Edge Function）

PDF付きの HTML メールを Gmail から送ります。メール文面は管理画面の **店舗設定 → 予約確認メール** から変更できます。

### 4-1. Supabase CLI（初回だけ）

1. Node.js が入っていること  
2. PowerShell:

```powershell
cd "C:\Users\mizuk\OneDrive\デスクトップ\カーソル\projects\rentcar-site"
npx supabase login
npx supabase link --project-ref pppwmaaucxkijywlkulj
```

### 4-2. Gmail アプリパスワード（必須）

送信専用 Gmail（例: `ailand.510.ai.send@gmail.com`）で:

1. [Google アカウント](https://myaccount.google.com/) → **セキュリティ**
2. **2段階認証** をオン
3. [アプリパスワード](https://myaccount.google.com/apppasswords) を作成（メール用）
4. 表示された **16文字** を控える（通常のログインパスワードは使えません）

### 4-3. シークレット登録

ダッシュボードの Edge Functions → Secrets で次を登録しても構いません。

```powershell
cd "C:\Users\mizuk\OneDrive\デスクトップ\カーソル\projects\rentcar-site"
npx supabase secrets set GMAIL_SENDER=送信専用のGmailアドレス
npx supabase secrets set GMAIL_APP_PASSWORD=アプリパスワード16文字
```

### 4-4. デプロイ

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
npx.cmd supabase functions deploy send-confirmation
```

（`config.toml` で JWT 検証オフ済み。予約完了時は未ログインのお客さんが呼びます）

関数を更新したあとは、同じデプロイコマンドを再実行してください。

---

## 5. 動作確認

1. ローカルサーバーでサイトを開く（`file://` ではなく http 推奨）  
2. `admin.html` → Supabase の管理者メールでログイン  
3. 料金・車両を保存 → 別ブラウザ／スマホの予約サイトに反映されるか確認  
4. 予約を入れる → 管理者の予約一覧に出るか確認  
5. 予約者メールに確認メールが届くか確認  

---

## 6. Netlify で公開（任意・おすすめ）

1. Netlify にログイン  
2. `deploy\netlify-drop` を作り直すか、プロジェクトの HTML/JS/CSS をアップロード  
   - 必ず `supabase-config.js`（anon キー入り）を含める  
3. 公開 URL で同じ確認を行う  

---

## トラブルシュート

| 症状 | 確認 |
|------|------|
| 管理画面がログインできない | Auth ユーザー作成済みか、Confirm email、anon キー |
| 予約が管理者に見えない | SQL 実行済みか、ログイン後に再読み込み |
| メールが送れない | Edge Function デプロイ、Gmail アプリパスワード、secrets |
| まだ端末ごとにデータが違う | `supabase-config.js` の anon キーが空 → LocalStorage モードのまま |

anon キーが空のときは、従来どおり **ブラウザの LocalStorage** で動きます（デモ用）。
