const documentSearchFormEl = document.getElementById("documentSearchForm");
const documentSearchInputEl = document.getElementById("documentSearchInput");
const documentTypeFilterEl = document.getElementById("documentTypeFilter");
const documentSearchResetEl = document.getElementById("documentSearchReset");
const documentSearchSummaryEl = document.getElementById("documentSearchSummary");
const documentResultsBodyEl = document.getElementById("documentResultsBody");
const documentEmptyMessageEl = document.getElementById("documentEmptyMessage");
const documentViewModalEl = document.getElementById("documentViewModal");
const documentModalTitleEl = document.getElementById("documentModalTitle");
const documentModalBodyEl = document.getElementById("documentModalBody");
const documentPrintBtnEl = document.getElementById("documentPrintBtn");

let currentDocuments = [];
let activeDocumentId = null;

function runSearch() {
  const data = loadData();
  if (syncDocumentsFromReservations(data)) {
    saveData(data).catch((error) => console.error(error));
  }

  const query = documentSearchInputEl.value;
  const typeFilter = documentTypeFilterEl.value;
  currentDocuments = searchDocuments(data.documents, query, typeFilter);

  renderResults(currentDocuments, query, typeFilter);
}

function renderResults(documents, query, typeFilter) {
  documentResultsBodyEl.innerHTML = "";

  const typeLabel =
    typeFilter === "estimate" ? "見積書" : typeFilter === "receipt" ? "領収書" : "すべて";

  if (query.trim()) {
    documentSearchSummaryEl.textContent = `「${query.trim()}」の検索結果（${typeLabel}）: ${documents.length}件`;
  } else {
    documentSearchSummaryEl.textContent = `全件表示（${typeLabel}）: ${documents.length}件`;
  }

  if (documents.length === 0) {
    documentEmptyMessageEl.removeAttribute("hidden");
    return;
  }

  documentEmptyMessageEl.setAttribute("hidden", "");

  documents.forEach((doc) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td data-label="種類"><span class="doc-type-badge doc-type-${doc.type}">${getDocumentTypeLabel(doc.type)}</span></td>
      <td data-label="番号">${escapeHtml(doc.documentNumber || "")}</td>
      <td data-label="発行日">${formatDate(doc.issuedAt)}</td>
      <td data-label="お名前">${escapeHtml(doc.customerName || "")}</td>
      <td data-label="電話番号">${escapeHtml(doc.phone || "")}</td>
      <td data-label="メール">${escapeHtml(doc.email || "")}</td>
      <td data-label="車種">${escapeHtml(getCarLabel(doc.carType))}</td>
      <td data-label="合計">${formatYen(doc.total)}</td>
      <td data-label="操作"><button type="button" class="secondary" data-view-doc="${doc.id}">表示</button></td>
    `;
    documentResultsBodyEl.appendChild(tr);
  });
}

function openDocumentModal(documentId) {
  const doc = currentDocuments.find((item) => item.id === documentId);
  if (!doc) return;

  activeDocumentId = documentId;
  documentModalTitleEl.textContent = `${getDocumentTypeLabel(doc.type)}（${doc.documentNumber}）`;
  renderDocumentSheet(documentModalBodyEl, doc);
  documentViewModalEl.removeAttribute("hidden");
}

function closeDocumentModal() {
  documentViewModalEl.setAttribute("hidden", "");
  activeDocumentId = null;
}

function printActiveDocument() {
  window.print();
}

documentSearchFormEl.addEventListener("submit", (event) => {
  event.preventDefault();
  runSearch();
});

documentSearchResetEl.addEventListener("click", () => {
  documentSearchInputEl.value = "";
  documentTypeFilterEl.value = "all";
  runSearch();
});

documentTypeFilterEl.addEventListener("change", runSearch);

documentResultsBodyEl.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement) || !target.dataset.viewDoc) return;
  openDocumentModal(target.dataset.viewDoc);
});

documentViewModalEl.addEventListener("click", (event) => {
  const target = event.target;
  if (target instanceof HTMLElement && target.dataset.closeDocModal !== undefined) {
    closeDocumentModal();
  }
});

documentPrintBtnEl.addEventListener("click", printActiveDocument);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !documentViewModalEl.hasAttribute("hidden")) {
    closeDocumentModal();
  }
});

ensureDataLoaded()
  .then(async () => {
    if (typeof isSupabaseConfigured === "function" && isSupabaseConfigured()) {
      const ok = await isSupabaseAdminLoggedIn();
      if (!ok) {
        window.location.href = "./admin.html";
        return;
      }
      await reloadRemoteData();
    }
    runSearch();
  })
  .catch((error) => {
    console.error(error);
    documentSearchSummaryEl.textContent = error.message || "データの読み込みに失敗しました。";
  });
