/**
 * SMTP 認証テスト: node scripts/test-smtp.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const nodemailer = require("nodemailer");

const user = process.env.GMAIL_SENDER;
const pass = String(process.env.GMAIL_APP_PASSWORD || "").replace(/\s/g, "");

async function tryTransport(label, options) {
  const transporter = nodemailer.createTransport(options);
  try {
    await transporter.verify();
    console.log(`[OK] ${label}`);
    return true;
  } catch (error) {
    console.log(`[NG] ${label}: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log("送信元:", user);
  console.log("パスワード長:", pass.length, "文字（16であることが理想）\n");

  if (!user || !pass) {
    console.error(".env の GMAIL_SENDER / GMAIL_APP_PASSWORD を確認してください。");
    process.exit(1);
  }

  const configs = [
    {
      label: "ポート 587 (STARTTLS)",
      options: {
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        requireTLS: true,
        auth: { user, pass }
      }
    },
    {
      label: "ポート 465 (SSL)",
      options: {
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: { user, pass }
      }
    }
  ];

  for (const config of configs) {
    const ok = await tryTransport(config.label, config.options);
    if (ok) {
      console.log("\n認証成功。この設定でメール送信できます。");
      process.exit(0);
    }
  }

  console.log(`
認証に失敗しました（535 エラー）。

確認してください:
1. アプリパスワードは「ailand.510.ai.send@gmail.com」でログインした状態で発行したか
2. 通常の Gmail ログインパスワードではなく「アプリパスワード」16文字か
3. https://myaccount.google.com/apppasswords で古いパスワードを削除し、新しく発行
4. .env の GMAIL_SENDER がメールアドレスと完全一致しているか
`);
  process.exit(1);
}

main();
