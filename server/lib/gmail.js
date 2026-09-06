const nodemailer = require("nodemailer");

function isMailConfigured() {
  return Boolean(process.env.GMAIL_SENDER && process.env.GMAIL_APP_PASSWORD);
}

function getMailAuth() {
  const user = String(process.env.GMAIL_SENDER || "").trim();
  const pass = String(process.env.GMAIL_APP_PASSWORD || "").replace(/\s/g, "");

  if (!user || !pass) {
    throw new Error(
      "Gmail SMTP の設定が不足しています。.env に GMAIL_SENDER と GMAIL_APP_PASSWORD（アプリパスワード）を設定してください。"
    );
  }

  if (pass.length !== 16) {
    throw new Error(
      `アプリパスワードは16文字です（現在 ${pass.length} 文字）。Google の「アプリパスワード」画面で再発行してください。`
    );
  }

  return { user, pass };
}

function getTransporter() {
  const { user, pass } = getMailAuth();

  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    requireTLS: true,
    auth: { user, pass }
  });
}

async function verifyMailConnection() {
  const transporter = getTransporter();
  await transporter.verify();
}

async function sendReservationEmail({ to, subject, text, html, pdfBuffer, pdfFilename }) {
  const from = process.env.GMAIL_SENDER.trim();
  const transporter = getTransporter();

  try {
    await transporter.sendMail({
      from: `"GOTO rental car" <${from}>`,
      to,
      subject,
      text,
      html,
      attachments: pdfBuffer
        ? [
            {
              filename: pdfFilename,
              content: pdfBuffer,
              contentType: "application/pdf"
            }
          ]
        : []
    });
  } catch (error) {
    if (String(error.message).includes("535")) {
      throw new Error(
        "Gmail のログインに失敗しました。アプリパスワードが間違っているか、別の Google アカウントで発行した可能性があります。https://myaccount.google.com/apppasswords で ailand.510.ai.send@gmail.com にログインし、新しいアプリパスワードを発行して .env を更新してください。"
      );
    }
    throw error;
  }
}

module.exports = { sendReservationEmail, isMailConfigured, verifyMailConnection };
