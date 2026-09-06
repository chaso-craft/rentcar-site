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
  label.textContent = carType;
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
      <td>${item.carType}</td>
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
  add("車種", reservation.carType);
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
    li.textContent = `${carType}: ${reservations.length}件（${reservations.map((r) => r.customerName).join("、")}）`;
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

function toggleModalReservationRead() {
  if (modalMode !== "single" || !modalReservationId) return;
  const data = loadData();
  const reservation = data.reservations.find((r) => r.id === modalReservationId);
  if (!reservation) return;
  reservation.isRead = !reservation.isRead;
  saveData(data);
  updateModalReadButton(reservation);
  calendarModalBody.innerHTML = "";
  appendDetailDl(calendarModalBody, reservation);
  renderReservations();
  renderCalendar();
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

reservationTableBody.addEventListener("change", (event) => {
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
    saveData(data);
    if (modalMode === "single" && modalReservationId === reservation.id) {
      calendarModalBody.innerHTML = "";
      appendDetailDl(calendarModalBody, reservation);
    }
    return;
  }

  if (target.classList.contains("status-select")) {
    reservation.status = target.value;
    saveData(data);
    renderTodayTomorrowSchedule();
    renderCalendar();
    renderTodayTomorrowLists();
  }
});

reservationTableBody.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) return;

  if (target.dataset.readId) {
    const data = loadData();
    const reservation = data.reservations.find((r) => r.id === target.dataset.readId);
    if (!reservation) return;
    reservation.isRead = !reservation.isRead;
    saveData(data);
    renderReservations();
    renderTodayTomorrowLists();
    return;
  }

  if (!target.dataset.deleteId) return;

  const data = loadData();
  data.reservations = data.reservations.filter((r) => r.id !== target.dataset.deleteId);
  saveData(data);
  renderReservations();
  renderTodayTomorrowSchedule();
  renderCalendar();
  renderTodayTomorrowLists();
});

resetDataBtn.addEventListener("click", () => {
  if (!confirm("予約データを初期化します。よろしいですか？")) return;
  localStorage.removeItem(STORAGE_KEY);
  renderReservations();
  renderTodayTomorrowSchedule();
  renderCalendar();
  renderTodayTomorrowLists();
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

renderReservations();
renderTodayTomorrowSchedule();
renderCalendar();
renderTodayTomorrowLists();
