import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import nodemailer from "npm:nodemailer@6.9.16";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

function formatYen(amount) {
  return `¥${Number(amount || 0).toLocaleString("ja-JP")}`;
}

function buildFallbackEmail(reservation, estimateDocument) {
  const name = reservation.customerName || "お客様";
  const docNo = estimateDocument?.documentNumber || "";
  const total = formatYen(estimateDocument?.total ?? reservation.estimatedTotal);
  const subject = `【GOTO rental car】ご予約ありがとうございます（${reservation.carType}）`;
  const text = [
    `${name} 様`,
    "",
    "このたびは GOTO rental car をご予約いただきありがとうございます。",
    "",
    `車種: ${reservation.carType}`,
    `貸出: ${reservation.startAt}`,
    `返却: ${reservation.endAt}`,
    `見積合計（税込）: ${total}`,
    docNo ? `見積書番号: ${docNo}` : "",
    "",
    "見積書をPDFで添付しております。ご確認ください。",
    "",
    "内容の確認・変更は店舗までご連絡ください。",
    "GOTO rental car"
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
    <div style="font-family:sans-serif;color:#0f172a;line-height:1.7;white-space:pre-wrap;">
      ${text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}
    </div>
  `;

  return { subject, text, html };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const gmailUser = Deno.env.get("GMAIL_SENDER") || "";
    const gmailPass = (Deno.env.get("GMAIL_APP_PASSWORD") || "").replace(/\s+/g, "");
    if (!gmailUser || !gmailPass) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "GMAIL_SENDER / GMAIL_APP_PASSWORD が未設定です。"
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const reservation = body?.reservation;
    const estimateDocument = body?.estimateDocument;
    const to = String(reservation?.email || "").trim();
    if (!to) {
      return new Response(JSON.stringify({ ok: false, error: "予約者のメールアドレスがありません。" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const fallback = buildFallbackEmail(reservation, estimateDocument);
    const subject = String(body?.subject || "").trim() || fallback.subject;
    const text = String(body?.text || "").trim() || fallback.text;
    const html = String(body?.html || "").trim() || fallback.html;
    const pdfBase64 = String(body?.pdfBase64 || "").trim();
    const pdfFilename = String(body?.pdfFilename || "").trim() || "見積書.pdf";

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: gmailUser, pass: gmailPass }
    });

    const mailOptions = {
      from: `GOTO rental car <${gmailUser}>`,
      to,
      subject,
      text,
      html
    };

    if (pdfBase64) {
      mailOptions.attachments = [
        {
          filename: pdfFilename,
          content: pdfBase64,
          encoding: "base64",
          contentType: "application/pdf"
        }
      ];
    }

    await transporter.sendMail(mailOptions);

    return new Response(JSON.stringify({ ok: true, to, attachedPdf: Boolean(pdfBase64) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error(error);
    return new Response(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : "メール送信に失敗しました。"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
