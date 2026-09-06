function onReady(fn) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fn);
  } else {
    fn();
  }
}

function openNativeDatePicker(inputEl) {
  if (!inputEl) return;
  if (typeof inputEl.showPicker === "function") {
    try {
      inputEl.showPicker();
      return;
    } catch (_error) {
      /* iOS や一部ブラウザはユーザー操作以外で失敗する */
    }
  }
  inputEl.click();
  if (typeof inputEl.focus === "function") {
    inputEl.focus({ preventScroll: true });
  }
}

function initDatePickers() {
  document.querySelectorAll(".date-picker-row").forEach((row) => {
    const input = row.querySelector('input[type="date"]');
    const button = row.querySelector(".date-picker-btn");
    if (!input) return;

    const open = (event) => {
      event.preventDefault();
      event.stopPropagation();
      openNativeDatePicker(input);
    };

    if (button) {
      button.removeAttribute("tabindex");
      button.removeAttribute("aria-hidden");
      button.addEventListener("click", open);
    }
  });
}

function initSiteNav() {
  const toggle = document.getElementById("navToggle");
  const nav = document.getElementById("siteNav");
  if (!toggle || !nav) return;

  const setOpen = (open) => {
    nav.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.setAttribute("aria-label", open ? "メニューを閉じる" : "メニューを開く");
    document.body.classList.toggle("nav-open", open);
  };

  toggle.addEventListener("click", () => {
    setOpen(!nav.classList.contains("is-open"));
  });

  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => setOpen(false));
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setOpen(false);
  });

  window.addEventListener("resize", () => {
    if (window.matchMedia("(min-width: 861px)").matches) {
      setOpen(false);
    }
  });
}

onReady(() => {
  initSiteNav();
  initDatePickers();
});
