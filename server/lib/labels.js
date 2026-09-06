const PAYMENT_METHODS = {
  onSite: "現地支払い",
  bankTransfer: "銀行振り込み",
  airPay: "Air Pay"
};

const SEAT_OPTIONS = {
  babySeat: { label: "ベビーシート", price: 1000 },
  childSeat: { label: "チャイルドシート", price: 1000 },
  juniorSeat: { label: "ジュニアシート", price: 1000 }
};

const DROP_OFF_LOCATIONS = {
  none: { label: "乗り捨てなし" },
  fukueAirport: { label: "乗り捨て（福江空港）" },
  fukuePort: { label: "乗り捨て（福江港）" },
  otherDistance: { label: "乗り捨て（その他・10kmごと）" }
};

const COMPANY_INFO = {
  name: "GOTO rental car",
  address: "長崎県五島市上大津町324",
  phone: "090-1164-2562",
  hours: "9:00〜18:00"
};

function formatYen(amount) {
  return `¥${Number(amount).toLocaleString("ja-JP")}`;
}

function formatPaymentMethodLabel(method) {
  return PAYMENT_METHODS[method] || "未選択";
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("ja-JP");
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatBookingOptionsSummary(doc) {
  const options = doc.options || {};
  const parts = [];
  Object.entries(SEAT_OPTIONS).forEach(([key, config]) => {
    if (options[key]) parts.push(config.label);
  });
  if (options.studlessTire) parts.push("スタッドレスタイヤ");
  const dropOff = options.dropOff || "none";
  if (dropOff !== "none" && DROP_OFF_LOCATIONS[dropOff]) {
    parts.push(DROP_OFF_LOCATIONS[dropOff].label);
  }
  return parts.length > 0 ? parts.join("、") : "なし";
}

function formatEndpoint(doc, role) {
  const isStart = role === "start";
  const dateStr = (isStart ? doc.startAt : doc.endAt)?.split("T")[0] || "";
  const time = isStart ? doc.startTimeSelection : doc.endTimeSelection;
  if (!dateStr) return "—";
  if (time === "before-hours" || doc.startOutsideHours && isStart) {
    return `${formatDate(`${dateStr}T09:00`)} 営業時間前`;
  }
  if (time === "after-hours" || doc.endOutsideHours && !isStart) {
    return `${formatDate(`${dateStr}T18:00`)} 営業時間後`;
  }
  const clock = time || (isStart ? doc.startAt : doc.endAt)?.split("T")[1]?.substring(0, 5) || "";
  return `${formatDate(`${dateStr}T${clock || "09:00"}`)} ${clock}`;
}

module.exports = {
  COMPANY_INFO,
  formatYen,
  formatPaymentMethodLabel,
  formatDate,
  formatDateTime,
  formatBookingOptionsSummary,
  formatEndpoint
};
