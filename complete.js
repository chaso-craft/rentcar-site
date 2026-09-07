const completeMessageEl = document.getElementById("completeMessage");
const backToTopBtnEl = document.getElementById("backToTopBtn");
const completeTitleEl = document.querySelector(".complete-status h2");

function loadCompletedReservation() {
  const raw = sessionStorage.getItem(COMPLETED_RESERVATION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (_error) {
    return null;
  }
}

function appendMessageParagraph(text) {
  const paragraph = document.createElement("p");
  paragraph.textContent = text;
  completeMessageEl.appendChild(paragraph);
}

function renderCompleteMessage(info) {
  completeMessageEl.innerHTML = "";
  const messages = getCompletePageMessages();
  const company = getCompanyInfo();
  const map = {
    email: info.email || "",
    shopName: company.name || "",
    shopPhone: company.phone || "",
    shopAddress: company.address || "",
    shopHours: company.hours || ""
  };

  if (completeTitleEl) {
    completeTitleEl.textContent = applyEmailPlaceholders(messages.title, map);
  }

  if (info.emailSent) {
    appendMessageParagraph(applyEmailPlaceholders(messages.success, map));
  } else {
    appendMessageParagraph(applyEmailPlaceholders(messages.fail, map));
    if (info.emailError) {
      appendMessageParagraph(`（理由: ${info.emailError}）`);
    }
  }

  if (info.paymentMethod === "bankTransfer") {
    appendMessageParagraph(applyEmailPlaceholders(messages.bank, map));
  } else if (info.paymentMethod === "airPay") {
    appendMessageParagraph(applyEmailPlaceholders(messages.airPay, map));
  }
}

function initPage() {
  const info = loadCompletedReservation();

  if (!info?.email || !isValidPaymentMethod(info.paymentMethod)) {
    window.location.href = "./index.html";
    return;
  }

  renderCompleteMessage(info);

  backToTopBtnEl.addEventListener("click", () => {
    sessionStorage.removeItem(COMPLETED_RESERVATION_KEY);
  });
}

ensureDataLoaded()
  .then(() => initPage())
  .catch((error) => {
    console.error(error);
    initPage();
  });
