const todayTomorrowScheduleEl = document.getElementById("todayTomorrowSchedule");
const reservationTableBody = document.getElementById("reservationTableBody");
const resetDataBtn = document.getElementById("resetData");
const adminCalendarEl = document.getElementById("adminCalendar");
const calendarTitleEl = document.getElementById("calendarTitle");
const prevMonthBtn = document.getElementById("prevMonth");
const nextMonthBtn = document.getElementById("nextMonth");
const calendarDetailModal = document.getElementById("calendarDetailModal");
const calendarModalTitle = document.getElementById("calendarModalTitle");
const calendarModalBody = document.getElementById("calendarModalBody");
const calendarModalToggleRead = document.getElementById("calendarModalToggleRead");
const todayReservationListEl = document.getElementById("todayReservationList");
const tomorrowReservationListEl = document.getElementById("tomorrowReservationList");
let currentMonth = new Date();
let modalReservationId = null;
let modalMode = "closed";

const loginScreen = document.getElementById("loginScreen");
const adminApp = document.getElementById("adminApp");
const adminHeaderNav = document.getElementById("adminHeaderNav");
const loginForm = document.getElementById("loginForm");
const loginPassword = document.getElementById("loginPassword");
const loginMessage = document.getElementById("loginMessage");
const logoutBtn = document.getElementById("logoutBtn");
const dashboardStats = document.getElementById("dashboardStats");
const unreadList = document.getElementById("unreadList");
const fleetForm = document.getElementById("fleetForm");
const fleetMessage = document.getElementById("fleetMessage");
const settingsForm = document.getElementById("settingsForm");
const settingsMessage = document.getElementById("settingsMessage");
const ratesForm = document.getElementById("ratesForm");
const ratesMessage = document.getElementById("ratesMessage");
const siteIconPreview = document.getElementById("siteIconPreview");
const siteIconStatus = document.getElementById("siteIconStatus");
const siteIconInput = document.getElementById("siteIconInput");
const siteIconReset = document.getElementById("siteIconReset");
const siteIconMessage = document.getElementById("siteIconMessage");
const passwordForm = document.getElementById("passwordForm");
const passwordMessage = document.getElementById("passwordMessage");

function showAdminApp() {
  if (loginScreen) loginScreen.hidden = true;
  if (adminApp) adminApp.hidden = false;
  if (adminHeaderNav) adminHeaderNav.hidden = false;
}

function showLoginScreen() {
  if (loginScreen) loginScreen.hidden = false;
  if (adminApp) adminApp.hidden = true;
  if (adminHeaderNav) adminHeaderNav.hidden = true;
}

function switchAdminTab(tabId) {
  document.querySelectorAll(".admin-tab").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.tab === tabId);
  });
  document.querySelectorAll(".admin-panel").forEach((panel) => {
    panel.hidden = panel.id !== `tab-${tabId}`;
  });
}

function renderDashboard() {
  if (!dashboardStats || !unreadList) return;
  const data = loadData();
  const today = startOfLocalDay(new Date());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const active = data.reservations.filter((item) => item.status !== "キャンセル");
  const unread = active.filter((item) => !item.isRead);
  const unpaid = active.filter((item) => !isPaymentPaid(item));
  const todayCount = getReservationsOverlappingDay(data, today).length;
  const tomorrowCount = getReservationsOverlappingDay(data, tomorrow).length;

  dashboardStats.innerHTML = `
    <article class="stat-card"><span>未読</span><strong>${unread.length}</strong></article>
    <article class="stat-card"><span>当日の予約</span><strong>${todayCount}</strong></article>
    <article class="stat-card"><span>翌日の予約</span><strong>${tomorrowCount}</strong></article>
    <article class="stat-card"><span>未払い</span><strong>${unpaid.length}</strong></article>
    <article class="stat-card"><span>保有台数</span><strong>${CAR_TYPES.reduce((sum, type) => sum + (data.fleet[type] || 0), 0)}</strong></article>
  `;

  unreadList.innerHTML = "";
  if (unread.length === 0) {
    const li = document.createElement("li");
    li.textContent = "未読の予約はありません。";
    unreadList.appendChild(li);
  } else {
    unread.forEach((item) => {
      const li = document.createElement("li");
      li.textContent = `${item.customerName} / ${getCarLabel(item.carType)} / ${formatReservationPeriodText(item)}`;
      unreadList.appendChild(li);
    });
  }
}

function renderFleetForm() {
  if (!fleetForm) return;
  const data = loadData();
  fleetForm.innerHTML = "";
  CAR_TYPES.forEach((type) => {
    const info = getCarCatalogEntry(type);
    const images = getCarImages(type);
    const wrap = document.createElement("div");
    wrap.className = "card full";
    wrap.innerHTML = `
      <h3>${type}</h3>
      <label>表示名
        <input type="text" name="${type}_name" value="${info.name || type}" required>
      </label>
      <label>在庫台数
        <input type="number" name="${type}_stock" min="0" step="1" value="${data.fleet[type] || 0}" required>
      </label>
      <label>乗車定員
        <input type="number" name="${type}_seats" min="1" step="1" value="${info.seats || 4}" required>
      </label>
      <label>ミッション
        <input type="text" name="${type}_transmission" value="${info.transmission || "AT"}">
      </label>
      <label class="full">紹介文
        <textarea name="${type}_description" rows="3">${info.description || ""}</textarea>
      </label>
      <div class="car-images-manager full">
        <p class="hint-text">車両の写真。先頭が予約サイトの代表画像になります。</p>
        <div class="car-images-grid">
          ${images.length === 0 ? `<p class="hint-text">まだ写真はありません。</p>` : images.map((item, index) => `
            <figure class="car-image-item">
              <img src="${item.dataUrl}" alt="${info.name || type}の写真${index + 1}">
              <figcaption>${index === 0 ? "代表画像" : `写真 ${index + 1}`}</figcaption>
              <div class="car-image-actions">
                <label class="file-button compact">変更
                  <input type="file" accept="image/*" data-replace-image="${type}" data-image-id="${item.id}">
                </label>
                <button type="button" class="danger compact" data-delete-image="${type}" data-image-id="${item.id}">削除</button>
              </div>
            </figure>
          `).join("")}
        </div>
        <label class="file-button">写真を追加
          <input type="file" accept="image/*" data-add-image="${type}">
        </label>
      </div>
    `;
    fleetForm.appendChild(wrap);
  });
  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "full";
  submit.textContent = "車両情報を保存";
  fleetForm.appendChild(submit);
}

function fillSettingsForm() {
  if (!settingsForm) return;
  const site = getCompanyInfo();
  const setValue = (id, value) => {
    const input = document.getElementById(id);
    if (input) input.value = value || "";
  };
  setValue("siteName", site.name);
  setValue("siteTagline", site.tagline);
  setValue("siteAddress", site.address);
  setValue("sitePhone", site.phone);
  setValue("siteHours", site.hours);
  setValue("siteClosed", site.closed);
  setValue("siteAbout", site.about);
}

function fillRatesForm() {
  if (!ratesForm) return;
  const rates = getRentalRates();
  ["kei", "standard"].forEach((category) => {
    ["h6", "h12", "h24", "daily", "hourly"].forEach((key) => {
      const input = document.getElementById(`rate_${category}_${key}`);
      if (input) input.value = rates[category][key];
    });
  });
}

function fillSiteIconPreview() {
  if (siteIconPreview) {
    siteIconPreview.src = getSiteIcon();
  }
  if (siteIconStatus) {
    siteIconStatus.textContent = getCompanyInfo().icon
      ? "カスタムアイコンを使用しています。"
      : "未設定のため、現在使われているアイコンを表示しています。";
  }
}

function showActionMessage(el, text, isError) {
  if (!el) return;
  el.textContent = text;
  el.style.color = isError ? "#dc2626" : "#059669";
}

function renderAdminViews() {
  renderReservations();
  renderTodayTomorrowSchedule();
  renderCalendar();
  renderTodayTomorrowLists();
  renderDashboard();
  renderFleetForm();
  fillSettingsForm();
  fillRatesForm();
  fillSiteIconPreview();
}

function getCarTypeScheduleClass(carType) {
  if (carType === "LIFE") return "car-life";
  if (carType === "SOLIO") return "car-solio";
  if (carType === "ROOMY") return "car-roomy";
  return "";
}

function renderDayInventory(panel, inventory) {
  const grid = document.createElement("div");
  grid.className = "fleet-grid day-inventory-grid";
  CAR_TYPES.forEach((carType) => {
    const stats = inventory[carType];
    const div = document.createElement("div");
    div.className = `fleet-item ${getCarTypeScheduleClass(carType)}`;
    div.innerHTML = `
      <strong>${carType}</strong><br>
      在庫: ${stats.total}台<br>
      最大同時利用: ${stats.peakUsed}台<br>
      空き: ${stats.available}台<br>
      予約: ${stats.reservationCount}件
    `;
    grid.appendChild(div);
  });
  panel.appendChild(grid);
}

function renderScheduleHourAxis(trackWrap) {
  const axis = document.createElement("div");
  axis.className = "schedule-hour-axis";
  const labelSpacer = document.createElement("span");
  labelSpacer.className = "schedule-row-label schedule-axis-spacer";
  labelSpacer.textContent = "時間";
  axis.appendChild(labelSpacer);

  const hours = document.createElement("div");
  hours.className = "schedule-hour-labels";
  for (let hour = 0; hour <= 24; hour += 3) {
    const mark = document.createElement("span");
    mark.className = "schedule-hour-mark";
    mark.style.left = `${(hour / 24) * 100}%`;
    mark.textContent = `${String(hour).padStart(2, "0")}:00`;
    hours.appendChild(mark);
  }
  axis.appendChild(hours);
  trackWrap.appendChild(axis);
}

function renderScheduleRow(panel, carType, dayDate, data) {
  const dayStart = startOfLocalDay(dayDate);
  const row = document.createElement("div");
  row.className = "schedule-row";

  const label = document.createElement("span");
  label.className = `schedule-row-label ${getCarTypeScheduleClass(carType)}`;
  label.textContent = getCarLabel(carType);
  row.appendChild(label);

  const track = document.createElement("div");
  track.className = "schedule-track";
  track.setAttribute("aria-label", `${carType}の当日スケジュール`);

  const reservations = getReservationsOverlappingDay(data, dayDate).filter(
    (reservation) => reservation.carType === carType
  );

  reservations.forEach((reservation) => {
    const slice = getReservationDaySlice(reservation, dayDate);
    if (!slice) return;

    const left = dateToDayPercent(slice.start, dayStart);
    const right = dateToDayPercent(slice.end, dayStart);
    const width = Math.max(right - left, 100 / SLOTS_PER_DAY);

    const block = document.createElement("div");
    block.className = `schedule-block ${getCarTypeScheduleClass(carType)}`;
    block.style.left = `${left}%`;
    block.style.width = `${width}%`;
    block.textContent = reservation.customerName;
    block.title = formatScheduleBlockTitle(reservation, slice);
    track.appendChild(block);
  });

  row.appendChild(track);
  panel.appendChild(row);
}

function renderDaySchedulePanel(container, dayDate, titleLabel, data) {
  const panel = document.createElement("section");
  panel.className = "day-schedule-panel";

  const heading = document.createElement("h3");
  heading.className = "day-schedule-title";
  heading.textContent = formatScheduleDayTitle(dayDate, titleLabel);
  panel.appendChild(heading);

  const inventory = getDayInventoryByCarType(data, dayDate);
  renderDayInventory(panel, inventory);

  const schedule = document.createElement("div");
  schedule.className = "schedule-board";

  const trackWrap = document.createElement("div");
  trackWrap.className = "schedule-track-wrap";
  renderScheduleHourAxis(trackWrap);

  CAR_TYPES.forEach((carType) => {
    renderScheduleRow(trackWrap, carType, dayDate, data);
  });

  schedule.appendChild(trackWrap);
  panel.appendChild(schedule);
  container.appendChild(panel);
}

function renderTodayTomorrowSchedule() {
  const data = loadData();
  todayTomorrowScheduleEl.innerHTML = "";

  const today = startOfLocalDay(new Date());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  renderDaySchedulePanel(todayTomorrowScheduleEl, today, "当日", data);
  renderDaySchedulePanel(todayTomorrowScheduleEl, tomorrow, "翌日", data);
}

function renderReservations() {
  const data = loadData();
  reservationTableBody.innerHTML = "";

  const sorted = [...data.reservations].sort((a, b) => {
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  sorted.forEach((item) => {
    const periodText = item.startAt && item.endAt
      ? formatReservationPeriodHtml(item)
      : `${formatDate(item.startDate)} - ${formatDate(item.endDate)}`;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${formatDate(item.createdAt)}</td>
      <td>${item.customerName}</td>
      <td>${getCarLabel(item.carType)}</td>
      <td>${periodText}</td>
      <td>${item.phone}<br>${item.email}</td>
      <td>${formatPaymentMethodLabel(item.paymentMethod)}</td>
      <td>
        <select class="payment-status-select" data-id="${item.id}">
          <option value="unpaid" ${!isPaymentPaid(item) ? "selected" : ""}>未払い</option>
          <option value="paid" ${isPaymentPaid(item) ? "selected" : ""}>支払い済み</option>
        </select>
      </td>
      <td>
        <button type="button" data-read-id="${item.id}">
          ${item.isRead ? "既読" : "未読"}
        </button>
      </td>
      <td>
        <select class="status-select" data-id="${item.id}">
          <option value="受付" ${item.status === "受付" ? "selected" : ""}>受付</option>
          <option value="確定" ${item.status === "確定" ? "selected" : ""}>確定</option>
          <option value="キャンセル" ${item.status === "キャンセル" ? "selected" : ""}>キャンセル</option>
        </select>
      </td>
      <td><button type="button" data-delete-id="${item.id}" class="danger">削除</button></td>
    `;
    if (!item.isRead) {
      tr.classList.add("unread-row");
    }
    reservationTableBody.appendChild(tr);
  });
}

function reservationSortKey(r) {
  const period = getReservationPeriod(r);
  if (!period) return 0;
  return period.start.getTime();
}

function getCarTypeClass(carType) {
  if (carType === "LIFE") return "car-life";
  if (carType === "SOLIO") return "car-solio";
  if (carType === "ROOMY") return "car-roomy";
  return "";
}

function getReservationSegmentClass(reservation, cellDate) {
  const period = getReservationPeriod(reservation);
  if (!period) return "segment-single";
  const day = startOfLocalDay(cellDate).getTime();
  const from = startOfLocalDay(period.start).getTime();
  const to = startOfLocalDay(period.end).getTime();
  if (from === to) return "segment-single";
  if (day === from) return "segment-start";
  if (day === to) return "segment-end";
  return "segment-middle";
}

function getGroupedReservationsByCarType(reservations, cellDate) {
  const groups = {};
  reservations.forEach((reservation) => {
    if (!reservationCoversCalendarDay(reservation, cellDate)) return;
    if (!groups[reservation.carType]) {
      groups[reservation.carType] = [];
    }
    groups[reservation.carType].push(reservation);
  });
  Object.values(groups).forEach((list) => {
    list.sort((a, b) => reservationSortKey(a) - reservationSortKey(b));
  });
  return groups;
}

function getCarTypeSegmentClass(carType, cellDate, reservations) {
  const prevDate = new Date(cellDate);
  prevDate.setDate(prevDate.getDate() - 1);
  const nextDate = new Date(cellDate);
  nextDate.setDate(nextDate.getDate() + 1);

  const hasPrev = reservations.some((reservation) => {
    return reservation.carType === carType && reservationCoversCalendarDay(reservation, prevDate);
  });
  const hasNext = reservations.some((reservation) => {
    return reservation.carType === carType && reservationCoversCalendarDay(reservation, nextDate);
  });

  if (hasPrev && hasNext) return "segment-middle";
  if (!hasPrev && hasNext) return "segment-start";
  if (hasPrev && !hasNext) return "segment-end";
  return "segment-single";
}

function appendDetailDl(container, reservation) {
  const dl = document.createElement("dl");
  const add = (label, value) => {
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = value === undefined || value === "" ? "—" : String(value);
    dl.appendChild(dt);
    dl.appendChild(dd);
  };
  add("レンタル日時", formatReservationEndpointText(reservation, "start"));
  add("返却日時", formatReservationEndpointText(reservation, "end"));
  add("お名前", reservation.customerName);
  add("車種", getCarLabel(reservation.carType));
  add("電話", reservation.phone);
  add("メール", reservation.email);
  add("状態", reservation.status);
  add("未読/既読", reservation.isRead ? "既読" : "未読");
  add("備考", reservation.notes);
  add("オプション", formatBookingOptionsSummary(reservation));
  add("お支払い方法", formatPaymentMethodLabel(reservation.paymentMethod));
  add("支払状況", formatPaymentStatusLabel(reservation));
  if (reservation.estimatedTotal) {
    add("見積合計", formatYen(reservation.estimatedTotal));
  }
  add("受付日時", formatDateTime(reservation.createdAt));
  container.appendChild(dl);
}

function updateModalReadButton(reservation) {
  if (!reservation) return;
  calendarModalToggleRead.textContent = reservation.isRead ? "未読に戻す" : "既読にする";
}

function openCalendarModalSingle(reservation) {
  modalMode = "single";
  modalReservationId = reservation.id;
  calendarModalTitle.textContent = "予約の詳細";
  calendarModalBody.innerHTML = "";
  appendDetailDl(calendarModalBody, reservation);
  calendarModalToggleRead.hidden = false;
  updateModalReadButton(reservation);
  calendarDetailModal.removeAttribute("hidden");
}

function openCalendarModalGroup(year, month, dayIndex, carType, reservations) {
  modalMode = "group";
  modalReservationId = null;
  calendarModalToggleRead.hidden = true;
  calendarModalTitle.textContent = `${year}年 ${month + 1}月 ${dayIndex}日 ${carType}（${reservations.length}件）`;
  calendarModalBody.innerHTML = "";
  reservations.forEach((r, index) => {
    const block = document.createElement("div");
    block.className = "detail-block";
    const sub = document.createElement("h4");
    sub.style.margin = "0 0 8px";
    sub.style.fontSize = "0.9rem";
    sub.textContent = `${index + 1}. ${r.carType} / ${r.customerName}`;
    block.appendChild(sub);
    appendDetailDl(block, r);
    calendarModalBody.appendChild(block);
  });
  calendarDetailModal.removeAttribute("hidden");
}

function renderShortReservationList(listEl, titleDate) {
  const data = loadData();
  const groups = getGroupedReservationsByCarType(data.reservations, titleDate);
  listEl.innerHTML = "";
  const order = CAR_TYPES;
  let hasAny = false;
  order.forEach((carType) => {
    const reservations = groups[carType] || [];
    if (reservations.length === 0) return;
    hasAny = true;
    const li = document.createElement("li");
    li.textContent = `${getCarLabel(carType)}: ${reservations.length}件（${reservations.map((r) => r.customerName).join("、")}）`;
    listEl.appendChild(li);
  });
  if (!hasAny) {
    const li = document.createElement("li");
    li.textContent = "予約はありません。";
    listEl.appendChild(li);
  }
}

function renderTodayTomorrowLists() {
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  renderShortReservationList(todayReservationListEl, today);
  renderShortReservationList(tomorrowReservationListEl, tomorrow);
}

function closeCalendarModal() {
  calendarDetailModal.setAttribute("hidden", "");
  modalReservationId = null;
  modalMode = "closed";
}

async function toggleModalReservationRead() {
  if (modalMode !== "single" || !modalReservationId) return;
  const data = loadData();
  const reservation = data.reservations.find((r) => r.id === modalReservationId);
  if (!reservation) return;
  reservation.isRead = !reservation.isRead;
  await saveData(data);
  updateModalReadButton(reservation);
  calendarModalBody.innerHTML = "";
  appendDetailDl(calendarModalBody, reservation);
  renderReservations();
  renderCalendar();
  renderDashboard();
}

function renderCalendar() {
  const data = loadData();
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  calendarTitleEl.textContent = `${year}年 ${month + 1}月`;
  adminCalendarEl.innerHTML = "";

  const weekLabels = ["日", "月", "火", "水", "木", "金", "土"];
  weekLabels.forEach((label) => {
    const header = document.createElement("div");
    header.className = "calendar-weekday";
    header.textContent = label;
    adminCalendarEl.appendChild(header);
  });

  for (let i = 0; i < startWeekday; i += 1) {
    const blank = document.createElement("div");
    blank.className = "calendar-day blank";
    adminCalendarEl.appendChild(blank);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const cellDate = new Date(year, month, day);
    const dayCell = document.createElement("div");
    dayCell.className = "calendar-day";
    const grouped = getGroupedReservationsByCarType(data.reservations, cellDate);
    const carTypeOrder = CAR_TYPES;

    const dayHeading = document.createElement("strong");
    dayHeading.className = "calendar-day-number";
    dayHeading.textContent = String(day);
    dayCell.appendChild(dayHeading);

    const barsContainer = document.createElement("div");
    barsContainer.className = "calendar-day-bars";

    carTypeOrder.forEach((carType) => {
      const row = document.createElement("div");
      row.className = `calendar-day-bar-row ${getCarTypeClass(carType)}`;

      const reservations = grouped[carType] || [];
      if (reservations.length > 0) {
        const badge = document.createElement("button");
        badge.type = "button";
        const segmentClass = getCarTypeSegmentClass(carType, cellDate, data.reservations);
        const carTypeClass = getCarTypeClass(carType);
        badge.className = `calendar-reservation ${segmentClass} ${carTypeClass}`.trim();
        badge.dataset.reservationGroupCarType = carType;
        badge.dataset.reservationGroupYear = String(year);
        badge.dataset.reservationGroupMonth = String(month);
        badge.dataset.reservationGroupDay = String(day);
        const startDayNames = formatReservationStartDayNames(reservations, cellDate);
        badge.textContent = startDayNames;
        if (startDayNames) {
          badge.classList.add("has-start-name");
        }
        badge.title = startDayNames || `${carType} ${reservations.length}件`;
        badge.setAttribute(
          "aria-label",
          startDayNames
            ? `${carType} ${startDayNames}の予約詳細`
            : `${carType} ${reservations.length}件の予約詳細`
        );
        row.appendChild(badge);
      }

      barsContainer.appendChild(row);
    });

    dayCell.appendChild(barsContainer);
    adminCalendarEl.appendChild(dayCell);
  }
}

reservationTableBody.addEventListener("change", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLSelectElement) || !target.dataset.id) return;

  const data = loadData();
  const reservation = data.reservations.find((r) => r.id === target.dataset.id);
  if (!reservation) return;

  if (target.classList.contains("payment-status-select")) {
    reservation.paymentPaid = target.value === "paid";
    if (reservation.paymentPaid) {
      ensureReceiptDocument(data, reservation);
    }
    await saveData(data);
    renderAdminViews();
    if (modalMode === "single" && modalReservationId === reservation.id) {
      calendarModalBody.innerHTML = "";
      appendDetailDl(calendarModalBody, reservation);
    }
    return;
  }

  if (target.classList.contains("status-select")) {
    reservation.status = target.value;
    await saveData(data);
    renderAdminViews();
  }
});

reservationTableBody.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) return;

  if (target.dataset.readId) {
    const data = loadData();
    const reservation = data.reservations.find((r) => r.id === target.dataset.readId);
    if (!reservation) return;
    reservation.isRead = !reservation.isRead;
    await saveData(data);
    renderReservations();
    renderTodayTomorrowLists();
    renderDashboard();
    return;
  }

  if (!target.dataset.deleteId) return;

  const data = loadData();
  data.reservations = data.reservations.filter((r) => r.id !== target.dataset.deleteId);
  await saveData(data);
  renderAdminViews();
});

resetDataBtn.addEventListener("click", async () => {
  if (!confirm("予約データと書類を初期化します。車両・店舗情報は残します。よろしいですか？")) return;
  const data = loadData();
  data.reservations = [];
  data.documents = [];
  await saveData(data);
  renderAdminViews();
});

prevMonthBtn.addEventListener("click", () => {
  currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
  renderCalendar();
});

nextMonthBtn.addEventListener("click", () => {
  currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
  renderCalendar();
});

adminCalendarEl.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const badge = target.closest("[data-reservation-group-car-type]");
  if (badge instanceof HTMLButtonElement && badge.dataset.reservationGroupCarType) {
    const y = Number(badge.dataset.reservationGroupYear);
    const m = Number(badge.dataset.reservationGroupMonth);
    const d = Number(badge.dataset.reservationGroupDay);
    const carType = badge.dataset.reservationGroupCarType;
    const cellDate = new Date(y, m, d);
    const data = loadData();
    const grouped = getGroupedReservationsByCarType(data.reservations, cellDate);
    const reservations = grouped[carType] || [];
    if (reservations.length > 0) {
      openCalendarModalGroup(y, m, d, carType, reservations);
    }
  }
});

calendarDetailModal.addEventListener("click", (event) => {
  const target = event.target;
  if (target instanceof HTMLElement && target.dataset.closeModal !== undefined) {
    closeCalendarModal();
  }
});

calendarModalToggleRead.addEventListener("click", () => {
  toggleModalReservationRead();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !calendarDetailModal.hasAttribute("hidden")) {
    closeCalendarModal();
  }
});

document.querySelectorAll(".admin-tab").forEach((button) => {
  button.addEventListener("click", () => switchAdminTab(button.dataset.tab));
});

if (fleetForm) {
  fleetForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(fleetForm);
    const data = loadData();
    CAR_TYPES.forEach((type) => {
      const stock = Number(formData.get(`${type}_stock`));
      data.fleet[type] = Number.isFinite(stock) && stock >= 0 ? stock : 0;
      const existing = data.catalog[type] || getCarCatalogEntry(type);
      data.catalog[type] = {
        ...existing,
        name: String(formData.get(`${type}_name`) || type).trim(),
        seats: Number(formData.get(`${type}_seats`)) || 4,
        transmission: String(formData.get(`${type}_transmission`) || "AT").trim(),
        description: String(formData.get(`${type}_description`) || "").trim(),
        images: normalizeCarImages(existing.images)
      };
    });
    try {
      await saveData(data);
      showActionMessage(fleetMessage, "車両情報を保存しました。予約サイトに反映されます。", false);
      renderAdminViews();
    } catch (error) {
      showActionMessage(fleetMessage, error.message || "保存できませんでした。", true);
    }
  });
}

const fleetPanel = document.getElementById("tab-fleet");
if (fleetPanel) {
  fleetPanel.addEventListener("change", async (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== "file") return;
    const file = input.files && input.files[0];
    if (!file) return;
    const addType = input.dataset.addImage;
    const replaceType = input.dataset.replaceImage;
    if (!addType && !replaceType) return;
    try {
      const dataUrl = await fileToCompressedDataUrl(file, 900, "image/jpeg", 0.72);
      const data = loadData();
      const type = addType || replaceType;
      const entry = data.catalog[type] || getCarCatalogEntry(type);
      let images = normalizeCarImages(entry.images);
      if (addType) {
        images.push({ id: createUniqueId("img"), dataUrl });
      } else {
        images = images.map((item) => (item.id === input.dataset.imageId ? { ...item, dataUrl } : item));
      }
      data.catalog[type] = { ...entry, images };
      await saveData(data);
      showActionMessage(fleetMessage, addType ? "写真を追加しました。" : "写真を変更しました。", false);
      renderFleetForm();
    } catch (error) {
      showActionMessage(fleetMessage, error.message || "画像を保存できませんでした。", true);
    }
    input.value = "";
  });

  fleetPanel.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-delete-image]");
    if (!button) return;
    event.preventDefault();
    const type = button.dataset.deleteImage;
    const id = button.dataset.imageId;
    const data = loadData();
    const entry = data.catalog[type] || getCarCatalogEntry(type);
    data.catalog[type] = {
      ...entry,
      images: normalizeCarImages(entry.images).filter((item) => item.id !== id)
    };
    try {
      await saveData(data);
      showActionMessage(fleetMessage, "写真を削除しました。", false);
      renderFleetForm();
    } catch (error) {
      showActionMessage(fleetMessage, error.message || "削除できませんでした。", true);
    }
  });
}

if (ratesForm) {
  ratesForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = loadData();
    const readRate = (category, key) => {
      const value = Number(document.getElementById(`rate_${category}_${key}`).value);
      return Number.isFinite(value) && value >= 0 ? Math.round(value) : 0;
    };
    data.rates = {
      kei: {
        h6: readRate("kei", "h6"),
        h12: readRate("kei", "h12"),
        h24: readRate("kei", "h24"),
        daily: readRate("kei", "daily"),
        hourly: readRate("kei", "hourly")
      },
      standard: {
        h6: readRate("standard", "h6"),
        h12: readRate("standard", "h12"),
        h24: readRate("standard", "h24"),
        daily: readRate("standard", "daily"),
        hourly: readRate("standard", "hourly")
      }
    };
    try {
      await saveData(data);
      showActionMessage(ratesMessage, "料金を保存しました。予約サイトに反映されます。", false);
    } catch (error) {
      showActionMessage(ratesMessage, error.message || "保存できませんでした。", true);
    }
  });
}

if (siteIconInput) {
  siteIconInput.addEventListener("change", async () => {
    const file = siteIconInput.files && siteIconInput.files[0];
    if (!file) return;
    try {
      const dataUrl = await fileToCompressedDataUrl(file, 192, "image/png", 0.92);
      const data = loadData();
      data.site = { ...data.site, icon: dataUrl };
      await saveData(data);
      fillSiteIconPreview();
      applySiteBrand();
      showActionMessage(siteIconMessage, "ウェブサイトのアイコンを変更しました。", false);
    } catch (error) {
      showActionMessage(siteIconMessage, error.message || "アイコンを保存できませんでした。", true);
    }
    siteIconInput.value = "";
  });
}

if (siteIconReset) {
  siteIconReset.addEventListener("click", async () => {
    const data = loadData();
    data.site = { ...data.site, icon: "" };
    try {
      await saveData(data);
      fillSiteIconPreview();
      applySiteBrand();
      showActionMessage(siteIconMessage, "初期アイコンに戻しました。", false);
    } catch (error) {
      showActionMessage(siteIconMessage, error.message || "保存できませんでした。", true);
    }
  });
}

if (settingsForm) {
  settingsForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(settingsForm);
    const data = loadData();
    data.site = {
      ...data.site,
      name: String(formData.get("siteName") || "").trim(),
      tagline: String(formData.get("tagline") || "").trim(),
      address: String(formData.get("address") || "").trim(),
      phone: String(formData.get("phone") || "").trim(),
      hours: String(formData.get("hours") || "").trim(),
      closed: String(formData.get("closed") || "").trim(),
      about: String(formData.get("about") || "").trim()
    };
    try {
      await saveData(data);
      settingsMessage.textContent = "店舗情報を保存しました。";
      settingsMessage.style.color = "#059669";
      applySiteBrand();
    } catch (error) {
      settingsMessage.textContent = error.message || "保存できませんでした。";
      settingsMessage.style.color = "#dc2626";
    }
  });
}

if (passwordForm) {
  passwordForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (typeof isSupabaseConfigured === "function" && isSupabaseConfigured()) {
      passwordMessage.textContent = "パスワードは Supabase Auth で管理されています。";
      passwordMessage.style.color = "#64748b";
      return;
    }
    const formData = new FormData(passwordForm);
    const currentPassword = String(formData.get("currentPassword") || "");
    const newPassword = String(formData.get("newPassword") || "");
    if (currentPassword !== getAdminPassword()) {
      passwordMessage.textContent = "現在のパスワードが違います。";
      passwordMessage.style.color = "#dc2626";
      return;
    }
    if (newPassword.length < 4) {
      passwordMessage.textContent = "新しいパスワードは4文字以上にしてください。";
      passwordMessage.style.color = "#dc2626";
      return;
    }
    setAdminPassword(newPassword);
    passwordForm.reset();
    passwordMessage.textContent = "パスワードを変更しました。";
    passwordMessage.style.color = "#059669";
  });
}

async function bootAdmin() {
  const onProductionHost = /\.netlify\.app$/i.test(window.location.hostname);
  let useSupabase = typeof isSupabaseConfigured === "function" && isSupabaseConfigured();

  if (!useSupabase) {
    const hasUrl = Boolean(window.RENTCAR_SUPABASE_URL);
    const hasKey = Boolean(window.RENTCAR_SUPABASE_ANON_KEY);
    const message = !hasUrl || !hasKey
      ? "Supabase の設定（URL / キー）が空です。supabase-config.js を確認してください。"
      : "Supabase ライブラリの読み込みに失敗しました。通信環境を確認してください。";
    if (onProductionHost || hasUrl) {
      showLoginScreen();
      if (loginMessage) {
        loginMessage.textContent = message;
        loginMessage.style.color = "#dc2626";
      }
      alert(message);
      return;
    }
  }

  try {
    await ensureDataLoaded();
  } catch (error) {
    console.error(error);
    alert(error.message || "データの読み込みに失敗しました。");
    if (useSupabase || onProductionHost) {
      showLoginScreen();
      return;
    }
  }

  useSupabase = typeof isSupabaseConfigured === "function" && isSupabaseConfigured();
  if (useSupabase || onProductionHost) {
    const loggedIn =
      typeof isSupabaseAdminLoggedIn === "function" && (await isSupabaseAdminLoggedIn());
    if (!loggedIn) {
      showLoginScreen();
      return;
    }
    if (useSupabase) {
      await reloadRemoteData();
    }
  }
  showAdminApp();
  renderAdminViews();
  applySiteBrand();
}

if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = document.getElementById("loginEmail")?.value || "";
    const password = loginPassword?.value || "";
    if (typeof isSupabaseConfigured === "function" && isSupabaseConfigured()) {
      const result = await loginAdminWithSupabase(email, password);
      if (!result.ok) {
        loginMessage.textContent = result.error || "ログインに失敗しました。";
        loginMessage.style.color = "#dc2626";
        return;
      }
      await reloadRemoteData();
      showAdminApp();
      renderAdminViews();
      applySiteBrand();
      return;
    }
    if (!loginAdmin(password)) {
      loginMessage.textContent = "パスワードが違います。";
      loginMessage.style.color = "#dc2626";
      return;
    }
    showAdminApp();
    renderAdminViews();
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    if (typeof isSupabaseConfigured === "function" && isSupabaseConfigured()) {
      await logoutAdminFromSupabase();
    } else {
      logoutAdmin();
    }
    showLoginScreen();
  });
}

bootAdmin();
