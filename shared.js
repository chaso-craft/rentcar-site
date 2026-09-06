const STORAGE_KEY = "rentcar-site-data-v1";
const PENDING_RESERVATION_KEY = "rentcar-pending-reservation";
const COMPLETED_RESERVATION_KEY = "rentcar-completed-reservation";
const ADMIN_SESSION_KEY = "rentcar-admin-session";
const ADMIN_PASSWORD_KEY = "rentcar-admin-password";
const DEFAULT_ADMIN_PASSWORD = "admin";
const CAR_TYPES = ["LIFE", "SOLIO", "ROOMY"];

const DEFAULT_SITE = {
  name: "GOTO rental car",
  tagline: "五島で、気ままに走る。",
  address: "長崎県五島市上大津町324",
  phone: "090-1164-2562",
  hours: "9:00〜18:00",
  closed: "なし",
  about:
    "五島列島・福江島を拠点に、観光やお仕事での移動をサポートするレンタカーです。空港・港への乗り捨てにも対応しています。",
  icon: "",
  emailSubject: "",
  emailBody: ""
};

const DEFAULT_EMAIL_TEMPLATE = {
  subject: "【{{shopName}}】ご予約ありがとうございます（{{carLabel}}）",
  body: `{{customerName}} 様

この度はご予約いただきありがとうございます。
予約が完了しました。内容は以下のとおりです。

■ 予約内容
お名前: {{customerName}}
電話番号: {{phone}}
メール: {{email}}
車種: {{carLabel}}
レンタル: {{start}}
返却: {{end}}
オプション: {{options}}
お支払い方法: {{paymentMethod}}
合計（税込）: {{total}}
見積書番号: {{documentNumber}}

見積書をPDFで添付しております。ご確認ください。

――――――――――――――
{{shopName}}
{{shopAddress}}
TEL: {{shopPhone}}
営業時間: {{shopHours}}`
};

const DEFAULT_SITE_ICON =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#22d3ee"/><stop offset="1" stop-color="#0e7490"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="url(#g)"/><text x="32" y="44" text-anchor="middle" font-family="Arial,sans-serif" font-size="34" font-weight="700" fill="#fff">G</text></svg>'
  );

const DEFAULT_RATES = {
  kei: { h6: 4950, h12: 5500, h24: 6600, daily: 5500, hourly: 1100 },
  standard: { h6: 5500, h12: 6600, h24: 7700, daily: 6600, hourly: 1100 }
};

const DEFAULT_CATALOG = {
  LIFE: {
    name: "ホンダ ライフ",
    seats: 4,
    transmission: "AT",
    description: "島の細い道も走りやすい軽自動車。少人数の観光や買い物におすすめです。",
    images: []
  },
  SOLIO: {
    name: "スズキ ソリオ",
    seats: 5,
    transmission: "AT",
    description: "荷物も人も積みやすいコンパクトカー。ご家族やカップルの移動に便利です。",
    images: []
  },
  ROOMY: {
    name: "トヨタ ルーミー",
    seats: 5,
    transmission: "AT",
    description: "室内が広く乗り降りしやすいミニバンタイプ。グループでの観光に向いています。",
    images: []
  }
};

const DEFAULT_DATA = {
  fleet: {
    LIFE: 1,
    SOLIO: 1,
    ROOMY: 1
  },
  catalog: JSON.parse(JSON.stringify(DEFAULT_CATALOG)),
  site: { ...DEFAULT_SITE },
  rates: JSON.parse(JSON.stringify(DEFAULT_RATES)),
  reservations: [],
  documents: []
};

const COMPANY_INFO = DEFAULT_SITE;

/** http 環境の iPhone Safari など randomUUID 非対応向け */
function createUniqueId(prefix = "id") {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function mergeFleet(savedFleet) {
  const fleet = { ...DEFAULT_DATA.fleet };
  if (!savedFleet) return fleet;
  CAR_TYPES.forEach((type) => {
    if (typeof savedFleet[type] === "number" && savedFleet[type] >= 0) {
      fleet[type] = savedFleet[type];
    }
  });
  return fleet;
}

function mergeSite(savedSite) {
  const site = { ...DEFAULT_SITE, ...(savedSite && typeof savedSite === "object" ? savedSite : {}) };
  const icon = String(site.icon || "");
  if (icon && !(icon.startsWith("data:image/") || icon.startsWith("http://") || icon.startsWith("https://"))) {
    site.icon = "";
  }
  site.emailSubject = String(site.emailSubject || "");
  site.emailBody = String(site.emailBody || "");
  return site;
}

function getEmailTemplate() {
  const site = getCompanyInfo();
  return {
    subject: String(site.emailSubject || "").trim() || DEFAULT_EMAIL_TEMPLATE.subject,
    body: String(site.emailBody || "").trim() || DEFAULT_EMAIL_TEMPLATE.body
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildEmailPlaceholderMap(reservation, estimateDocument) {
  const company = getCompanyInfo();
  const booking = {
    carType: estimateDocument?.carType || reservation.carType,
    startDate: (estimateDocument?.startAt || reservation.startAt || "").split("T")[0],
    endDate: (estimateDocument?.endAt || reservation.endAt || "").split("T")[0],
    startTime: estimateDocument?.startTimeSelection || reservation.startTimeSelection,
    endTime: estimateDocument?.endTimeSelection || reservation.endTimeSelection,
    options: estimateDocument?.options || reservation.options
  };
  return {
    customerName: reservation.customerName || "お客様",
    phone: reservation.phone || "",
    email: reservation.email || "",
    carType: reservation.carType || "",
    carLabel: getCarLabel(reservation.carType),
    start: formatBookingEndpointLabel(booking.startDate, booking.startTime, "start"),
    end: formatBookingEndpointLabel(booking.endDate, booking.endTime, "end"),
    options: formatBookingOptionsSummary(estimateDocument || reservation),
    paymentMethod: formatPaymentMethodLabel(reservation.paymentMethod),
    total: formatYen(estimateDocument?.total ?? reservation.estimatedTotal),
    documentNumber: estimateDocument?.documentNumber || "",
    notes: reservation.notes || estimateDocument?.notes || "",
    shopName: company.name || "",
    shopAddress: company.address || "",
    shopPhone: company.phone || "",
    shopHours: company.hours || ""
  };
}

function applyEmailPlaceholders(template, map) {
  return String(template || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) =>
    Object.prototype.hasOwnProperty.call(map, key) ? String(map[key] ?? "") : ""
  );
}

function buildReservationEmailContent(reservation, estimateDocument) {
  const template = getEmailTemplate();
  const map = buildEmailPlaceholderMap(reservation, estimateDocument);
  const subject = applyEmailPlaceholders(template.subject, map).replace(/\s+/g, " ").trim();
  const text = applyEmailPlaceholders(template.body, map).trim();
  const html = `
    <div style="font-family:sans-serif;color:#0f172a;line-height:1.7;white-space:pre-wrap;">
      ${escapeHtml(text)}
    </div>
  `;
  return { subject, text, html };
}

async function generateEstimatePdfAttachment(estimateDocument) {
  if (typeof html2pdf !== "function") {
    throw new Error("PDF生成ライブラリが読み込まれていません。");
  }
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText =
    "position:fixed;left:-12000px;top:0;width:794px;background:#fff;padding:24px;z-index:-1;";
  document.body.appendChild(host);
  try {
    renderDocumentSheet(host, estimateDocument);
    const sheet = host.querySelector(".document-sheet");
    if (!sheet) throw new Error("見積書の描画に失敗しました。");
    const dataUri = await html2pdf()
      .set({
        margin: [10, 10, 10, 10],
        image: { type: "jpeg", quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
      })
      .from(sheet)
      .outputPdf("datauristring");
    const pdfBase64 = String(dataUri || "").split(",")[1] || "";
    if (!pdfBase64) throw new Error("PDFの生成に失敗しました。");
    return {
      pdfBase64,
      pdfFilename: `見積書_${estimateDocument.documentNumber || "estimate"}.pdf`
    };
  } finally {
    host.remove();
  }
}

function mergeCatalog(savedCatalog) {
  const catalog = JSON.parse(JSON.stringify(DEFAULT_CATALOG));
  if (!savedCatalog || typeof savedCatalog !== "object") return catalog;
  CAR_TYPES.forEach((type) => {
    if (savedCatalog[type] && typeof savedCatalog[type] === "object") {
      catalog[type] = {
        ...catalog[type],
        ...savedCatalog[type],
        images: normalizeCarImages(savedCatalog[type].images)
      };
    }
  });
  return catalog;
}

function mergeRates(savedRates) {
  const rates = JSON.parse(JSON.stringify(DEFAULT_RATES));
  ["kei", "standard"].forEach((category) => {
    const source = savedRates && savedRates[category];
    if (!source || typeof source !== "object") return;
    ["h6", "h12", "h24", "daily", "hourly"].forEach((key) => {
      const value = Number(source[key]);
      if (Number.isFinite(value) && value >= 0) {
        rates[category][key] = Math.round(value);
      }
    });
  });
  return rates;
}

function normalizeCarImages(images) {
  if (!Array.isArray(images)) return [];
  return images
    .filter((item) => {
      if (!item || typeof item.dataUrl !== "string") return false;
      return (
        item.dataUrl.startsWith("data:image/") ||
        item.dataUrl.startsWith("http://") ||
        item.dataUrl.startsWith("https://")
      );
    })
    .map((item) => ({
      id: item.id || createUniqueId("img"),
      dataUrl: item.dataUrl
    }));
}

let dataCache = null;
let remoteDataMode = false;
let dataLoadPromise = null;

function loadDataFromLocalStorage() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_DATA));
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }
  try {
    const parsed = JSON.parse(raw);
    return {
      fleet: mergeFleet(parsed.fleet),
      catalog: mergeCatalog(parsed.catalog),
      site: mergeSite(parsed.site),
      rates: mergeRates(parsed.rates),
      reservations: Array.isArray(parsed.reservations) ? parsed.reservations : [],
      documents: Array.isArray(parsed.documents) ? parsed.documents : []
    };
  } catch (_error) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_DATA));
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }
}

function saveDataToLocalStorage(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (_error) {
    throw new Error("保存容量を超えました。画像を減らすか、もっと小さい画像にしてください。");
  }
}

function loadData() {
  if (!dataCache) {
    dataCache = loadDataFromLocalStorage();
  }
  return dataCache;
}

async function saveData(data) {
  dataCache = data;
  if (remoteDataMode && typeof window.persistRentcarData === "function") {
    await window.persistRentcarData(data);
    return;
  }
  saveDataToLocalStorage(data);
}

async function ensureDataLoaded() {
  if (dataLoadPromise) return dataLoadPromise;
  dataLoadPromise = (async () => {
    const configured =
      typeof window.isSupabaseConfigured === "function" && window.isSupabaseConfigured();
    if (configured && typeof window.fetchRentcarData === "function") {
      remoteDataMode = true;
      dataCache = await window.fetchRentcarData();
      return dataCache;
    }
    remoteDataMode = false;
    dataCache = loadDataFromLocalStorage();
    return dataCache;
  })();
  try {
    return await dataLoadPromise;
  } catch (error) {
    dataLoadPromise = null;
    throw error;
  }
}

function isRemoteDataMode() {
  return remoteDataMode;
}

async function reloadRemoteData() {
  dataLoadPromise = null;
  dataCache = null;
  return ensureDataLoaded();
}

function getRentalRates() {
  return loadData().rates;
}

function getSiteIcon() {
  const icon = getCompanyInfo().icon;
  if (
    icon &&
    (String(icon).startsWith("data:image/") ||
      String(icon).startsWith("http://") ||
      String(icon).startsWith("https://"))
  ) {
    return icon;
  }
  return DEFAULT_SITE_ICON;
}

function getCarImages(carType) {
  return normalizeCarImages(getCarCatalogEntry(carType).images);
}

function getCarCoverImage(carType) {
  return getCarImages(carType)[0]?.dataUrl || "";
}

function fileToCompressedDataUrl(file, maxSize, mimeType, quality) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith("image/")) {
      reject(new Error("画像ファイルを選んでください。"));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("画像を読み込めませんでした。"));
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d");
        if (mimeType === "image/jpeg") {
          context.fillStyle = "#ffffff";
          context.fillRect(0, 0, canvas.width, canvas.height);
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL(mimeType, quality));
      };
      image.onerror = () => reject(new Error("画像を開けませんでした。"));
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function getCompanyInfo() {
  return loadData().site;
}

function getCarCatalogEntry(carType) {
  const entry = loadData().catalog[carType];
  if (entry) return entry;
  return {
    name: carType,
    seats: "",
    transmission: "AT",
    description: "",
    images: []
  };
}

function getCarVisualClass(carType) {
  if (carType === "LIFE") return "car-life";
  if (carType === "SOLIO") return "car-solio";
  return "car-roomy";
}

function createCarVisualElement(carType, extraClass = "") {
  const cover = getCarCoverImage(carType);
  const className = `car-visual ${extraClass}`.trim();
  if (cover) {
    const img = document.createElement("img");
    img.className = `${className} car-photo`;
    img.src = cover;
    img.alt = getCarLabel(carType);
    return img;
  }
  const div = document.createElement("div");
  div.className = `${className} ${getCarVisualClass(carType)}`;
  div.setAttribute("aria-hidden", "true");
  div.textContent = "🚗";
  return div;
}

function getCarLabel(carType) {
  return getCarCatalogEntry(carType).name || carType;
}

function applySiteBrand() {
  const info = getCompanyInfo();
  document.querySelectorAll("[data-company-name]").forEach((el) => {
    el.textContent = info.name;
  });
  document.querySelectorAll("[data-company-tagline]").forEach((el) => {
    el.textContent = info.tagline;
  });
  document.querySelectorAll("[data-company-address]").forEach((el) => {
    el.textContent = info.address;
  });
  document.querySelectorAll("[data-company-phone]").forEach((el) => {
    el.textContent = info.phone;
  });
  document.querySelectorAll("[data-company-hours]").forEach((el) => {
    el.textContent = info.hours;
  });
  document.querySelectorAll("[data-company-closed]").forEach((el) => {
    el.textContent = info.closed;
  });
  document.querySelectorAll("[data-company-about]").forEach((el) => {
    el.textContent = info.about;
  });
  document.querySelectorAll('a[data-company-tel]').forEach((el) => {
    el.href = `tel:${String(info.phone).replace(/[^\d+]/g, "")}`;
  });
  applySiteIcon();
}

function applySiteIcon() {
  const href = getSiteIcon();
  const isSvg = href.startsWith("data:image/svg");
  let link = document.querySelector('link[rel="icon"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.type = isSvg ? "image/svg+xml" : "image/png";
  link.href = href;

  let apple = document.querySelector('link[rel="apple-touch-icon"]');
  if (!apple) {
    apple = document.createElement("link");
    apple.rel = "apple-touch-icon";
    document.head.appendChild(apple);
  }
  apple.href = href;

  document.querySelectorAll(".logo-mark").forEach((el) => {
    let img = el.querySelector(".logo-mark-img");
    if (!img) {
      img = document.createElement("img");
      img.className = "logo-mark-img";
      img.alt = "";
      el.appendChild(img);
    }
    img.src = href;
    el.classList.add("has-icon-image");
  });
}

function isAdminLoggedIn() {
  return sessionStorage.getItem(ADMIN_SESSION_KEY) === "ok";
}

function getAdminPassword() {
  return localStorage.getItem(ADMIN_PASSWORD_KEY) || DEFAULT_ADMIN_PASSWORD;
}

function setAdminPassword(password) {
  localStorage.setItem(ADMIN_PASSWORD_KEY, password);
}

function loginAdmin(password) {
  if (String(password) !== getAdminPassword()) return false;
  sessionStorage.setItem(ADMIN_SESSION_KEY, "ok");
  return true;
}

function logoutAdmin() {
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
}

function getReservationCountsByType(data) {
  const counts = Object.fromEntries(CAR_TYPES.map((type) => [type, 0]));
  data.reservations.forEach((item) => {
    if (item.status !== "キャンセル") {
      counts[item.carType] = (counts[item.carType] || 0) + 1;
    }
  });
  return counts;
}

function reservationOverlapsPeriod(reservation, startAt, endAt) {
  if (reservation.status === "キャンセル") return false;
  const period = getReservationPeriod(reservation);
  if (!period) return false;
  const requestStart = new Date(startAt);
  const requestEnd = new Date(endAt);
  if (Number.isNaN(requestStart.getTime()) || Number.isNaN(requestEnd.getTime())) return false;
  return requestStart < period.end && requestEnd > period.start;
}

function getAvailableCarTypes(data, startAt, endAt) {
  return CAR_TYPES.filter((type) => {
    const stock = data.fleet[type] || 0;
    const overlapping = data.reservations.filter(
      (reservation) =>
        reservation.carType === type && reservationOverlapsPeriod(reservation, startAt, endAt)
    ).length;
    return overlapping < stock;
  });
}

function isValidCarType(carType) {
  return CAR_TYPES.includes(carType);
}

function formatSearchTimeLabel(timeValue) {
  if (timeValue === BEFORE_HOURS_VALUE) return "営業時間前";
  if (timeValue === AFTER_HOURS_VALUE) return "営業時間後";
  if (timeValue === OUTSIDE_HOURS_VALUE) return "時間外";
  return timeValue;
}

function buildCarDetailUrl(params) {
  const search = new URLSearchParams({
    carType: params.carType,
    startDate: params.startDate,
    startTime: params.startTime,
    endDate: params.endDate,
    endTime: params.endTime
  });
  return `./car-detail.html?${search.toString()}`;
}

function buildIndexSearchUrl(params) {
  const search = new URLSearchParams();
  if (params.startDate) search.set("startDate", params.startDate);
  if (params.startTime) search.set("startTime", params.startTime);
  if (params.endDate) search.set("endDate", params.endDate);
  if (params.endTime) search.set("endTime", params.endTime);
  const query = search.toString();
  return query ? `./index.html?${query}` : "./index.html";
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ja-JP");
}

const BEFORE_HOURS_VALUE = "before-hours";
const AFTER_HOURS_VALUE = "after-hours";
const OUTSIDE_HOURS_VALUE = "outside-hours";
const BUSINESS_OPEN_TIME = "09:00";
const BUSINESS_CLOSE_TIME = "18:00";
const OUTSIDE_HOURS_SURCHARGE = 2000;
const OUTSIDE_HOURS_OPTION_NOTE = "（営業時間外オプションを含む）";

const SEAT_OPTIONS = {
  babySeat: { label: "ベビーシート", price: 1000 },
  childSeat: { label: "チャイルドシート", price: 1000 },
  juniorSeat: { label: "ジュニアシート", price: 1000 }
};

const ADDON_OPTIONS = {
  studlessTire: { label: "スタッドレスタイヤ", price: 2000 }
};

const DROP_OFF_LOCATIONS = {
  none: { label: "乗り捨てなし", price: 0 },
  fukueAirport: { label: "乗り捨て（福江空港）", price: 500 },
  fukuePort: { label: "乗り捨て（福江港）", price: 500 },
  otherDistance: {
    label: "乗り捨て（その他・10kmごと）",
    price: 0,
    note: "当日現地で距離を計算のうえ事前にお支払い（10kmごと¥1,000）"
  }
};

const PAYMENT_METHODS = {
  onSite: { label: "現地支払い" },
  bankTransfer: { label: "銀行振り込み" },
  airPay: { label: "Air Pay" }
};

function formatPaymentMethodLabel(method) {
  if (!method || !PAYMENT_METHODS[method]) return "未選択";
  return PAYMENT_METHODS[method].label;
}

function isValidPaymentMethod(method) {
  return Boolean(method && PAYMENT_METHODS[method]);
}

function isPaymentPaid(reservation) {
  return reservation?.paymentPaid === true;
}

function formatPaymentStatusLabel(reservation) {
  return isPaymentPaid(reservation) ? "支払い済み" : "未払い";
}

function getReservationsStartingOnDay(reservations, cellDate) {
  const dayStart = startOfLocalDay(cellDate).getTime();
  return reservations.filter((reservation) => {
    const period = getReservationPeriod(reservation);
    if (!period) return false;
    return startOfLocalDay(period.start).getTime() === dayStart;
  });
}

function formatReservationStartDayNames(reservations, cellDate) {
  return getReservationsStartingOnDay(reservations, cellDate)
    .map((reservation) => reservation.customerName)
    .join("、");
}

const SCHEDULE_SLOT_MINUTES = 30;
const SLOTS_PER_DAY = (24 * 60) / SCHEDULE_SLOT_MINUTES;

function getDayEnd(dayStart) {
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  return dayEnd;
}

function reservationOverlapsDay(reservation, dayDate) {
  if (reservation.status === "キャンセル") return false;
  const period = getReservationPeriod(reservation);
  if (!period) return false;
  const dayStart = startOfLocalDay(dayDate);
  const dayEnd = getDayEnd(dayStart);
  return period.start < dayEnd && period.end > dayStart;
}

function getReservationDaySlice(reservation, dayDate) {
  if (!reservationOverlapsDay(reservation, dayDate)) return null;
  const period = getReservationPeriod(reservation);
  const dayStart = startOfLocalDay(dayDate);
  const dayEnd = getDayEnd(dayStart);
  const sliceStart = period.start < dayStart ? dayStart : period.start;
  const sliceEnd = period.end > dayEnd ? dayEnd : period.end;
  if (sliceEnd <= sliceStart) return null;
  return { start: sliceStart, end: sliceEnd, reservation };
}

function getReservationsOverlappingDay(data, dayDate) {
  return data.reservations.filter((reservation) => reservationOverlapsDay(reservation, dayDate));
}

function getMaxConcurrentOnDay(reservations, carType, dayDate) {
  const events = [];
  reservations.forEach((reservation) => {
    if (reservation.carType !== carType || reservation.status === "キャンセル") return;
    const slice = getReservationDaySlice(reservation, dayDate);
    if (!slice) return;
    events.push({ time: slice.start.getTime(), delta: 1 });
    events.push({ time: slice.end.getTime(), delta: -1 });
  });
  events.sort((a, b) => a.time - b.time || a.delta - b.delta);
  let current = 0;
  let max = 0;
  events.forEach((event) => {
    current += event.delta;
    max = Math.max(max, current);
  });
  return max;
}

function getDayInventoryByCarType(data, dayDate) {
  const overlapping = getReservationsOverlappingDay(data, dayDate);
  const inventory = {};
  CAR_TYPES.forEach((carType) => {
    const total = data.fleet[carType] || 0;
    const peakUsed = getMaxConcurrentOnDay(overlapping, carType, dayDate);
    const reservationCount = overlapping.filter((r) => r.carType === carType).length;
    inventory[carType] = {
      total,
      peakUsed,
      reservationCount,
      available: Math.max(total - peakUsed, 0)
    };
  });
  return inventory;
}

function dateToDayPercent(date, dayStart) {
  const elapsedMs = date.getTime() - dayStart.getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  const percent = (elapsedMs / dayMs) * 100;
  return Math.min(100, Math.max(0, percent));
}

function formatScheduleClock(date) {
  return date.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

function formatScheduleDayTitle(dayDate, label) {
  const weekday = dayDate.toLocaleDateString("ja-JP", { weekday: "short" });
  return `${label}（${dayDate.getFullYear()}年${dayDate.getMonth() + 1}月${dayDate.getDate()}日・${weekday}）`;
}

function formatScheduleBlockTitle(reservation, slice) {
  const startLabel = formatReservationEndpointText(reservation, "start");
  const endLabel = formatReservationEndpointText(reservation, "end");
  return `${reservation.customerName} / ${reservation.carType}\n${startLabel} 〜 ${endLabel}\n当日表示: ${formatScheduleClock(slice.start)}〜${formatScheduleClock(slice.end)}`;
}

function getDefaultBookingOptions() {
  return {
    babySeat: false,
    childSeat: false,
    juniorSeat: false,
    studlessTire: false,
    dropOff: "none"
  };
}

function normalizeBookingOptions(options) {
  const normalized = getDefaultBookingOptions();
  if (!options) return normalized;
  return {
    ...normalized,
    ...options,
    dropOff: DROP_OFF_LOCATIONS[options.dropOff] ? options.dropOff : "none"
  };
}

function parseBookingOptionsFromForm(formData) {
  return {
    babySeat: formData.get("option_babySeat") === "on",
    childSeat: formData.get("option_childSeat") === "on",
    juniorSeat: formData.get("option_juniorSeat") === "on",
    studlessTire: formData.get("option_studlessTire") === "on",
    dropOff: formData.get("option_dropOff") || "none"
  };
}

function calculateAddonOptionsBreakdown(options) {
  const normalized = normalizeBookingOptions(options);
  const lines = [];
  let total = 0;

  Object.entries(SEAT_OPTIONS).forEach(([key, config]) => {
    if (!normalized[key]) return;
    lines.push({ label: config.label, amount: config.price, isAddon: true });
    total += config.price;
  });

  if (normalized.studlessTire) {
    const config = ADDON_OPTIONS.studlessTire;
    lines.push({ label: config.label, amount: config.price, isAddon: true });
    total += config.price;
  }

  if (normalized.dropOff && normalized.dropOff !== "none") {
    const dropOff = DROP_OFF_LOCATIONS[normalized.dropOff];
    lines.push({
      label: dropOff.note ? `${dropOff.label}（${dropOff.note}）` : dropOff.label,
      amount: dropOff.price,
      isAddon: true,
      isOnSitePayment: dropOff.price === 0
    });
    total += dropOff.price;
  }

  return { total, lines };
}

function formatBookingOptionsSummary(booking) {
  const normalized = normalizeBookingOptions(booking.options);
  const parts = [];

  Object.entries(SEAT_OPTIONS).forEach(([key, config]) => {
    if (normalized[key]) parts.push(`${config.label}（${formatYen(config.price)}）`);
  });

  if (normalized.studlessTire) {
    parts.push(`${ADDON_OPTIONS.studlessTire.label}（${formatYen(ADDON_OPTIONS.studlessTire.price)}）`);
  }

  if (normalized.dropOff && normalized.dropOff !== "none") {
    const dropOff = DROP_OFF_LOCATIONS[normalized.dropOff];
    if (dropOff.price === 0) {
      parts.push(`${dropOff.label}（¥0・当日現地計算）`);
    } else {
      parts.push(`${dropOff.label}（${formatYen(dropOff.price)}）`);
    }
  }

  return parts.length ? parts.join("、") : "なし";
}

function applyBookingOptionsToForm(form, options) {
  const normalized = normalizeBookingOptions(options);
  Object.keys(SEAT_OPTIONS).forEach((key) => {
    const input = form.querySelector(`[name="option_${key}"]`);
    if (input) input.checked = Boolean(normalized[key]);
  });
  const studlessInput = form.querySelector('[name="option_studlessTire"]');
  if (studlessInput) studlessInput.checked = Boolean(normalized.studlessTire);
  const dropOffInput = form.querySelector(`[name="option_dropOff"][value="${normalized.dropOff}"]`);
  if (dropOffInput) dropOffInput.checked = true;
}

const CAR_PRICING_CATEGORY = {
  LIFE: "kei",
  SOLIO: "standard",
  ROOMY: "standard"
};

const CAR_CATEGORY_LABEL = {
  kei: "軽自動車",
  standard: "普通車"
};

/** 貸渡料金表の初期値（管理画面の料金管理から変更可能） */
const RENTAL_RATES_TAX_INCL = DEFAULT_RATES;

function formatYen(amount) {
  return `¥${Number(amount).toLocaleString("ja-JP")}`;
}

function getRentalDurationHours(startAt, endAt) {
  const start = new Date(startAt);
  const end = new Date(endAt);
  const ms = end.getTime() - start.getTime();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (1000 * 60 * 60));
}

function calculateBaseRentalPrice(category, hours) {
  const rates = getRentalRates()[category];
  const breakdown = [];
  let base = 0;
  const categoryLabel = CAR_CATEGORY_LABEL[category];

  if (hours <= 6) {
    base = rates.h6;
    breakdown.push({
      label: `基本料金（6時間まで・${categoryLabel}）`,
      amount: base
    });
  } else if (hours <= 12) {
    base = rates.h12;
    breakdown.push({
      label: `基本料金（12時間まで・${categoryLabel}）`,
      amount: base
    });
  } else if (hours <= 24) {
    base = rates.h24;
    breakdown.push({
      label: `基本料金（24時間まで・${categoryLabel}）`,
      amount: base
    });
  } else {
    const extraHours = hours - 24;
    const extraDays = Math.floor(extraHours / 24);
    const remainderHours = extraHours % 24;
    base = rates.h24;
    breakdown.push({
      label: `基本料金（24時間まで・${categoryLabel}）`,
      amount: rates.h24
    });
    if (extraDays > 0) {
      const dayAmount = extraDays * rates.daily;
      base += dayAmount;
      breakdown.push({
        label: `追加日数（${extraDays}日 × ${formatYen(rates.daily)}）`,
        amount: dayAmount
      });
    }
    if (remainderHours > 0) {
      const hourAmount = remainderHours * rates.hourly;
      base += hourAmount;
      breakdown.push({
        label: `超過時間（${remainderHours}時間 × ${formatYen(rates.hourly)}）`,
        amount: hourAmount
      });
    }
  }

  return { base, breakdown };
}

function isOutsideBusinessOption(timeStr) {
  return (
    timeStr === BEFORE_HOURS_VALUE ||
    timeStr === AFTER_HOURS_VALUE ||
    timeStr === OUTSIDE_HOURS_VALUE
  );
}

function normalizeTimeSelection(timeStr, role) {
  if (timeStr === OUTSIDE_HOURS_VALUE) {
    return role === "end" ? AFTER_HOURS_VALUE : BEFORE_HOURS_VALUE;
  }
  return timeStr;
}

function formatTimeSelectionLabel(timeStr, role) {
  const normalized = normalizeTimeSelection(timeStr, role);
  if (normalized === BEFORE_HOURS_VALUE) return "営業時間前";
  if (normalized === AFTER_HOURS_VALUE) return "営業時間後";
  return timeStr;
}

function toPricingDateTime(dateStr, timeStr, role) {
  const normalized = normalizeTimeSelection(timeStr, role);
  if (normalized === BEFORE_HOURS_VALUE) {
    return `${dateStr}T${BUSINESS_OPEN_TIME}`;
  }
  if (normalized === AFTER_HOURS_VALUE) {
    return `${dateStr}T${BUSINESS_CLOSE_TIME}`;
  }
  return `${dateStr}T${timeStr}`;
}

function hasOutsideBusinessOption(booking) {
  return (
    isOutsideBusinessOption(booking.startTime) ||
    isOutsideBusinessOption(booking.endTime)
  );
}

function formatPriceWithOptionNote(total, booking) {
  const price = formatYen(total);
  if (hasOutsideBusinessOption(booking)) {
    return `${price}${OUTSIDE_HOURS_OPTION_NOTE}`;
  }
  return price;
}

function formatBookingEndpointLabel(dateStr, timeStr, role) {
  if (isOutsideBusinessOption(timeStr)) {
    return `${formatDate(toPricingDateTime(dateStr, timeStr, role))} ${formatTimeSelectionLabel(timeStr, role)}`;
  }
  return `${formatDate(`${dateStr}T${timeStr}`)} ${timeStr}`;
}

function getReservationTimeSelection(reservation, role) {
  if (role === "start" && reservation.startTimeSelection) {
    return reservation.startTimeSelection;
  }
  if (role === "end" && reservation.endTimeSelection) {
    return reservation.endTimeSelection;
  }
  const isOutside = role === "start" ? reservation.startOutsideHours : reservation.endOutsideHours;
  if (isOutside) {
    return role === "start" ? BEFORE_HOURS_VALUE : AFTER_HOURS_VALUE;
  }
  const iso = role === "start" ? reservation.startAt : reservation.endAt;
  return iso?.split("T")[1]?.substring(0, 5) || "";
}

function calculateRentalPrice(booking) {
  const startAt = toPricingDateTime(booking.startDate, booking.startTime, "start");
  const endAt = toPricingDateTime(booking.endDate, booking.endTime, "end");
  const hours = getRentalDurationHours(startAt, endAt);
  const category = CAR_PRICING_CATEGORY[booking.carType] || "standard";
  const { base, breakdown } = calculateBaseRentalPrice(category, hours);

  const fullBreakdown = [
    { label: `レンタル時間：${hours}時間（営業時間基準）`, isInfo: true },
    ...breakdown
  ];

  let outsideHoursTotal = 0;
  if (isOutsideBusinessOption(booking.startTime)) {
    outsideHoursTotal += OUTSIDE_HOURS_SURCHARGE;
    fullBreakdown.push({
      label: `営業時間外オプション代（レンタル・${formatTimeSelectionLabel(booking.startTime, "start")}）`,
      amount: OUTSIDE_HOURS_SURCHARGE,
      isOption: true
    });
  }
  if (isOutsideBusinessOption(booking.endTime)) {
    outsideHoursTotal += OUTSIDE_HOURS_SURCHARGE;
    fullBreakdown.push({
      label: `営業時間外オプション代（返却・${formatTimeSelectionLabel(booking.endTime, "end")}）`,
      amount: OUTSIDE_HOURS_SURCHARGE,
      isOption: true
    });
  }

  const addonResult = calculateAddonOptionsBreakdown(booking.options);
  addonResult.lines.forEach((line) => {
    fullBreakdown.push({ ...line, isOption: true });
  });

  const total = base + outsideHoursTotal + addonResult.total;
  fullBreakdown.push({ label: "合計（税込）", amount: total, isTotal: true });

  return {
    total,
    baseTotal: base,
    outsideHoursTotal,
    addonOptionTotal: addonResult.total,
    optionTotal: outsideHoursTotal + addonResult.total,
    hours,
    category,
    categoryLabel: CAR_CATEGORY_LABEL[category],
    breakdown: fullBreakdown
  };
}

function renderPriceBreakdownList(container, priceResult) {
  container.innerHTML = "";
  const list = document.createElement("ul");
  list.className = "price-breakdown-list";

  priceResult.breakdown.forEach((item) => {
    const li = document.createElement("li");
    if (item.isInfo) {
      li.className = "price-breakdown-info";
      li.textContent = item.label;
    } else if (item.isOption) {
      li.className = item.isOnSitePayment ? "price-breakdown-onsite" : "price-breakdown-option";
      li.innerHTML = `<span>${item.label}</span><span>${formatYen(item.amount)}</span>`;
    } else if (item.isTotal) {
      li.className = "price-breakdown-total";
      li.innerHTML = `<span>${item.label}</span><strong>${formatYen(item.amount)}</strong>`;
    } else {
      li.innerHTML = `<span>${item.label}</span><span>${formatYen(item.amount)}</span>`;
    }
    list.appendChild(li);
  });

  container.appendChild(list);
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function formatIsoDateLocal(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** 現時刻 + 1 時間を 30 分刻みに切り上げた最短予約開始日時 */
function roundUpTo30Minutes(date) {
  const result = new Date(date.getTime());
  const minutes = result.getMinutes();
  const seconds = result.getSeconds();
  const milliseconds = result.getMilliseconds();

  if (minutes % 30 === 0 && seconds === 0 && milliseconds === 0) {
    return result;
  }

  let roundedMinutes = Math.ceil(minutes / 30) * 30;
  if (roundedMinutes >= 60) {
    result.setHours(result.getHours() + 1);
    roundedMinutes = 0;
  }
  result.setMinutes(roundedMinutes, 0, 0);
  return result;
}

const BOOKING_LEAD_TIME_MS = 60 * 60 * 1000;

function getMinimumBookableDateTime(now = new Date()) {
  return roundUpTo30Minutes(new Date(now.getTime() + BOOKING_LEAD_TIME_MS));
}

function isStartDateTimeBookable(startDate, startTime) {
  if (!startDate || !startTime) return true;
  const bookingMs = new Date(toPricingDateTime(startDate, startTime, "start")).getTime();
  const minMs = getMinimumBookableDateTime().getTime();
  return bookingMs >= minMs;
}

function getEarliestBookableDateStr() {
  const minDt = getMinimumBookableDateTime();
  const dateStr = formatIsoDateLocal(minDt);
  const timeOptions = [...buildBusinessTimeSlots(), BEFORE_HOURS_VALUE, AFTER_HOURS_VALUE];
  const hasOption = timeOptions.some((time) => isStartDateTimeBookable(dateStr, time));
  if (hasOption) return dateStr;

  const nextDay = new Date(minDt);
  nextDay.setDate(nextDay.getDate() + 1);
  return formatIsoDateLocal(nextDay);
}

function applyStartTimeRestrictions(startSelectEl, startDate) {
  const previous = startSelectEl.value;
  fillTimeSelect(startSelectEl);

  Array.from(startSelectEl.options).forEach((option) => {
    option.disabled = !isStartDateTimeBookable(startDate, option.value);
  });

  if (previous && isStartDateTimeBookable(startDate, previous)) {
    startSelectEl.value = previous;
    return;
  }

  const firstValid = Array.from(startSelectEl.options).find((option) => !option.disabled);
  startSelectEl.value = firstValid ? firstValid.value : "";
}

function applyDateInputMinConstraints(startDateInput, endDateInput) {
  const minDateStr = getEarliestBookableDateStr();

  if (startDateInput) {
    startDateInput.min = minDateStr;
    if (startDateInput.value && startDateInput.value < minDateStr) {
      startDateInput.value = "";
    }
  }

  if (endDateInput) {
    const startDate = startDateInput?.value;
    const endMin = startDate && startDate >= minDateStr ? startDate : minDateStr;
    endDateInput.min = endMin;
    if (endDateInput.value && endDateInput.value < endMin) {
      endDateInput.value = "";
    }
  }
}

function buildBusinessTimeSlots() {
  const slots = [];
  for (let hour = 9; hour <= 18; hour += 1) {
    slots.push(`${pad2(hour)}:00`);
    if (hour !== 18) {
      slots.push(`${pad2(hour)}:30`);
    }
  }
  return slots;
}

function fillTimeSelect(selectEl) {
  const slots = buildBusinessTimeSlots();
  const html = slots.map((time) => `<option value="${time}">${time}</option>`).join("");
  selectEl.innerHTML = `${html}<option value="${BEFORE_HOURS_VALUE}">営業時間前</option><option value="${AFTER_HOURS_VALUE}">営業時間後</option>`;
}

function toReservationDateTime(dateStr, timeStr, role) {
  return toPricingDateTime(dateStr, timeStr, role);
}

function isValidReservationPeriod(startDate, startTime, endDate, endTime) {
  if (!isStartDateTimeBookable(startDate, startTime)) {
    return false;
  }
  if (!isEndTimeAllowed(startDate, startTime, endDate, endTime)) {
    return false;
  }
  const startAt = toPricingDateTime(startDate, startTime, "start");
  const endAt = toPricingDateTime(endDate, endTime, "end");
  return new Date(startAt) < new Date(endAt);
}

function isEndTimeAllowed(startDate, startTime, endDate, endTime) {
  if (!startDate || !endDate || !startTime || !endTime) return true;
  if (startDate !== endDate) return true;
  const startMs = new Date(toPricingDateTime(startDate, startTime, "start")).getTime();
  const endMs = new Date(toPricingDateTime(endDate, endTime, "end")).getTime();
  return endMs > startMs;
}

function applySameDayEndTimeRestrictions(endSelectEl, startDate, startTime, endDate) {
  const previous = endSelectEl.value;
  fillTimeSelect(endSelectEl);

  if (!startDate || !endDate || startDate !== endDate) {
    if (previous && Array.from(endSelectEl.options).some((option) => option.value === previous)) {
      endSelectEl.value = previous;
    }
    return;
  }

  Array.from(endSelectEl.options).forEach((option) => {
    option.disabled = !isEndTimeAllowed(startDate, startTime, endDate, option.value);
  });

  if (isEndTimeAllowed(startDate, startTime, endDate, previous)) {
    endSelectEl.value = previous;
    return;
  }

  const firstValid = Array.from(endSelectEl.options).find((option) => !option.disabled);
  endSelectEl.value = firstValid ? firstValid.value : "";
}

function formatReservationEndpointText(reservation, role) {
  const isStart = role === "start";
  const dateStr = (isStart ? reservation.startAt : reservation.endAt)?.split("T")[0];
  const timeSelection = getReservationTimeSelection(reservation, role);
  if (dateStr && isOutsideBusinessOption(timeSelection)) {
    return formatBookingEndpointLabel(dateStr, timeSelection, role);
  }
  const iso = isStart ? reservation.startAt : reservation.endAt;
  const datePart = formatDate(iso);
  const timeStr = iso?.split("T")[1]?.substring(0, 5) || "";
  return `${datePart} ${timeStr}`.trim();
}

function formatReservationPeriodText(reservation) {
  return `${formatReservationEndpointText(reservation, "start")} 〜 ${formatReservationEndpointText(reservation, "end")}`;
}

function formatReservationPeriodHtml(reservation) {
  const start = formatReservationEndpointHtml(reservation, "start");
  const end = formatReservationEndpointHtml(reservation, "end");
  return `${start} 〜 ${end}`;
}

function formatReservationEndpointHtml(reservation, role) {
  const isStart = role === "start";
  const dateStr = (isStart ? reservation.startAt : reservation.endAt)?.split("T")[0];
  const timeSelection = getReservationTimeSelection(reservation, role);
  if (dateStr && isOutsideBusinessOption(timeSelection)) {
    const label = formatTimeSelectionLabel(timeSelection, role);
    const tag = isStart ? `営業時間外レンタル（${label}）` : `営業時間外返却（${label}）`;
    return `${formatDate(toPricingDateTime(dateStr, timeSelection, role))} <span class="outside-hours-tag">${tag}</span>`;
  }
  const iso = isStart ? reservation.startAt : reservation.endAt;
  const datePart = formatDate(iso);
  const timeStr = iso?.split("T")[1]?.substring(0, 5) || "";
  return `${datePart} ${timeStr}`.trim();
}

const PHONE_COUNTRY_CODES = [
  { dial: "+81", label: "日本 (+81)" },
  { dial: "+82", label: "韓国 (+82)" },
  { dial: "+86", label: "中国 (+86)" },
  { dial: "+886", label: "台湾 (+886)" },
  { dial: "+852", label: "香港 (+852)" },
  { dial: "+853", label: "マカオ (+853)" },
  { dial: "+1", label: "アメリカ / カナダ (+1)" },
  { dial: "+44", label: "イギリス (+44)" },
  { dial: "+61", label: "オーストラリア (+61)" },
  { dial: "+64", label: "ニュージーランド (+64)" },
  { dial: "+65", label: "シンガポール (+65)" },
  { dial: "+60", label: "マレーシア (+60)" },
  { dial: "+66", label: "タイ (+66)" },
  { dial: "+84", label: "ベトナム (+84)" },
  { dial: "+63", label: "フィリピン (+63)" },
  { dial: "+62", label: "インドネシア (+62)" },
  { dial: "+91", label: "インド (+91)" },
  { dial: "+33", label: "フランス (+33)" },
  { dial: "+49", label: "ドイツ (+49)" },
  { dial: "+39", label: "イタリア (+39)" },
  { dial: "+34", label: "スペイン (+34)" },
  { dial: "+31", label: "オランダ (+31)" },
  { dial: "+41", label: "スイス (+41)" },
  { dial: "+46", label: "スウェーデン (+46)" },
  { dial: "+47", label: "ノルウェー (+47)" },
  { dial: "+45", label: "デンマーク (+45)" },
  { dial: "+358", label: "フィンランド (+358)" },
  { dial: "+7", label: "ロシア (+7)" },
  { dial: "+55", label: "ブラジル (+55)" },
  { dial: "+52", label: "メキシコ (+52)" },
  { dial: "+971", label: "UAE (+971)" },
  { dial: "+966", label: "サウジアラビア (+966)" },
  { dial: "+90", label: "トルコ (+90)" },
  { dial: "+27", label: "南アフリカ (+27)" }
];

function getPhoneCountryOptions() {
  const japan = PHONE_COUNTRY_CODES.find((item) => item.dial === "+81");
  const others = PHONE_COUNTRY_CODES.filter((item) => item.dial !== "+81").sort((a, b) =>
    a.label.localeCompare(b.label, "ja")
  );
  return japan ? [japan, ...others] : others;
}

function fillPhoneCountrySelect(selectEl) {
  const options = getPhoneCountryOptions();
  selectEl.innerHTML = options
    .map((item) => `<option value="${item.dial}">${item.label}</option>`)
    .join("");
  selectEl.value = "+81";
}

function formatPhoneWithHyphens(digits) {
  const onlyDigits = String(digits).replace(/\D/g, "");
  if (!onlyDigits) return "";

  if (onlyDigits.length <= 10) {
    const part1 = onlyDigits.slice(0, 3);
    const part2 = onlyDigits.slice(3, 6);
    const part3 = onlyDigits.slice(6, 10);
    if (onlyDigits.length <= 3) return part1;
    if (onlyDigits.length <= 6) return `${part1}-${part2}`;
    return `${part1}-${part2}-${part3}`;
  }

  const part1 = onlyDigits.slice(0, 3);
  const part2 = onlyDigits.slice(3, 7);
  const part3 = onlyDigits.slice(7, 11);
  const rest = onlyDigits.slice(11);
  if (onlyDigits.length <= 3) return part1;
  if (onlyDigits.length <= 7) return `${part1}-${part2}`;
  const main = `${part1}-${part2}-${part3}`;
  return rest ? `${main}${rest}` : main;
}

function formatPhoneWithCountry(dialCode, phoneNumber) {
  const cleaned = String(phoneNumber).trim().replace(/\s+/g, "");
  if (!cleaned) return "";
  return `${dialCode} ${cleaned}`;
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function startOfLocalDay(date) {
  const d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function getReservationPeriod(reservation) {
  const startRaw = reservation.startAt ?? reservation.startDate;
  const endRaw = reservation.endAt ?? reservation.endDate;
  if (!startRaw || !endRaw) return null;
  const start = new Date(startRaw);
  const end = new Date(endRaw);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return { start, end };
}

function reservationCoversCalendarDay(reservation, cellDate) {
  if (reservation.status === "キャンセル") return false;
  const period = getReservationPeriod(reservation);
  if (!period) return false;
  const day = startOfLocalDay(cellDate);
  const from = startOfLocalDay(period.start);
  const to = startOfLocalDay(period.end);
  return day >= from && day <= to;
}

function reservationToBooking(reservation) {
  const startDate = reservation.startAt?.split("T")[0] || "";
  const endDate = reservation.endAt?.split("T")[0] || "";
  let startTime = reservation.startTimeSelection;
  let endTime = reservation.endTimeSelection;
  if (!startTime && reservation.startOutsideHours) startTime = BEFORE_HOURS_VALUE;
  if (!endTime && reservation.endOutsideHours) endTime = AFTER_HOURS_VALUE;
  if (!startTime) startTime = reservation.startAt?.split("T")[1]?.substring(0, 5) || BUSINESS_OPEN_TIME;
  if (!endTime) endTime = reservation.endAt?.split("T")[1]?.substring(0, 5) || BUSINESS_CLOSE_TIME;
  return {
    carType: reservation.carType,
    startDate,
    endDate,
    startTime,
    endTime,
    options: reservation.options || getDefaultBookingOptions()
  };
}

function generateDocumentNumber(type, issuedAt, documents) {
  const prefix = type === "estimate" ? "M" : "R";
  const date = new Date(issuedAt);
  const datePart = `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}`;
  const sameDayCount = documents.filter(
    (doc) => doc.type === type && doc.documentNumber?.startsWith(`${prefix}${datePart}`)
  ).length;
  return `${prefix}${datePart}-${pad2(sameDayCount + 1)}`;
}

function buildDocumentSnapshot(reservation, type, priceResult, issuedAt) {
  const breakdown = priceResult.breakdown.map((item) => ({ ...item }));
  return {
    id: createUniqueId("doc"),
    reservationId: reservation.id,
    type,
    documentNumber: "",
    issuedAt,
    customerName: reservation.customerName,
    phone: reservation.phone,
    email: reservation.email,
    carType: reservation.carType,
    startAt: reservation.startAt,
    endAt: reservation.endAt,
    startTimeSelection: reservation.startTimeSelection,
    endTimeSelection: reservation.endTimeSelection,
    startOutsideHours: reservation.startOutsideHours,
    endOutsideHours: reservation.endOutsideHours,
    paymentMethod: reservation.paymentMethod,
    options: reservation.options || getDefaultBookingOptions(),
    notes: reservation.notes || "",
    total: priceResult.total,
    baseTotal: priceResult.baseTotal,
    optionTotal: priceResult.optionTotal,
    breakdown,
    reservationStatus: reservation.status
  };
}

function ensureEstimateDocument(data, reservation, priceResult) {
  const existing = data.documents.find(
    (doc) => doc.reservationId === reservation.id && doc.type === "estimate"
  );
  if (existing) return existing;

  const result = priceResult || calculateRentalPrice(reservationToBooking(reservation));
  const issuedAt = reservation.createdAt || new Date().toISOString();
  const doc = buildDocumentSnapshot(reservation, "estimate", result, issuedAt);
  doc.documentNumber = generateDocumentNumber("estimate", issuedAt, data.documents);
  data.documents.push(doc);
  return doc;
}

function ensureReceiptDocument(data, reservation, priceResult) {
  const existing = data.documents.find(
    (doc) => doc.reservationId === reservation.id && doc.type === "receipt"
  );
  if (existing) return existing;

  const result = priceResult || calculateRentalPrice(reservationToBooking(reservation));
  const issuedAt = new Date().toISOString();
  const doc = buildDocumentSnapshot(reservation, "receipt", result, issuedAt);
  doc.documentNumber = generateDocumentNumber("receipt", issuedAt, data.documents);
  data.documents.push(doc);
  return doc;
}

function syncDocumentsFromReservations(data) {
  let changed = false;
  data.reservations.forEach((reservation) => {
    if (reservation.status === "キャンセル") return;
    const beforeCount = data.documents.length;
    ensureEstimateDocument(data, reservation);
    if (isPaymentPaid(reservation)) {
      ensureReceiptDocument(data, reservation);
    }
    if (data.documents.length > beforeCount) changed = true;
  });
  return changed;
}

function normalizeSearchText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function normalizePhoneDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function documentMatchesQuery(doc, query) {
  const trimmed = String(query || "").trim();
  if (!trimmed) return true;

  const qText = normalizeSearchText(trimmed);
  const qPhone = normalizePhoneDigits(trimmed);

  const nameMatch = normalizeSearchText(doc.customerName).includes(qText);
  const emailMatch = normalizeSearchText(doc.email).includes(qText);
  const phoneMatch = qPhone.length > 0 && normalizePhoneDigits(doc.phone).includes(qPhone);

  return nameMatch || emailMatch || phoneMatch;
}

function searchDocuments(documents, query, typeFilter) {
  return documents
    .filter((doc) => {
      if (typeFilter && typeFilter !== "all" && doc.type !== typeFilter) return false;
      return documentMatchesQuery(doc, query);
    })
    .sort((a, b) => new Date(b.issuedAt) - new Date(a.issuedAt));
}

function getDocumentTypeLabel(type) {
  return type === "receipt" ? "領収書" : "見積書";
}

function renderDocumentSheet(container, doc) {
  const isReceipt = doc.type === "receipt";
  const title = getDocumentTypeLabel(doc.type);
  const booking = {
    carType: doc.carType,
    startDate: doc.startAt?.split("T")[0],
    endDate: doc.endAt?.split("T")[0],
    startTime: doc.startTimeSelection,
    endTime: doc.endTimeSelection,
    options: doc.options
  };

  const lineItems = (doc.breakdown || [])
    .filter((item) => !item.isInfo && !item.isTotal && typeof item.amount === "number")
    .map(
      (item) => `
      <tr>
        <td>${item.label}</td>
        <td class="doc-amount">${formatYen(item.amount)}</td>
      </tr>`
    )
    .join("");

  const company = getCompanyInfo();
  container.innerHTML = `
    <article class="document-sheet">
      <header class="document-sheet-header">
        <div class="document-company">
          <p class="document-company-name">${company.name}</p>
          <p>${company.address}</p>
          <p>TEL: ${company.phone}</p>
          <p>営業時間: ${company.hours}</p>
        </div>
        <div class="document-title-block">
          <h2 class="document-title">${title}</h2>
          <p>No. ${doc.documentNumber}</p>
          <p>発行日: ${formatDate(doc.issuedAt)}</p>
        </div>
      </header>

      <section class="document-customer">
        <h3>お客様情報</h3>
        <dl class="document-dl">
          <dt>お名前</dt><dd>${doc.customerName}</dd>
          <dt>電話番号</dt><dd>${doc.phone}</dd>
          <dt>メールアドレス</dt><dd>${doc.email}</dd>
        </dl>
      </section>

      <section class="document-rental">
        <h3>ご利用内容</h3>
        <dl class="document-dl">
          <dt>車種</dt><dd>${getCarLabel(doc.carType)}</dd>
          <dt>レンタル</dt><dd>${formatBookingEndpointLabel(booking.startDate, booking.startTime, "start")}</dd>
          <dt>返却</dt><dd>${formatBookingEndpointLabel(booking.endDate, booking.endTime, "end")}</dd>
          <dt>オプション</dt><dd>${formatBookingOptionsSummary(doc)}</dd>
          <dt>お支払い方法</dt><dd>${formatPaymentMethodLabel(doc.paymentMethod)}</dd>
          ${doc.notes ? `<dt>備考</dt><dd>${doc.notes}</dd>` : ""}
        </dl>
      </section>

      <section class="document-amounts">
        <h3>料金明細（税込）</h3>
        <table class="document-table">
          <thead>
            <tr>
              <th>項目</th>
              <th>金額</th>
            </tr>
          </thead>
          <tbody>
            ${lineItems}
            <tr class="document-total-row">
              <td>合計</td>
              <td class="doc-amount">${formatYen(doc.total)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      ${
        isReceipt
          ? `<p class="document-receipt-note">上記の金額を正に領収いたしました。</p>`
          : `<p class="document-estimate-note">本見積書の有効期限は発行日より30日間とします。</p>`
      }
    </article>
  `;
}

document.addEventListener("DOMContentLoaded", () => {
  ensureDataLoaded()
    .then(() => applySiteBrand())
    .catch((error) => {
      console.error(error);
      applySiteBrand();
    });
});

