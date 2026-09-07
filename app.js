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
        <p class="car-type-category">${CAR_CATEGORY_LABEL[getCarPricingCategory(type)] || "普通車"} / ${type}</p>
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
        <p class="car-type-category">${CAR_CATEGORY_LABEL[getCarPricingCategory(type)] || "普通車"} / ${type}</p>
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
        <p class="car-type-category">${CAR_CATEGORY_LABEL[getCarPricingCategory(type)] || "普通車"} / ${type}</p>
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

  searchMessageEl.textContent = "空き状況を確認しています…";
  searchMessageEl.style.color = "#64748b";

  const finishSearch = async () => {
    if (typeof isRemoteDataMode === "function" && isRemoteDataMode() && typeof reloadRemoteData === "function") {
      await reloadRemoteData();
    }
    const data = loadData();
    let availableTypes = getAvailableCarTypes(data, startAt, endAt);

    if (typeof window.filterAvailableCarTypesRemote === "function" && isRemoteDataMode()) {
      availableTypes = await window.filterAvailableCarTypesRemote(availableTypes, startAt, endAt);
    }

    lastSearchParams = params;
    renderCarTypeList(availableTypes);

    if (availableTypes.length === 0) {
      searchMessageEl.textContent = "ご指定の期間に空いている車種はありません。";
      searchMessageEl.style.color = "#dc2626";
      carListHintEl.textContent = "別の日時で再度検索してください（貸出開始1時間前〜返却1時間後は不可）。";
      return;
    }

    searchMessageEl.textContent = `空き ${availableTypes.length} 車種。選択して詳細をご確認ください。`;
    searchMessageEl.style.color = "#059669";
    carListHintEl.textContent = "空いている車種を選んで、車種紹介ページへ進んでください。";
    document.getElementById("results")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  finishSearch().catch((error) => {
    console.error(error);
    searchMessageEl.textContent = error.message || "空き状況の確認に失敗しました。";
    searchMessageEl.style.color = "#dc2626";
  });
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
      <p class="fleet-meta">${CAR_CATEGORY_LABEL[getCarPricingCategory(type)] || "普通車"} ・ ${info.seats}人乗り ・ ${info.transmission}</p>
      <p>${info.description}</p>
      <p class="fleet-stock">在庫 ${data.fleet[type] || 0} 台</p>
    `;
    card.appendChild(body);
    showcaseEl.appendChild(card);
  });
}

const publicCalendarEl = document.getElementById("publicCalendar");
const publicCalendarTitleEl = document.getElementById("publicCalendarTitle");
const publicPrevMonthBtn = document.getElementById("publicPrevMonth");
const publicNextMonthBtn = document.getElementById("publicNextMonth");
const publicCalendarModal = document.getElementById("publicCalendarModal");
const publicCalendarModalTitle = document.getElementById("publicCalendarModalTitle");
const publicCalendarModalBody = document.getElementById("publicCalendarModalBody");
const publicCalendarMessageEl = document.getElementById("publicCalendarMessage");
let publicCalendarMonth = new Date(
  startOfLocalDay(new Date()).getFullYear(),
  startOfLocalDay(new Date()).getMonth(),
  1
);

ensureDataLoaded()
  .then(() => {
    renderFleetShowcase();
    renderRatesTable();
    renderCarTypeList([]);
    renderPublicCalendar();
  })
  .catch((error) => {
    console.error(error);
    searchMessageEl.textContent = error.message || "データの読み込みに失敗しました。";
    searchMessageEl.style.color = "#dc2626";
    if (publicCalendarMessageEl) {
      publicCalendarMessageEl.textContent = error.message || "カレンダーの読み込みに失敗しました。";
      publicCalendarMessageEl.style.color = "#dc2626";
    }
  });

function closePublicCalendarModal() {
  if (!publicCalendarModal) return;
  publicCalendarModal.setAttribute("hidden", "");
  if (publicCalendarModalBody) publicCalendarModalBody.innerHTML = "";
}

function openPublicCalendarDay(year, month, day) {
  if (!publicCalendarModal || !publicCalendarModalBody || !publicCalendarModalTitle) return;
  const cellDate = new Date(year, month, day);
  const data = loadData();
  const windows = getPublicBlockedWindowsForDay(data, cellDate);
  const weekday = cellDate.toLocaleDateString("ja-JP", { weekday: "short" });
  publicCalendarModalTitle.textContent = `${year}年${month + 1}月${day}日（${weekday}）の予約状況`;
  publicCalendarModalBody.innerHTML = "";

  if (windows.length === 0) {
    const empty = document.createElement("p");
    empty.className = "public-day-empty";
    empty.textContent = "この日に表示できる予約不可時間帯はありません。";
    publicCalendarModalBody.appendChild(empty);
  } else {
    const intro = document.createElement("p");
    intro.className = "hint-text";
    intro.textContent =
      "次の時間帯は貸出開始の1時間前〜返却の1時間後まで予約できません（ちょうど前後1時間の境界も含みます）。";
    publicCalendarModalBody.appendChild(intro);

    const list = document.createElement("ul");
    list.className = "public-day-busy-list";
    windows.forEach((item) => {
      const li = document.createElement("li");
      li.className = "public-day-busy-item";
      li.innerHTML = `
        <strong>${getCarLabel(item.carType)}</strong>
        <p>予約不可：${item.label}</p>
        <p class="public-day-busy-note">※個人情報は表示していません</p>
      `;
      list.appendChild(li);
    });
    publicCalendarModalBody.appendChild(list);
  }

  publicCalendarModal.removeAttribute("hidden");
}

function renderPublicCalendar() {
  if (!publicCalendarEl || !publicCalendarTitleEl) return;
  const data = loadData();
  const year = publicCalendarMonth.getFullYear();
  const month = publicCalendarMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = startOfLocalDay(new Date());

  publicCalendarTitleEl.textContent = `${year}年 ${month + 1}月`;
  publicCalendarEl.innerHTML = "";

  ["日", "月", "火", "水", "木", "金", "土"].forEach((label) => {
    const header = document.createElement("div");
    header.className = "calendar-weekday";
    header.textContent = label;
    publicCalendarEl.appendChild(header);
  });

  for (let i = 0; i < startWeekday; i += 1) {
    const blank = document.createElement("div");
    blank.className = "calendar-day blank";
    publicCalendarEl.appendChild(blank);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const cellDate = new Date(year, month, day);
    const dayCell = document.createElement("div");
    dayCell.className = "calendar-day";
    dayCell.role = "button";
    dayCell.tabIndex = 0;
    dayCell.dataset.publicCalYear = String(year);
    dayCell.dataset.publicCalMonth = String(month);
    dayCell.dataset.publicCalDay = String(day);

    if (startOfLocalDay(cellDate).getTime() === today.getTime()) {
      dayCell.classList.add("is-today");
    }

    const grouped = getGroupedBlockedReservationsByCarType(data.reservations, cellDate);
    const hasBusy = CAR_TYPES.some((carType) => (grouped[carType] || []).length > 0);
    if (hasBusy) dayCell.classList.add("has-busy");

    const dayHeading = document.createElement("strong");
    dayHeading.className = "calendar-day-number";
    dayHeading.textContent = String(day);
    dayCell.appendChild(dayHeading);

    const barsContainer = document.createElement("div");
    barsContainer.className = "calendar-day-bars";

    CAR_TYPES.forEach((carType) => {
      const row = document.createElement("div");
      row.className = `calendar-day-bar-row ${getCarVisualClass(carType)}`;
      const reservations = grouped[carType] || [];
      if (reservations.length > 0) {
        const badge = document.createElement("button");
        badge.type = "button";
        badge.tabIndex = -1;
        const segmentClass = getBlockedCarTypeSegmentClass(carType, cellDate, data.reservations);
        badge.className = `calendar-reservation ${segmentClass} ${getCarVisualClass(carType)}`.trim();
        const dayStart = startOfLocalDay(cellDate).getTime();
        const startsToday = reservations.filter((reservation) => {
          const blocked = getReservationBlockedPeriod(reservation);
          return blocked && startOfLocalDay(blocked.start).getTime() === dayStart;
        });
        if (startsToday.length > 0) {
          const clocks = startsToday
            .map((reservation) => {
              const blocked = getReservationBlockedPeriod(reservation);
              return blocked ? formatScheduleClock(blocked.start) : "";
            })
            .filter(Boolean);
          badge.textContent = clocks.length ? `${clocks[0]}〜` : "予約あり";
          badge.classList.add("has-start-name");
        } else {
          badge.textContent = "";
        }
        badge.title = `${getCarLabel(carType)} 予約あり（前後1時間含む）`;
        badge.setAttribute("aria-hidden", "true");
        row.appendChild(badge);
      }
      barsContainer.appendChild(row);
    });

    dayCell.appendChild(barsContainer);
    dayCell.setAttribute(
      "aria-label",
      hasBusy
        ? `${year}年${month + 1}月${day}日の予約状況を見る`
        : `${year}年${month + 1}月${day}日（予約表示なし）`
    );
    publicCalendarEl.appendChild(dayCell);
  }

  if (publicCalendarMessageEl) {
    publicCalendarMessageEl.textContent = "";
  }
}

if (publicPrevMonthBtn) {
  publicPrevMonthBtn.addEventListener("click", () => {
    publicCalendarMonth = new Date(
      publicCalendarMonth.getFullYear(),
      publicCalendarMonth.getMonth() - 1,
      1
    );
    renderPublicCalendar();
  });
}

if (publicNextMonthBtn) {
  publicNextMonthBtn.addEventListener("click", () => {
    publicCalendarMonth = new Date(
      publicCalendarMonth.getFullYear(),
      publicCalendarMonth.getMonth() + 1,
      1
    );
    renderPublicCalendar();
  });
}

if (publicCalendarEl) {
  publicCalendarEl.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const dayCell = target.closest("[data-public-cal-day]");
    if (!(dayCell instanceof HTMLElement) || dayCell.classList.contains("blank")) return;
    openPublicCalendarDay(
      Number(dayCell.dataset.publicCalYear),
      Number(dayCell.dataset.publicCalMonth),
      Number(dayCell.dataset.publicCalDay)
    );
  });

  publicCalendarEl.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (!target.dataset.publicCalDay) return;
    event.preventDefault();
    openPublicCalendarDay(
      Number(target.dataset.publicCalYear),
      Number(target.dataset.publicCalMonth),
      Number(target.dataset.publicCalDay)
    );
  });
}

if (publicCalendarModal) {
  publicCalendarModal.addEventListener("click", (event) => {
    const target = event.target;
    if (target instanceof HTMLElement && target.dataset.closePublicCalendar !== undefined) {
      closePublicCalendarModal();
    }
  });
}

document.addEventListener("keydown", (event) => {
  if (
    event.key === "Escape" &&
    publicCalendarModal &&
    !publicCalendarModal.hasAttribute("hidden")
  ) {
    closePublicCalendarModal();
  }
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
