# 予約完了メール送信サーバー（Gmail SMTP）

予約確定時に、会社 Gmail から予約者へ **予約完了メール** と **見積書PDF** を送ります。

- **送信方式**: Gmail SMTP（**Google Cloud 不要・課金登録不要**）
- **送信元**: `ailand.510.ai.send@gmail.com`（`.env` の `GMAIL_SENDER`）
- **送信先**: 予約フォームのメールアドレス

---

## 必要な準備

### 1. Node.js

https://nodejs.org/ から LTS 版をインストール済みであること。

### 2. Gmail アプリパスワードを発行

送信専用アカウント **ailand.510.ai.send@gmail.com** で:

1. [Google アカウント](https://myaccount.google.com/) → **セキュリティ**
2. **2段階認証プロセス** をオンにする
3. **アプリパスワード** を開く（検索欄に「アプリ パスワード」と入力）
4. アプリを選ぶ → **メール**、デバイス → **Windows パソコン** など
5. 表示された **16文字のパスワード** を控える

### 3. サーバー設定

```powershell
cd C:\Users\mizuk\rentcar-site\server
copy .env.example .env
npm install
```

`.env` を編集:

```env
GMAIL_SENDER=ailand.510.ai.send@gmail.com
GMAIL_APP_PASSWORD=abcdefghijklmnop
PORT=3001
API_SECRET=任意の長い文字列
```

`GMAIL_APP_PASSWORD` はスペースあり・なしどちらでも構いません。

### 4. 起動と確認

```powershell
npm start
```

ブラウザで `http://localhost:3001/api/health` を開き、次のようになれば OK です。

```json
{
  "ok": true,
  "method": "smtp",
  "sender": "ailand.510.ai.send@gmail.com",
  "mailConfigured": true
}
```

---

## 予約サイトとの連携

1. このサーバーを `npm start` で起動したままにする
2. 予約サイトを `http://localhost` 経由で開く（`file://` だと送信 API がブロックされることがあります）
3. 予約を確定すると、予約者メールへ PDF 付きメールが送られる

API の URL / キー（ブラウザの開発者ツールコンソール）:

```javascript
localStorage.setItem("rentcar-mail-api-url", "http://localhost:3001");
localStorage.setItem("rentcar-mail-api-secret", "あなたのAPI_SECRET");
```

---

## トラブルシューティング

| 症状 | 対処 |
|------|------|
| `mailConfigured: false` | `.env` の `GMAIL_SENDER` と `GMAIL_APP_PASSWORD` を確認 |
| `535` / Username and Password not accepted | **アプリパスワードを再発行**（下記）。通常のログインパスワードは不可 |
| メール送信に失敗（接続） | サーバーが起動しているか、ファイアウォールで 3001 を許可 |
| 予約サイトから失敗 | メールサーバー起動中か、CORS・`file://` ではなくローカルサーバーで開いているか |
| PDF 生成が遅い | 初回は Puppeteer のセットアップで時間がかかることがあります |

### 535 エラー（Invalid login）の直し方

1. ブラウザで **ailand.510.ai.send@gmail.com** だけにログインする（他の Gmail アカウントと混ざらないよう注意）
2. https://myaccount.google.com/apppasswords を開く  
   ※出ない場合: 先に **2段階認証** をオンにする
3. いま使っているアプリパスワードを **削除**
4. 新しく「メール」用のアプリパスワードを **作成**
5. 表示された **16文字** を `.env` の `GMAIL_APP_PASSWORD=` に貼る（`=` の右、引用符なし）
6. ターミナルで:
   ```powershell
   cd C:\Users\mizuk\rentcar-site\server
   npm run test-smtp
   ```
   `[OK]` と出たら `npm start` でサーバーを再起動

---

## 送信上限の目安

無料の Gmail アカウントは、1日あたりおおよそ **500通** まで（Google のポリシーは変更される場合があります）。  
レンタカー予約の件数であれば通常は十分です。

---

## 本番運用

- サーバーを Render / Railway / VPS などにデプロイ
- HTTPS の URL を `rentcar-mail-api-url` に設定
- `.env` はホスティング先の環境変数に設定（リポジトリにコミットしない）
