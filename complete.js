const completeMessageEl = document.getElementById("completeMessage");
const backToTopBtnEl = document.getElementById("backToTopBtn");

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

  if (info.emailSent) {
    appendMessageParagraph(
      `予約内容の確認メールを、ご入力いただいたメールアドレス（${info.email}）にお送りしました。見積書（PDF）を添付しています。`
    );
  } else {
    appendMessageParagraph(
      `予約は完了しましたが、確認メールの送信に失敗しました。お手数ですが店舗までご連絡ください。`
    );
    if (info.emailError) {
      appendMessageParagraph(`（理由: ${info.emailError}）`);
    }
  }

  if (info.paymentMethod === "bankTransfer") {
    appendMessageParagraph(
      "お支払い方法に銀行振り込みを選択された方は、メールに記載の銀行口座へお振込みいただき、決済を完了してください。"
    );
  } else if (info.paymentMethod === "airPay") {
    appendMessageParagraph(
      "お支払い方法にAir Payを選択された方は、メールに記載のURLより決済を完了してください。"
    );
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

initPage();
