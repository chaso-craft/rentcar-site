# Netlify で公開する

## いちばん簡単な方法（Netlify Drop）

1. 下の「フォルダを作り直す」を実行する  
2. エクスプローラーで `projects\rentcar-site\deploy\netlify-drop` を開く  
3. ブラウザで https://app.netlify.com/drop を開く（Netlify にログイン）  
4. **`netlify-drop` フォルダごと** 画面にドラッグ＆ドロップ  
5. 表示された URL（例: `https://random-name-123.netlify.app`）を控える  

### 開くページ

| 用途 | URL |
|------|-----|
| 予約サイト | `https://あなたのURL.netlify.app/` または `.../index.html` |
| 管理者サイト | `https://あなたのURL.netlify.app/admin.html` |
| 見積・領収書 | `https://あなたのURL.netlify.app/admin-documents.html` |

管理者は Supabase に登録したメール／パスワードでログインします。

---

## フォルダを作り直す

PowerShell:

```powershell
cd "C:\Users\mizuk\OneDrive\デスクトップ\カーソル\projects\rentcar-site"
.\scripts\prepare-netlify-drop.ps1
```

`deploy\netlify-drop` に、公開に必要な HTML / CSS / JS（Supabase 設定含む）が入ります。

---

## 知っておくこと

1. **予約データは Supabase に保存**されます。スマホや別PCの管理画面でも同じ予約が見えます。  
2. **予約確認メール**は、まだ Edge Function 未デプロイなら送れません（予約自体は完了します）。  
3. **管理者URLは関係者だけに共有**してください（ログインは必要ですが、URLを広く出さない方が安全です）。  
4. Cursor で直した内容を毎回自動反映したい場合は、次の段階で GitHub 連携を設定します。

---

## 更新したとき（手動）

1. `prepare-netlify-drop.ps1` を再実行  
2. Netlify のサイト画面で、新しい `netlify-drop` を再度ドラッグ＆ドロップ（または Deploys → ドラッグ）
