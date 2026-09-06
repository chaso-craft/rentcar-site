const searchForm = document.getElementById("searchForm");
const searchMessageEl = document.getElementById("searchMessage");
const carListHintEl = document.getElementById("carListHint");
const carTypeListEl = document.getElementById("carTypeList");
const startTimeEl = document.getElementById("startTime");
const endTimeEl = document.getElementById("endTime");
const startDateInputEl = document.getElementById("startDateInput");
const endDateInputEl = document.getElementById("endDateInput");
const startDateDisplayInputEl = document.getElementById("startDateDisplayInput");
const endDateDisplayInputEl = document.getElementById("endDateDisplayInput");
const startDatePickerButtonEl = document.getElementById("startDatePickerButton");
const endDatePickerButtonEl = document.getElementById("endDatePickerButton");

let lastSearchParams = null;

function formatDateAsJapanese(value) {
  if (!value) return "未選択";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return "未選択";
  return `${Number(year)}年${Number(month)}月${Number(day)}日`;
}

function updateDateDisplays() {
  if (startDateDisplayInputEl) {
    startDateDisplayInputEl.value = formatDateAsJapanese(startDateInputEl.value);
  }
  if (endDateDisplayInputEl) {
    endDateDisplayInputEl.value = formatDateAsJapanese(endDateInputEl.value);
  }
}

function openNativeDatePicker(inputEl) {
  if (!inputEl) return;
  if (typeof inputEl.showPicker === "function") {
    try {
      inputEl.showPicker();
      return;
    } catch (_error) {
      /* iOS などで失敗した場合は focus にフォールバック */
    }
  }
  inputEl.focus();
}

function bindDatePickerRow(dateInput, displayInput, buttonEl) {
  const rowEl = displayInput?.closest(".date-picker-row");
  const open = () => openNativeDatePicker(dateInput);

  if (buttonEl) {
    buttonEl.addEventListener("click", (event) => {
      event.preventDefault();
      open();
    });
  }

  if (displayInput) {
    displayInput.addEventListener("click", open);
  }

  if (rowEl) {
    rowEl.addEventListener("click", (event) => {
      if (event.target === buttonEl) return;
      open();
    });
  }
}

function lockDateTyping(inputEl) {
  const blockedKeys = new Set([
    "0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
    "-", "/", ".", "Backspace", "Delete"
  ]);
  inputEl.addEventListener("keydown", (event) => {
    if (blockedKeys.has(event.key)) {
      event.preventDefault();
    }
  });
  inputEl.addEventListener("paste", (event) => event.preventDefault());
  inputEl.addEventListener("drop", (event) => event.preventDefault());
}

function getSearchParamsFromForm() {
  const formData = new FormData(searchForm);
  const startDate = formData.get("startDate");
  const startTime = formData.get("startTime");
  const endDate = formData.get("endDate");
  const endTime = formData.get("endTime");
  return { startDate, startTime, endDate, endTime };
}

function refreshEndTimeOptions() {
  applySameDayEndTimeRestrictions(
    endTimeEl,
    startDateInputEl.value,
    startTimeEl.value,
    endDateInputEl.value
  );
}

function resetSearchResults() {
  lastSearchParams = null;
  renderCarTypeList([]);
  searchMessageEl.textContent = "";
}

function renderCarTypeList(availableTypes) {
  carTypeListEl.innerHTML = "";

  CAR_TYPES.forEach((type) => {
    const card = document.createElement("div");
    card.className = "car-type-card";

    if (!lastSearchParams) {
      card.classList.add("is-pending");
      card.innerHTML = `
        <strong class="car-type-name">${type}</strong>
        <p class="car-type-category">${CAR_CATEGORY_LABEL[CAR_PRICING_CATEGORY[type]]}</p>
        <p class="car-type-status">検索後に選択できます</p>
      `;
      carTypeListEl.appendChild(card);
      return;
    }

    const isAvailable = availableTypes.includes(type);
    const priceHtml = (() => {
      if (!lastSearchParams) return "";
      const price = calculateRentalPrice({ carType: type, ...lastSearchParams });
      return `<p class="car-type-price">見積もり：${formatPriceWithOptionNote(price.total, { carType: type, ...lastSearchParams })}<span class="car-type-price-note">（税込）</span></p>`;
    })();

    if (isAvailable) {
      card.classList.add("is-available");
      const link = document.createElement("a");
      link.className = "car-type-link";
      link.href = buildCarDetailUrl({
        carType: type,
        ...lastSearchParams
      });
      link.innerHTML = `
        <strong class="car-type-name">${type}</strong>
        <p class="car-type-category">${CAR_CATEGORY_LABEL[CAR_PRICING_CATEGORY[type]]}</p>
        ${priceHtml}
        <p class="car-type-status">空きあり・詳細を見る</p>
      `;
      card.appendChild(link);
    } else {
      card.classList.add("is-unavailable");
      card.innerHTML = `
        <strong class="car-type-name">${type}</strong>
        <p class="car-type-category">${CAR_CATEGORY_LABEL[CAR_PRICING_CATEGORY[type]]}</p>
        ${priceHtml}
        <p class="car-type-status">この期間は予約できません</p>
      `;
    }

    carTypeListEl.appendChild(card);
  });
}

function runAvailabilitySearch() {
  const params = getSearchParamsFromForm();
  const { startDate, startTime, endDate, endTime } = params;

  if (!startDate || !endDate || !startTime || !endTime) {
    searchMessageEl.textContent = "日付と時間をすべて選択してください。";
    searchMessageEl.style.color = "#dc2626";
    return;
  }

  if (!isValidReservationPeriod(startDate, startTime, endDate, endTime)) {
    if (
      startDate === endDate &&
      endTime &&
      !isEndTimeAllowed(startDate, startTime, endDate, endTime)
    ) {
      searchMessageEl.textContent = "同日返却の場合、返却時間はレンタル開始より後の時間のみ選べます。";
    } else {
      searchMessageEl.textContent = "返却日時は予約開始日時より後を指定してください。";
    }
    searchMessageEl.style.color = "#dc2626";
    lastSearchParams = null;
    renderCarTypeList([]);
    return;
  }

  const startAt = toReservationDateTime(startDate, startTime, "start");
  const endAt = toReservationDateTime(endDate, endTime, "end");
  const data = loadData();
  const availableTypes = getAvailableCarTypes(data, startAt, endAt);

  lastSearchParams = params;
  renderCarTypeList(availableTypes);

  if (availableTypes.length === 0) {
    searchMessageEl.textContent = "ご指定の期間に空いている車種はありません。";
    searchMessageEl.style.color = "#dc2626";
    carListHintEl.textContent = "別の日時で再度検索してください。";
    return;
  }

  searchMessageEl.textContent = `空き ${availableTypes.length} 車種。選択して詳細をご確認ください。`;
  searchMessageEl.style.color = "#059669";
  carListHintEl.textContent = "空いている車種を選んで、車種紹介ページへ進んでください。";
}

function restoreSearchFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const startDate = params.get("startDate");
  const startTime = params.get("startTime");
  const endDate = params.get("endDate");
  const endTime = params.get("endTime");

  if (!startDate || !startTime || !endDate || !endTime) return;

  startDateInputEl.value = startDate;
  endDateInputEl.value = endDate;
  startTimeEl.value = startTime;
  updateDateDisplays();
  refreshEndTimeOptions();
  if (Array.from(endTimeEl.options).some((option) => option.value === endTime && !option.disabled)) {
    endTimeEl.value = endTime;
  }
  runAvailabilitySearch();
}

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  runAvailabilitySearch();
});

fillTimeSelect(startTimeEl);
fillTimeSelect(endTimeEl);
lockDateTyping(startDateInputEl);
lockDateTyping(endDateInputEl);
startDateInputEl.addEventListener("change", () => {
  updateDateDisplays();
  refreshEndTimeOptions();
  resetSearchResults();
});
endDateInputEl.addEventListener("change", () => {
  updateDateDisplays();
  refreshEndTimeOptions();
  resetSearchResults();
});
startTimeEl.addEventListener("change", () => {
  refreshEndTimeOptions();
  resetSearchResults();
});
endTimeEl.addEventListener("change", resetSearchResults);
bindDatePickerRow(startDateInputEl, startDateDisplayInputEl, startDatePickerButtonEl);
bindDatePickerRow(endDateInputEl, endDateDisplayInputEl, endDatePickerButtonEl);
updateDateDisplays();
refreshEndTimeOptions();
restoreSearchFromUrl();
renderCarTypeList([]);
