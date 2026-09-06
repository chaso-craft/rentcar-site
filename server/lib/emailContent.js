const {
  formatYen,
  formatPaymentMethodLabel,
  formatEndpoint,
  formatBookingOptionsSummary,
  COMPANY_INFO
} = require("./labels");

function buildReservationEmail(reservation, estimateDocument) {
  const subject = `【${COMPANY_INFO.name}】ご予約ありがとうございます（予約完了）`;

  const textLines = [
    `${reservation.customerName} 様`,
    "",
    "この度はご予約いただきありがとうございます。",
    "予約が完了しました。内容は以下のとおりです。",
    "",
    "■ 予約内容",
    `お名前: ${reservation.customerName}`,
    `電話番号: ${reservation.phone}`,
    `メール: ${reservation.email}`,
    `車種: ${reservation.carType}`,
    `レンタル: ${formatEndpoint(estimateDocument, "start")}`,
    `返却: ${formatEndpoint(estimateDocument, "end")}`,
    `オプション: ${formatBookingOptionsSummary(estimateDocument)}`,
    `お支払い方法: ${formatPaymentMethodLabel(reservation.paymentMethod)}`,
    `合計（税込）: ${formatYen(estimateDocument.total)}`,
    estimateDocument.notes ? `備考: ${estimateDocument.notes}` : "",
    "",
    `見積書番号: ${estimateDocument.documentNumber}`,
    "",
    "見積書をPDFで添付しております。ご確認ください。",
    "",
    "――――――――――――――",
    COMPANY_INFO.name,
    COMPANY_INFO.address,
    `TEL: ${COMPANY_INFO.phone}`,
    `営業時間: ${COMPANY_INFO.hours}`
  ].filter(Boolean);

  const text = textLines.join("\n");

  const html = `
    <div style="font-family:sans-serif;color:#0f172a;line-height:1.6;">
      <p>${reservation.customerName} 様</p>
      <p>この度はご予約いただきありがとうございます。<strong>予約が完了しました。</strong></p>
      <h3 style="margin:20px 0 8px;">予約内容</h3>
      <table style="border-collapse:collapse;width:100%;max-width:520px;">
        <tr><td style="padding:4px 8px;color:#64748b;">お名前</td><td>${reservation.customerName}</td></tr>
        <tr><td style="padding:4px 8px;color:#64748b;">電話</td><td>${reservation.phone}</td></tr>
        <tr><td style="padding:4px 8px;color:#64748b;">車種</td><td>${reservation.carType}</td></tr>
        <tr><td style="padding:4px 8px;color:#64748b;">レンタル</td><td>${formatEndpoint(estimateDocument, "start")}</td></tr>
        <tr><td style="padding:4px 8px;color:#64748b;">返却</td><td>${formatEndpoint(estimateDocument, "end")}</td></tr>
        <tr><td style="padding:4px 8px;color:#64748b;">合計（税込）</td><td><strong>${formatYen(estimateDocument.total)}</strong></td></tr>
        <tr><td style="padding:4px 8px;color:#64748b;">お支払い</td><td>${formatPaymentMethodLabel(reservation.paymentMethod)}</td></tr>
      </table>
      <p style="margin-top:16px;">見積書（${estimateDocument.documentNumber}）をPDFで添付しています。</p>
      <hr style="margin:24px 0;border:none;border-top:1px solid #e2e8f0;">
      <p style="font-size:12px;color:#64748b;">
        ${COMPANY_INFO.name}<br>
        ${COMPANY_INFO.address}<br>
        TEL: ${COMPANY_INFO.phone}
      </p>
    </div>
  `;

  return { subject, text, html };
}

module.exports = { buildReservationEmail };
