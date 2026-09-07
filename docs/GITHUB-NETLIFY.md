# Cursor 編集 → 自動反映（GitHub + Netlify）

## いまできていること

- プロジェクトに Git を初期化済み
- 最初のコミット済み

## A. GitHub にリポジトリを作る

1. https://github.com/new を開く（GitHub にログイン）
2. **Repository name**: `rentcar-site`
3. **Public** または **Private**（どちらでも可。非公開なら Private）
4. **「Add a README」などは追加しない**（空のまま）
5. **Create repository** をクリック
6. 次の画面に出る URL を控える  
   例: `https://github.com/あなたのユーザー名/rentcar-site.git`

## B. ローカルから push する

Cursor のターミナル（または PowerShell）で:

```powershell
cd "C:\Users\mizuk\OneDrive\デスクトップ\カーソル\projects\rentcar-site"
git remote add origin https://github.com/あなたのユーザー名/rentcar-site.git
git push -u origin main
```

※ 初回は GitHub ログインを求められることがあります。

## C. Netlify と GitHub をつなぐ

すでに公開中のサイト **silver-fairy-345c8a** がある場合:

1. https://app.netlify.com で **silver-fairy-345c8a** を開く
2. **Project configuration**（または Site configuration）→ **Build & deploy**
3. **Continuous deployment** / **Link repository**（または Import from Git）
4. **GitHub** を選び、`rentcar-site` リポジトリを選択
5. 設定例:
   - **Branch**: `main`
   - **Build command**: （空でOK）
   - **Publish directory**: `.`（または空 / ルート）
6. 保存・デプロイ

※ Drop サイトから Git 連携に切り替えられない場合は、  
  **Add new site → Import an existing project → GitHub** で新規に同じリポジトリを公開し、  
  新しい URL を本番として使ってください。

## D. これから編集したとき

1. Cursor でファイルを直す
2. コミットして push:

```powershell
cd "C:\Users\mizuk\OneDrive\デスクトップ\カーソル\projects\rentcar-site"
git add -A
git commit -m "更新内容のメモ"
git push
```

3. 数十秒〜数分で Netlify のサイトに反映されます

（コミット／push は、Cursor の Source Control 画面からでもできます）
