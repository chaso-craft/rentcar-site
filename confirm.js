const bookingSummaryEl = document.getElementById("bookingSummary");
const customerSummaryEl = document.getElementById("customerSummary");
const backToEditLinkEl = document.getElementById("backToEditLink");
const termsScrollEl = document.getElementById("termsScroll");
const termsAgreeBtnEl = document.getElementById("termsAgreeBtn");
const termsAgreedIndicatorEl = document.getElementById("termsAgreedIndicator");
const confirmSubmitBtnEl = document.getElementById("confirmSubmitBtn");
const messageEl = document.getElementById("message");
const priceTotalDisplayEl = document.getElementById("priceTotalDisplay");
const priceBreakdownBtnEl = document.getElementById("priceBreakdownBtn");
const priceBreakdownModalEl = document.getElementById("priceBreakdownModal");
const priceBreakdownBodyEl = document.getElementById("priceBreakdownBody");
const backToPrevPageLinkEl = document.getElementById("backToPrevPageLink");
const paymentMethodInputs = document.querySelectorAll('input[name="paymentMethod"]');
const paymentMethodMessageEl = document.getElementById("paymentMethodMessage");

let pendingBooking = null;
let currentPriceResult = null;
let termsScrolledToEnd = false;
let termsAgreed = false;
let selectedPaymentMethod = "";
let termsEndObserver = null;

function addSummaryRow(container, label, value) {
  const dt = document.createElement("dt");
  dt.textContent = label;
  const dd = document.createElement("dd");
  dd.textContent = value || "—";
  container.appendChild(dt);
  container.appendChild(dd);
}

function formatBookingTimeLabel(dateStr, timeStr, role) {
  return formatBookingEndpointLabel(dateStr, timeStr, role);
}

function loadPendingBooking() {
  const raw = sessionStorage.getItem(PENDING_RESERVATION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (_error) {
    return null;
  }
}

function isBookingStillAvailable(booking) {
  const startAt = toReservationDateTime(booking.startDate, booking.startTime, "start");
  const endAt = toReservationDateTime(booking.endDate, booking.endTime, "end");
  const data = loadData();
  return getAvailableCarTypes(data, startAt, endAt).includes(booking.carType);
}

function buildEditUrl(booking) {
  const params = new URLSearchParams({
    carType: booking.carType,
    startDate: booking.startDate,
    startTime: booking.startTime,
    endDate: booking.endDate,
    endTime: booking.endTime,
    edit: "1"
  });
  return `./car-detail.html?${params.toString()}`;
}

function renderConfirmation() {
  bookingSummaryEl.innerHTML = "";
  customerSummaryEl.innerHTML = "";

  addSummaryRow(bookingSummaryEl, "車種", getCarLabel(pendingBooking.carType));
  addSummaryRow(
    bookingSummaryEl,
    "レンタル",
    formatBookingTimeLabel(pendingBooking.startDate, pendingBooking.startTime, "start")
  );
  addSummaryRow(
    bookingSummaryEl,
    "返却",
    formatBookingTimeLabel(pendingBooking.endDate, pendingBooking.endTime, "end")
  );
  addSummaryRow(bookingSummaryEl, "備考", pendingBooking.notes || "なし");
  addSummaryRow(bookingSummaryEl, "オプション", formatBookingOptionsSummary(pendingBooking));

  addSummaryRow(customerSummaryEl, "お名前", pendingBooking.customerName);
  addSummaryRow(customerSummaryEl, "電話番号", pendingBooking.phone);
  addSummaryRow(customerSummaryEl, "メールアドレス", pendingBooking.email);
  if (selectedPaymentMethod) {
    addSummaryRow(bookingSummaryEl, "お支払い方法", formatPaymentMethodLabel(selectedPaymentMethod));
  }

  currentPriceResult = calculateRentalPrice(pendingBooking);
  priceTotalDisplayEl.textContent = `合計 ${formatPriceWithOptionNote(currentPriceResult.total, pendingBooking)}（税込）`;

  backToEditLinkEl.href = buildEditUrl(pendingBooking);
  if (backToPrevPageLinkEl) {
    backToPrevPageLinkEl.href = buildEditUrl(pendingBooking);
  }
}

function openPriceBreakdownModal() {
  if (!currentPriceResult) return;
  renderPriceBreakdownList(priceBreakdownBodyEl, currentPriceResult);
  priceBreakdownModalEl.removeAttribute("hidden");
}

function closePriceBreakdownModal() {
  priceBreakdownModalEl.setAttribute("hidden", "");
}

function updateTermsAgreeButtonState() {
  termsAgreeBtnEl.disabled = termsAgreed;
  termsAgreeBtnEl.classList.toggle("needs-scroll", !termsScrolledToEnd && !termsAgreed);
}

function markTermsScrolledToEnd() {
  if (termsScrolledToEnd) return;
  termsScrolledToEnd = true;
  updateTermsAgreeButtonState();
}

function checkTermsScrolledToEnd() {
  const { scrollTop, clientHeight, scrollHeight } = termsScrollEl;
  const noScrollNeeded = scrollHeight <= clientHeight + 4;
  const atBottom = noScrollNeeded || scrollTop + clientHeight >= scrollHeight - 12;
  if (atBottom) {
    markTermsScrolledToEnd();
  }
}

function initTermsEndDetection() {
  const endMarker = termsScrollEl.querySelector(".terms-end-marker");
  if (!endMarker || typeof IntersectionObserver !== "function") {
    checkTermsScrolledToEnd();
    return;
  }

  termsEndObserver = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        markTermsScrolledToEnd();
        termsEndObserver?.disconnect();
      }
    },
    { root: termsScrollEl, threshold: 0.25 }
  );
  termsEndObserver.observe(endMarker);
}

function updateSubmitButtonState() {
  const ready = termsAgreed && selectedPaymentMethod;
  confirmSubmitBtnEl.disabled = false;
  confirmSubmitBtnEl.classList.toggle("is-disabled", !ready);
  confirmSubmitBtnEl.setAttribute("aria-disabled", ready ? "false" : "true");
}

function updatePaymentSectionState() {
  paymentMethodInputs.forEach((input) => {
    input.disabled = !termsAgreed;
  });
  if (!termsAgreed) {
    paymentMethodMessageEl.textContent = "先にキャンセルポリシーへ同意してください。";
    paymentMethodMessageEl.style.color = "#64748b";
  } else if (!selectedPaymentMethod) {
    paymentMethodMessageEl.textContent = "お支払い方法を選択してください。";
    paymentMethodMessageEl.style.color = "#64748b";
  }
}

function savePendingPaymentMethod(method) {
  if (!pendingBooking) return;
  pendingBooking.paymentMethod = method;
  sessionStorage.setItem(PENDING_RESERVATION_KEY, JSON.stringify(pendingBooking));
}

function restorePaymentMethodSelection() {
  if (!pendingBooking?.paymentMethod) return;
  selectedPaymentMethod = pendingBooking.paymentMethod;
  paymentMethodInputs.forEach((input) => {
    input.checked = input.value === selectedPaymentMethod;
  });
}

function initPage() {
  pendingBooking = loadPendingBooking();

  if (
    !pendingBooking ||
    !isValidCarType(pendingBooking.carType) ||
    !pendingBooking.startDate ||
    !pendingBooking.endDate ||
    !pendingBooking.startTime ||
    !pendingBooking.endTime ||
    !pendingBooking.customerName ||
    !pendingBooking.phone ||
    !pendingBooking.email
  ) {
    window.location.href = "./index.html";
    return;
  }

  if (!isBookingStillAvailable(pendingBooking)) {
    messageEl.textContent = "申し訳ありません。選択された車種は現在ご予約いただけません。";
    messageEl.style.color = "#dc2626";
    confirmSubmitBtnEl.disabled = true;
    termsAgreeBtnEl.disabled = true;
    renderConfirmation();
    return;
  }

  renderConfirmation();
  restorePaymentMethodSelection();
  updatePaymentSectionState();
  updateSubmitButtonState();
  initTermsEndDetection();
  checkTermsScrolledToEnd();
}

termsScrollEl.addEventListener("scroll", checkTermsScrolledToEnd, { passive: true });
termsScrollEl.addEventListener("touchend", checkTermsScrolledToEnd, { passive: true });
window.addEventListener("resize", checkTermsScrolledToEnd);

termsAgreeBtnEl.addEventListener("click", () => {
  if (termsAgreed) return;
  if (!termsScrolledToEnd) {
    messageEl.textContent = "キャンセルポリシーを最後までスクロールしてから「規約に同意する」を押してください。";
    messageEl.style.color = "#dc2626";
    termsScrollEl.scrollTo({ top: termsScrollEl.scrollHeight, behavior: "smooth" });
    checkTermsScrolledToEnd();
    return;
  }
  termsAgreed = true;
  termsAgreeBtnEl.hidden = true;
  termsAgreedIndicatorEl.removeAttribute("hidden");
  updatePaymentSectionState();
  updateSubmitButtonState();
});

paymentMethodInputs.forEach((input) => {
  input.addEventListener("change", () => {
    if (!input.checked) return;
    selectedPaymentMethod = input.value;
    savePendingPaymentMethod(selectedPaymentMethod);
    paymentMethodMessageEl.textContent = `選択中：${formatPaymentMethodLabel(selectedPaymentMethod)}`;
    paymentMethodMessageEl.style.color = "#059669";
    renderConfirmation();
    updateSubmitButtonState();
  });
});

termsAgreedIndicatorEl.hidden = true;
termsAgreeBtnEl.hidden = false;

priceBreakdownBtnEl.addEventListener("click", openPriceBreakdownModal);

priceBreakdownModalEl.addEventListener("click", (event) => {
  const target = event.target;
  if (target instanceof HTMLElement && target.dataset.closePriceModal !== undefined) {
    closePriceBreakdownModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !priceBreakdownModalEl.hasAttribute("hidden")) {
    closePriceBreakdownModal();
  }
});

confirmSubmitBtnEl.addEventListener("click", async () => {
  messageEl.textContent = "";

  if (!termsAgreed) {
    messageEl.textContent = "先にキャンセルポリシーへ同意してください。";
    messageEl.style.color = "#dc2626";
    return;
  }

  if (!isValidPaymentMethod(selectedPaymentMethod)) {
    messageEl.textContent = "お支払い方法を選択してください。";
    messageEl.style.color = "#dc2626";
    return;
  }

  if (!isBookingStillAvailable(pendingBooking)) {
    messageEl.textContent = `${pendingBooking.carType}は現在空きがありません。`;
    messageEl.style.color = "#dc2626";
    return;
  }

  const priceResult = calculateRentalPrice(pendingBooking);
  const confirmed = window.confirm(
    `予約を確定します。\n\n車種：${getCarLabel(pendingBooking.carType)}\n合計：${formatYen(priceResult.total)}（税込）\nお支払い：${formatPaymentMethodLabel(selectedPaymentMethod)}\n\n内容にお間違いがなければ「OK」を押してください。`
  );
  if (!confirmed) return;

  const previousLabel = confirmSubmitBtnEl.textContent;
  try {
  const startOutsideHours = isOutsideBusinessOption(pendingBooking.startTime);
  const endOutsideHours = isOutsideBusinessOption(pendingBooking.endTime);
  const startAt = toReservationDateTime(pendingBooking.startDate, pendingBooking.startTime, "start");
  const endAt = toReservationDateTime(pendingBooking.endDate, pendingBooking.endTime, "end");

  const data = loadData();
  const reservationId = createUniqueId("res");
  const newReservation = {
    id: reservationId,
    createdAt: new Date().toISOString(),
    customerName: pendingBooking.customerName,
    phone: pendingBooking.phone,
    email: pendingBooking.email,
    carType: pendingBooking.carType,
    startAt,
    endAt,
    startTimeSelection: pendingBooking.startTime,
    endTimeSelection: pendingBooking.endTime,
    startOutsideHours,
    endOutsideHours,
    estimatedTotal: priceResult.total,
    estimatedBaseTotal: priceResult.baseTotal,
    estimatedOptionTotal: priceResult.optionTotal,
    options: pendingBooking.options,
    paymentMethod: selectedPaymentMethod,
    paymentPaid: false,
    notes: pendingBooking.notes || "",
    status: "受付",
    isRead: false
  };
  data.reservations.push(newReservation);
  const estimateDoc = ensureEstimateDocument(data, newReservation, priceResult);
  await saveData(data);

  confirmSubmitBtnEl.disabled = true;
  confirmSubmitBtnEl.classList.remove("is-disabled");
  confirmSubmitBtnEl.textContent = "メール送信中…";
  messageEl.textContent = "予約を保存しました。確認メールを送信しています…";
  messageEl.style.color = "#64748b";

  let emailSent = false;
  let emailError = "";
  try {
    await sendReservationConfirmationEmail(newReservation, estimateDoc);
    emailSent = true;
  } catch (error) {
    emailError = error instanceof Error ? error.message : "メール送信に失敗しました。";
    console.error(error);
  }

  sessionStorage.removeItem(PENDING_RESERVATION_KEY);
  sessionStorage.setItem(
    COMPLETED_RESERVATION_KEY,
    JSON.stringify({
      email: pendingBooking.email,
      paymentMethod: selectedPaymentMethod,
      emailSent,
      emailError
    })
  );

  if (!emailSent) {
    sessionStorage.setItem("rentcar-complete-email-warning", emailError);
  }

  window.location.href = "./complete.html";
  } catch (error) {
    console.error(error);
    confirmSubmitBtnEl.textContent = previousLabel || "予約を確定する";
    confirmSubmitBtnEl.disabled = false;
    updateSubmitButtonState();
    messageEl.textContent =
      error instanceof Error ? error.message : "予約の確定中にエラーが発生しました。もう一度お試しください。";
    messageEl.style.color = "#dc2626";
  }
});

ensureDataLoaded()
  .then(() => initPage())
  .catch((error) => {
    console.error(error);
    messageEl.textContent = error.message || "データの読み込みに失敗しました。";
    messageEl.style.color = "#dc2626";
  });
