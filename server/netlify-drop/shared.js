const STORAGE_KEY = "rentcar-site-data-v1";
const PENDING_RESERVATION_KEY = "rentcar-pending-reservation";
const COMPLETED_RESERVATION_KEY = "rentcar-completed-reservation";
const CAR_TYPES = ["LIFE", "SOLIO", "ROOMY"];

const DEFAULT_DATA = {
  fleet: {
    LIFE: 1,
    SOLIO: 1,
    ROOMY: 1
  },
  reservations: [],
  documents: []
};

const COMPANY_INFO = {
  name: "GOTO rental car",
  address: "長崎県五島市上大津町324",
  phone: "090-1164-2562",
  hours: "9:00〜18:00"
};

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

function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_DATA));
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }
  try {
    const parsed = JSON.parse(raw);
    return {
      fleet: mergeFleet(parsed.fleet),
      reservations: Array.isArray(parsed.reservations) ? parsed.reservations : [],
      documents: Array.isArray(parsed.documents) ? parsed.documents : []
    };
  } catch (_error) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_DATA));
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
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

/** 貸渡料金表（2026年4月15日改訂）税込 */
const RENTAL_RATES_TAX_INCL = {
  kei: { h6: 4950, h12: 5500, h24: 6600, daily: 5500, hourly: 1100 },
  standard: { h6: 5500, h12: 6600, h24: 7700, daily: 6600, hourly: 1100 }
};

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
  const rates = RENTAL_RATES_TAX_INCL[category];
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
    id: crypto.randomUUID(),
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

  container.innerHTML = `
    <article class="document-sheet">
      <header class="document-sheet-header">
        <div class="document-company">
          <p class="document-company-name">${COMPANY_INFO.name}</p>
          <p>${COMPANY_INFO.address}</p>
          <p>TEL: ${COMPANY_INFO.phone}</p>
          <p>営業時間: ${COMPANY_INFO.hours}</p>
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
          <dt>車種</dt><dd>${doc.carType}</dd>
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
