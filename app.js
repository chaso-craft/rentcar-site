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

function initDatePickerUi() {
  updateDateDisplays();
}

function getSearchParamsFromForm() {
  const formData = new FormData(searchForm);
  const startDate = formData.get("startDate");
  const startTime = formData.get("startTime");
  const endDate = formData.get("endDate");
  const endTime = formData.get("endTime");
  return { startDate, startTime, endDate, endTime };
}

function refreshBookingConstraints() {
  applyDateInputMinConstraints(startDateInputEl, endDateInputEl);
  applyStartTimeRestrictions(startTimeEl, startDateInputEl.value);
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
      card.appendChild(createCarVisualElement(type, "car-type-visual"));
      const pending = document.createElement("div");
      pending.innerHTML = `
        <strong class="car-type-name">${getCarLabel(type)}</strong>
        <p class="car-type-category">${CAR_CATEGORY_LABEL[CAR_PRICING_CATEGORY[type]]} / ${type}</p>
        <p class="car-type-status">検索後に選択できます</p>
      `;
      card.appendChild(pending);
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
      link.appendChild(createCarVisualElement(type, "car-type-visual"));
      const body = document.createElement("div");
      body.innerHTML = `
        <strong class="car-type-name">${getCarLabel(type)}</strong>
        <p class="car-type-category">${CAR_CATEGORY_LABEL[CAR_PRICING_CATEGORY[type]]} / ${type}</p>
        ${priceHtml}
        <p class="car-type-status">空きあり・詳細を見る</p>
      `;
      link.appendChild(body);
      card.appendChild(link);
    } else {
      card.classList.add("is-unavailable");
      card.appendChild(createCarVisualElement(type, "car-type-visual"));
      const body = document.createElement("div");
      body.innerHTML = `
        <strong class="car-type-name">${getCarLabel(type)}</strong>
        <p class="car-type-category">${CAR_CATEGORY_LABEL[CAR_PRICING_CATEGORY[type]]} / ${type}</p>
        ${priceHtml}
        <p class="car-type-status">この期間は予約できません</p>
      `;
      card.appendChild(body);
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

  if (!isStartDateTimeBookable(startDate, startTime)) {
    searchMessageEl.textContent = "予約開始は現在時刻の1時間後以降（30分刻み）をお選びください。";
    searchMessageEl.style.color = "#dc2626";
    lastSearchParams = null;
    renderCarTypeList([]);
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
  document.getElementById("results")?.scrollIntoView({ behavior: "smooth", block: "start" });
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
  updateDateDisplays();
  refreshBookingConstraints();
  if (Array.from(startTimeEl.options).some((option) => option.value === startTime && !option.disabled)) {
    startTimeEl.value = startTime;
  }
  refreshBookingConstraints();
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
startDateInputEl.addEventListener("change", () => {
  updateDateDisplays();
  refreshBookingConstraints();
  resetSearchResults();
});
endDateInputEl.addEventListener("change", () => {
  updateDateDisplays();
  refreshBookingConstraints();
  resetSearchResults();
});
startTimeEl.addEventListener("change", () => {
  refreshBookingConstraints();
  resetSearchResults();
});
endTimeEl.addEventListener("change", resetSearchResults);
initDatePickerUi();
refreshBookingConstraints();
restoreSearchFromUrl();

function renderFleetShowcase() {
  const showcaseEl = document.getElementById("fleetShowcase");
  if (!showcaseEl) return;
  const data = loadData();
  showcaseEl.innerHTML = "";
  CAR_TYPES.forEach((type) => {
    const info = getCarCatalogEntry(type);
    const card = document.createElement("article");
    card.className = "fleet-card";
    card.appendChild(createCarVisualElement(type));
    const body = document.createElement("div");
    body.innerHTML = `
      <h3>${info.name}</h3>
      <p class="fleet-meta">${CAR_CATEGORY_LABEL[CAR_PRICING_CATEGORY[type]]} ・ ${info.seats}人乗り ・ ${info.transmission}</p>
      <p>${info.description}</p>
      <p class="fleet-stock">在庫 ${data.fleet[type] || 0} 台</p>
    `;
    card.appendChild(body);
    showcaseEl.appendChild(card);
  });
}

ensureDataLoaded()
  .then(() => {
    renderFleetShowcase();
    renderRatesTable();
    renderCarTypeList([]);
  })
  .catch((error) => {
    console.error(error);
    searchMessageEl.textContent = error.message || "データの読み込みに失敗しました。";
    searchMessageEl.style.color = "#dc2626";
  });

function renderRatesTable() {
  const body = document.getElementById("ratesTableBody");
  if (!body) return;
  const rates = getRentalRates();
  const rows = [
    ["軽自動車", rates.kei],
    ["普通車", rates.standard]
  ];
  body.innerHTML = rows
    .map(
      ([label, rate]) => `
      <tr>
        <td>${label}</td>
        <td>${formatYen(rate.h6)}</td>
        <td>${formatYen(rate.h12)}</td>
        <td>${formatYen(rate.h24)}</td>
        <td>${formatYen(rate.daily)}</td>
        <td>${formatYen(rate.hourly)}</td>
      </tr>
    `
    )
    .join("");
}
