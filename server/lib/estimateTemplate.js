const {
  COMPANY_INFO,
  formatYen,
  formatPaymentMethodLabel,
  formatDate,
  formatBookingOptionsSummary,
  formatEndpoint
} = require("./labels");

function buildEstimateHtml(doc) {
  const lineItems = (doc.breakdown || [])
    .filter((item) => !item.isInfo && !item.isTotal && typeof item.amount === "number")
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.label)}</td>
          <td class="amount">${formatYen(item.amount)}</td>
        </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; }
    body { font-family: "Yu Gothic", "Meiryo", sans-serif; color: #0f172a; margin: 0; padding: 24px; font-size: 12px; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; }
    .company-name { font-size: 16px; font-weight: bold; margin: 0 0 6px; }
    .title { font-size: 22px; letter-spacing: 0.15em; margin: 0 0 8px; text-align: right; }
    h2 { font-size: 13px; margin: 16px 0 8px; color: #334155; }
    table { width: 100%; border-collapse: collapse; margin-top: 6px; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
    th { background: #f1f5f9; }
    .amount { text-align: right; white-space: nowrap; }
    .total td { font-weight: bold; background: #f8fafc; }
    dl { display: grid; grid-template-columns: 100px 1fr; gap: 4px 10px; margin: 0; }
    dt { color: #64748b; }
    dd { margin: 0; }
    .note { margin-top: 16px; color: #475569; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <p class="company-name">${escapeHtml(COMPANY_INFO.name)}</p>
      <p>${escapeHtml(COMPANY_INFO.address)}</p>
      <p>TEL: ${escapeHtml(COMPANY_INFO.phone)}</p>
      <p>営業時間: ${escapeHtml(COMPANY_INFO.hours)}</p>
    </div>
    <div>
      <h1 class="title">見 積 書</h1>
      <p style="text-align:right;margin:0;">No. ${escapeHtml(doc.documentNumber || "")}</p>
      <p style="text-align:right;margin:4px 0 0;">発行日: ${escapeHtml(formatDate(doc.issuedAt))}</p>
    </div>
  </div>

  <h2>お客様情報</h2>
  <dl>
    <dt>お名前</dt><dd>${escapeHtml(doc.customerName)}</dd>
    <dt>電話番号</dt><dd>${escapeHtml(doc.phone)}</dd>
    <dt>メール</dt><dd>${escapeHtml(doc.email)}</dd>
  </dl>

  <h2>ご利用内容</h2>
  <dl>
    <dt>車種</dt><dd>${escapeHtml(doc.carType)}</dd>
    <dt>レンタル</dt><dd>${escapeHtml(formatEndpoint(doc, "start"))}</dd>
    <dt>返却</dt><dd>${escapeHtml(formatEndpoint(doc, "end"))}</dd>
    <dt>オプション</dt><dd>${escapeHtml(formatBookingOptionsSummary(doc))}</dd>
    <dt>お支払い</dt><dd>${escapeHtml(formatPaymentMethodLabel(doc.paymentMethod))}</dd>
    ${doc.notes ? `<dt>備考</dt><dd>${escapeHtml(doc.notes)}</dd>` : ""}
  </dl>

  <h2>料金明細（税込）</h2>
  <table>
    <thead><tr><th>項目</th><th>金額</th></tr></thead>
    <tbody>
      ${lineItems}
      <tr class="total"><td>合計</td><td class="amount">${formatYen(doc.total)}</td></tr>
    </tbody>
  </table>
  <p class="note">本見積書の有効期限は発行日より30日間とします。</p>
</body>
</html>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

module.exports = { buildEstimateHtml };
