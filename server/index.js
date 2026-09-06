require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { generateEstimatePdf } = require("./lib/pdf");
const { buildReservationEmail } = require("./lib/emailContent");
const { sendReservationEmail, isMailConfigured, verifyMailConnection } = require("./lib/gmail");

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(
  cors({
    origin: true
  })
);
app.use(express.json({ limit: "2mb" }));

function checkApiSecret(req) {
  const expected = process.env.API_SECRET;
  if (!expected) return true;
  return req.get("x-api-key") === expected;
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    method: "smtp",
    sender: process.env.GMAIL_SENDER || null,
    mailConfigured: isMailConfigured()
  });
});

app.post("/api/reservation/send-confirmation", async (req, res) => {
  try {
    if (!checkApiSecret(req)) {
      res.status(401).json({ ok: false, error: "認証に失敗しました。" });
      return;
    }

    const { reservation, estimateDocument } = req.body || {};
    if (!reservation?.email || !estimateDocument) {
      res.status(400).json({
        ok: false,
        error: "reservation と estimateDocument が必要です。"
      });
      return;
    }

    const to = String(reservation.email).trim();
    const pdfBuffer = await generateEstimatePdf(estimateDocument);
    const pdfFilename = `見積書_${estimateDocument.documentNumber || "estimate"}.pdf`;
    const { subject, text, html } = buildReservationEmail(reservation, estimateDocument);

    await sendReservationEmail({
      to,
      subject,
      text,
      html,
      pdfBuffer,
      pdfFilename
    });

    res.json({ ok: true, message: "メールを送信しました。", to });
  } catch (error) {
    console.error("[send-confirmation]", error);
    res.status(500).json({
      ok: false,
      error: error.message || "メール送信に失敗しました。"
    });
  }
});

app.listen(PORT, async () => {
  console.log(`Rentcar mail server (SMTP): http://localhost:${PORT}`);
  console.log(`送信元: ${process.env.GMAIL_SENDER || "(未設定)"}`);

  if (isMailConfigured()) {
    try {
      await verifyMailConnection();
      console.log("SMTP 認証: OK");
    } catch (error) {
      console.error("SMTP 認証: 失敗");
      console.error(error.message);
      console.error("→ npm run test-smtp で確認するか、アプリパスワードを再発行してください。");
    }
  }
});
