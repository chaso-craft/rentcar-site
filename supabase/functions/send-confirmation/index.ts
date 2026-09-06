import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import nodemailer from "npm:nodemailer@6.9.16";
import { PDFDocument, rgb } from "npm:pdf-lib@1.17.1";
import fontkit from "npm:@pdf-lib/fontkit@1.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

const FONT_URL =
  "https://cdn.jsdelivr.net/gh/googlefonts/noto-cjk@main/Sans/SubsetOTF/JP/NotoSansJP-Regular.otf";

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

async function loadJapaneseFontBytes() {
  const cache = globalThis;
  if (cache.__rentcarNotoJpFont) return cache.__rentcarNotoJpFont;
  const response = await fetch(FONT_URL);
  if (!response.ok) {
    throw new Error(`日本語フォントの取得に失敗しました（${response.status}）`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  cache.__rentcarNotoJpFont = bytes;
  return bytes;
}

function wrapText(font, text, size, maxWidth) {
  const source = String(text || "");
  if (!source) return [""];
  const lines = [];
  let current = "";
  for (const char of source) {
    if (char === "\n") {
      lines.push(current);
      current = "";
      continue;
    }
    const next = current + char;
    if (font.widthOfTextAtSize(next, size) > maxWidth && current) {
      lines.push(current);
      current = char;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

async function buildEstimatePdfBase64(reservation, estimateDocument, pdfMeta = {}) {
  const company = pdfMeta.company || {};
  const lineItems = Array.isArray(pdfMeta.lineItems) ? pdfMeta.lineItems : [];
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const font = await pdfDoc.embedFont(await loadJapaneseFontBytes(), { subset: true });
  let page = pdfDoc.addPage([595.28, 841.89]);
  const marginX = 48;
  const maxWidth = 595.28 - marginX * 2;
  let y = 792;
  const color = rgb(0.06, 0.09, 0.16);
  const muted = rgb(0.29, 0.33, 0.41);

  const ensureSpace = (need) => {
    if (y - need < 48) {
      page = pdfDoc.addPage([595.28, 841.89]);
      y = 792;
    }
  };

  const drawLine = (text, size = 10, textColor = color) => {
    const lines = wrapText(font, text, size, maxWidth);
    for (const line of lines) {
      ensureSpace(size + 6);
      page.drawText(line, { x: marginX, y, size, font, color: textColor });
      y -= size + 6;
    }
  };

  const drawGap = (n = 8) => {
    y -= n;
  };

  drawLine(String(company.name || "GOTO rental car"), 14);
  drawLine(String(company.address || ""), 9, muted);
  drawLine(`TEL: ${company.phone || ""}`, 9, muted);
  drawLine(`営業時間: ${company.hours || ""}`, 9, muted);
  drawGap(10);
  drawLine("見積書", 18);
  drawLine(`No. ${estimateDocument?.documentNumber || ""}`, 10);
  drawLine(`発行日: ${pdfMeta.issuedAtLabel || ""}`, 10);
  drawGap(14);

  drawLine("お客様情報", 12);
  drawLine(`お名前: ${reservation?.customerName || ""}`);
  drawLine(`電話番号: ${reservation?.phone || ""}`);
  drawLine(`メール: ${reservation?.email || ""}`);
  drawGap(12);

  drawLine("ご利用内容", 12);
  drawLine(`車種: ${pdfMeta.carLabel || reservation?.carType || ""}`);
  drawLine(`レンタル: ${pdfMeta.startLabel || ""}`);
  drawLine(`返却: ${pdfMeta.endLabel || ""}`);
  drawLine(`オプション: ${pdfMeta.optionsLabel || ""}`);
  drawLine(`お支払い: ${pdfMeta.paymentLabel || ""}`);
  if (pdfMeta.notes) drawLine(`備考: ${pdfMeta.notes}`);
  drawGap(12);

  drawLine("料金明細（税込）", 12);
  if (lineItems.length) {
    for (const item of lineItems) {
      drawLine(`${item.label || ""}  ${formatYen(item.amount)}`);
    }
  } else {
    drawLine(`合計  ${formatYen(estimateDocument?.total ?? reservation?.estimatedTotal)}`);
  }
  drawGap(4);
  drawLine(`合計（税込）: ${formatYen(estimateDocument?.total ?? reservation?.estimatedTotal)}`, 12);
  drawGap(14);
  drawLine("本見積書の有効期限は発行日より30日間とします。", 9, muted);

  const bytes = await pdfDoc.save();
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
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
    const pdfFilename =
      String(body?.pdfFilename || "").trim() ||
      `見積書_${estimateDocument?.documentNumber || "estimate"}.pdf`;

    let pdfBase64 = String(body?.pdfBase64 || "").trim();
    if (!pdfBase64) {
      pdfBase64 = await buildEstimatePdfBase64(reservation, estimateDocument, body?.pdfMeta || {});
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: gmailUser, pass: gmailPass }
    });

    await transporter.sendMail({
      from: `GOTO rental car <${gmailUser}>`,
      to,
      subject,
      text,
      html,
      attachments: [
        {
          filename: pdfFilename,
          content: pdfBase64,
          encoding: "base64",
          contentType: "application/pdf"
        }
      ]
    });

    return new Response(JSON.stringify({ ok: true, to, attachedPdf: true }), {
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
