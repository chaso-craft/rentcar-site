import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import nodemailer from "npm:nodemailer@6.9.16";
import { PDFDocument, rgb } from "npm:pdf-lib@1.17.1";
import fontkit from "npm:@pdf-lib/fontkit@1.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

// OTF(CFF)は pdf-lib のサブセットで字形が壊れることがあるため、TTF を使う
const FONT_URL =
  "https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-jp@5.2.5/japanese-400-normal.ttf";

function formatYen(amount) {
  const n = Number(amount || 0);
  return `${n.toLocaleString("ja-JP")}円`;
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
  if (cache.__rentcarNotoJpTtf) return cache.__rentcarNotoJpTtf;
  const response = await fetch(FONT_URL);
  if (!response.ok) {
    throw new Error(`日本語フォントの取得に失敗しました（${response.status}）`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  cache.__rentcarNotoJpTtf = bytes;
  return bytes;
}

function wrapText(font, text, size, maxWidth) {
  const source = String(text ?? "");
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

function sanitizePdfText(value) {
  return String(value ?? "")
    .replace(/\u00a5/g, "円") // ¥
    .replace(/¥/g, "")
    .replace(/\u301c/g, "〜") // wave dash variants
    .replace(/\uff5e/g, "〜");
}

async function buildEstimatePdfBase64(reservation, estimateDocument, pdfMeta = {}) {
  const company = pdfMeta.company || {};
  const lineItems = Array.isArray(pdfMeta.lineItems) ? pdfMeta.lineItems : [];
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const font = await pdfDoc.embedFont(await loadJapaneseFontBytes(), { subset: true });

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  const marginX = 48;
  const contentWidth = pageWidth - marginX * 2;
  let y = pageHeight - 56;
  const color = rgb(0.06, 0.09, 0.16);
  const muted = rgb(0.35, 0.4, 0.48);
  const lineGap = 4;

  const ensureSpace = (need) => {
    if (y - need < 48) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - 56;
    }
  };

  const drawText = (text, size, x, textColor = color) => {
    const safe = sanitizePdfText(text);
    const lines = wrapText(font, safe, size, contentWidth - (x - marginX));
    for (const line of lines) {
      ensureSpace(size + lineGap);
      if (line) {
        page.drawText(line, { x, y, size, font, color: textColor });
      }
      y -= size + lineGap;
    }
  };

  const drawGap = (n = 10) => {
    y -= n;
  };

  const drawRule = () => {
    ensureSpace(12);
    page.drawLine({
      start: { x: marginX, y: y + 4 },
      end: { x: pageWidth - marginX, y: y + 4 },
      thickness: 1,
      color: rgb(0.82, 0.86, 0.9)
    });
    y -= 12;
  };

  const drawSection = (title) => {
    drawGap(6);
    drawText(title, 12, marginX);
    drawGap(2);
  };

  const drawKV = (label, value) => {
    const size = 10;
    const labelWidth = 92;
    const safeLabel = sanitizePdfText(label);
    const safeValue = sanitizePdfText(value);
    const valueLines = wrapText(font, safeValue, size, contentWidth - labelWidth - 8);
    const blockHeight = Math.max(1, valueLines.length) * (size + lineGap);
    ensureSpace(blockHeight);
    page.drawText(safeLabel, { x: marginX, y, size, font, color: muted });
    let valueY = y;
    for (const line of valueLines) {
      if (line) {
        page.drawText(line, { x: marginX + labelWidth, y: valueY, size, font, color });
      }
      valueY -= size + lineGap;
    }
    y -= blockHeight;
  };

  drawText(String(company.name || "GOTO rental car"), 16, marginX);
  drawText(String(company.address || ""), 9, marginX, muted);
  drawText(`TEL: ${company.phone || ""}`, 9, marginX, muted);
  drawText(`営業時間: ${company.hours || ""}`, 9, marginX, muted);
  drawGap(8);
  drawText("見積書", 20, marginX);
  drawText(`書類番号: ${estimateDocument?.documentNumber || ""}`, 10, marginX);
  drawText(`発行日: ${pdfMeta.issuedAtLabel || ""}`, 10, marginX);
  drawRule();

  drawSection("お客様情報");
  drawKV("お名前", reservation?.customerName || "");
  drawKV("電話番号", reservation?.phone || "");
  drawKV("メール", reservation?.email || "");

  drawSection("ご利用内容");
  drawKV("車種", pdfMeta.carLabel || reservation?.carType || "");
  drawKV("レンタル", pdfMeta.startLabel || "");
  drawKV("返却", pdfMeta.endLabel || "");
  drawKV("オプション", pdfMeta.optionsLabel || "");
  drawKV("お支払い", pdfMeta.paymentLabel || "");
  if (pdfMeta.notes) drawKV("備考", pdfMeta.notes);

  drawSection("料金明細（税込）");
  if (lineItems.length) {
    for (const item of lineItems) {
      const label = sanitizePdfText(item.label || "").replace(/円/g, "").trim();
      drawKV(label || "項目", formatYen(item.amount));
    }
  }
  drawGap(4);
  drawText(`合計（税込）: ${formatYen(estimateDocument?.total ?? reservation?.estimatedTotal)}`, 12, marginX);
  drawGap(12);
  drawText("本見積書の有効期限は発行日より30日間とします。", 9, marginX, muted);

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

    // クライアント生成PDFは使わず、サーバー側で常に作り直す（iPhone対策）
    const pdfBase64 = await buildEstimatePdfBase64(
      reservation,
      estimateDocument,
      body?.pdfMeta || {}
    );

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
