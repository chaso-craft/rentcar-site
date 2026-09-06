const CAR_INTRO_TEXT = {
  LIFE: "コンパクトで運転しやすい軽自動車です。（仮の紹介文）",
  SOLIO: "使い勝手の良いコンパクトカーです。（仮の紹介文）",
  ROOMY: "ゆったり乗れるミニバンタイプです。（仮の紹介文）"
};

const params = new URLSearchParams(window.location.search);
const carType = params.get("carType");
const startDate = params.get("startDate");
const startTime = params.get("startTime");
const endDate = params.get("endDate");
const endTime = params.get("endTime");
const isEditMode = params.get("edit") === "1";

const carTypeTitleEl = document.getElementById("carTypeTitle");
const carTypeIntroEl = document.getElementById("carTypeIntro");
const rentalSummaryEl = document.getElementById("rentalSummary");
const rentButtonEl = document.getElementById("rentButton");
const customerInfoSectionEl = document.getElementById("customerInfoSection");
const reservationForm = document.getElementById("reservationForm");
const messageEl = document.getElementById("message");
const phoneCountryCodeEl = document.getElementById("phoneCountryCode");
const phoneInputEl = reservationForm.querySelector('input[name="phone"]');
const backToPrevPageLinkEl = document.getElementById("backToPrevPageLink");
const optionsPricePreviewEl = document.getElementById("optionsPricePreview");

function getBaseBookingParams() {
  return {
    carType,
    startDate,
    startTime,
    endDate,
    endTime,
    options: parseBookingOptionsFromForm(new FormData(reservationForm))
  };
}

function updateOptionsPricePreview() {
  if (!optionsPricePreviewEl) return;
  const price = calculateRentalPrice(getBaseBookingParams());
  optionsPricePreviewEl.textContent = `オプション込み見積もり：${formatPriceWithOptionNote(price.total, getBaseBookingParams())}（税込）`;
}

function countDigitsBefore(value, index) {
  let count = 0;
  const end = Math.min(index, value.length);
  for (let i = 0; i < end; i += 1) {
    if (/\d/.test(value[i])) count += 1;
  }
  return count;
}

function cursorPositionAfterDigits(formatted, digitCount) {
  if (digitCount <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i += 1) {
    if (/\d/.test(formatted[i])) {
      seen += 1;
      if (seen === digitCount) return i + 1;
    }
  }
  return formatted.length;
}

function handlePhoneInput(event) {
  const input = event.target;
  const cursor = input.selectionStart ?? input.value.length;
  const digitsBefore = countDigitsBefore(input.value, cursor);
  const digits = input.value.replace(/\D/g, "");
  const formatted = formatPhoneWithHyphens(digits);
  input.value = formatted;
  const newCursor = cursorPositionAfterDigits(formatted, digitsBefore);
  input.setSelectionRange(newCursor, newCursor);
}

function addSummaryRow(label, value) {
  const dt = document.createElement("dt");
  dt.textContent = label;
  const dd = document.createElement("dd");
  dd.textContent = value;
  rentalSummaryEl.appendChild(dt);
  rentalSummaryEl.appendChild(dd);
}

function isBookingStillAvailable() {
  const startAt = toReservationDateTime(startDate, startTime, "start");
  const endAt = toReservationDateTime(endDate, endTime, "end");
  const data = loadData();
  return getAvailableCarTypes(data, startAt, endAt).includes(carType);
}

function initPage() {
  if (
    !isValidCarType(carType) ||
    !startDate ||
    !endDate ||
    !startTime ||
    !endTime ||
    !isValidReservationPeriod(startDate, startTime, endDate, endTime)
  ) {
    carTypeTitleEl.textContent = "ページを表示できません";
    carTypeIntroEl.textContent = "空き状況検索から再度お進みください。";
    rentButtonEl.hidden = true;
    return;
  }

  if (!isBookingStillAvailable()) {
    carTypeTitleEl.textContent = carType;
    carTypeIntroEl.textContent = "申し訳ありません。この車種はご指定の期間ではご予約いただけません。";
    rentButtonEl.hidden = true;
    return;
  }

  carTypeTitleEl.textContent = carType;
  carTypeIntroEl.textContent = CAR_INTRO_TEXT[carType] || "車種の紹介文は準備中です。（仮）";

  const startLabel = formatBookingEndpointLabel(startDate, startTime, "start");
  const endLabel = formatBookingEndpointLabel(endDate, endTime, "end");

  addSummaryRow("レンタル", startLabel);
  addSummaryRow("返却", endLabel);

  const price = calculateRentalPrice({
    carType,
    startDate,
    startTime,
    endDate,
    endTime,
    options: getDefaultBookingOptions()
  });
  addSummaryRow("料金（税込）", formatPriceWithOptionNote(price.total, {
    carType,
    startDate,
    startTime,
    endDate,
    endTime
  }));

  document.getElementById("hiddenCarType").value = carType;
  document.getElementById("hiddenStartDate").value = startDate;
  document.getElementById("hiddenStartTime").value = startTime;
  document.getElementById("hiddenEndDate").value = endDate;
  document.getElementById("hiddenEndTime").value = endTime;

  if (backToPrevPageLinkEl) {
    backToPrevPageLinkEl.href = buildIndexSearchUrl({
      startDate,
      startTime,
      endDate,
      endTime
    });
  }
}

function restoreEditFormFromPending() {
  const raw = sessionStorage.getItem(PENDING_RESERVATION_KEY);
  if (!raw) return;
  try {
    const pending = JSON.parse(raw);
    if (pending.carType !== carType) return;

    applyBookingOptionsToForm(reservationForm, pending.options);
    updateOptionsPricePreview();

    reservationForm.querySelector('[name="customerName"]').value = pending.customerName || "";
    reservationForm.querySelector('[name="email"]').value = pending.email || "";
    reservationForm.querySelector('[name="notes"]').value = pending.notes || "";

    const phoneField = reservationForm.querySelector('[name="phone"]');
    const dialMatch = String(pending.phone || "").match(/^(\+\d+)\s+(.*)$/);
    if (dialMatch) {
      phoneCountryCodeEl.value = dialMatch[1];
      phoneField.value = dialMatch[2];
    } else {
      phoneField.value = pending.phone || "";
    }

    customerInfoSectionEl.hidden = false;
    rentButtonEl.disabled = true;
    rentButtonEl.textContent = "レンタル内容を選択中";
  } catch (_error) {
    // ignore invalid session data
  }
}

rentButtonEl.addEventListener("click", () => {
  if (!isBookingStillAvailable()) {
    messageEl.textContent = "この車種はすでに予約が入りました。トップに戻って再度検索してください。";
    messageEl.style.color = "#dc2626";
    return;
  }

  customerInfoSectionEl.hidden = false;
  rentButtonEl.disabled = true;
  rentButtonEl.textContent = "レンタル内容を選択中";
  updateOptionsPricePreview();
  customerInfoSectionEl.scrollIntoView({ behavior: "smooth", block: "start" });
});

reservationForm.addEventListener("change", updateOptionsPricePreview);
reservationForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(reservationForm);
  const bookingStartDate = formData.get("startDate");
  const bookingStartTime = formData.get("startTime");
  const bookingEndDate = formData.get("endDate");
  const bookingEndTime = formData.get("endTime");
  const bookingCarType = formData.get("carType");

  if (!isBookingStillAvailable()) {
    messageEl.textContent = `${bookingCarType}は現在空きがありません。`;
    messageEl.style.color = "#dc2626";
    return;
  }

  const pendingBooking = {
    carType: bookingCarType,
    startDate: bookingStartDate,
    startTime: bookingStartTime,
    endDate: bookingEndDate,
    endTime: bookingEndTime,
    options: parseBookingOptionsFromForm(formData),
    customerName: formData.get("customerName"),
    phone: formatPhoneWithCountry(
      formData.get("phoneCountryCode"),
      formData.get("phone")
    ),
    email: formData.get("email"),
    notes: formData.get("notes") || ""
  };

  sessionStorage.setItem(PENDING_RESERVATION_KEY, JSON.stringify(pendingBooking));
  window.location.href = "./confirm.html";
});

fillPhoneCountrySelect(phoneCountryCodeEl);
if (phoneInputEl) {
  phoneInputEl.addEventListener("input", handlePhoneInput);
}
initPage();
if (isEditMode) {
  restoreEditFormFromPending();
}
