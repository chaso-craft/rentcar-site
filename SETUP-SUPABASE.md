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
window.RENTCAR_SUPABASE_URL = "https://pppwaaucxkijywlkulj.supabase.co";
window.RENTCAR_SUPABASE_ANON_KEY = "ここにanonキー";
```

`service_role` キーは **書かない**でください。

---

## 3. 管理者ユーザーを作る（必須）

1. Supabase 左メニュー **Authentication → Users**  
2. **Add user** → **Create new user**  
3. 管理者用のメールとパスワードを設定（例: 店舗用 Gmail）  
4. このメール／パスワードで `admin.html` にログインします  

※ Authentication の「Confirm email」がオンの場合は、確認メールを完了するか、開発中は Confirm email をオフにしてください。

---

## 4. 予約確認メール（Edge Function）

PDFなしの HTML メールを Gmail から送ります。

### 4-1. Supabase CLI（初回だけ）

1. Node.js が入っていること  
2. PowerShell:

```powershell
npm install -g supabase
cd "C:\Users\mizuk\OneDrive\デスクトップ\カーソル\projects\rentcar-site"
supabase login
supabase link --project-ref pppwaaucxkijywlkulj
```

### 4-2. シークレット（Gmail）

```powershell
supabase secrets set GMAIL_SENDER=送信専用のGmailアドレス
supabase secrets set GMAIL_APP_PASSWORD=アプリパスワード16文字
```

### 4-3. デプロイ

```powershell
supabase functions deploy send-confirmation --no-verify-jwt
```

（予約完了時はログインしていないお客さんが呼ぶため `--no-verify-jwt` を付けます）

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
