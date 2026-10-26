// Дневник тренировок — лэндинг: тема, счётчики, экраны в телефоне, калькулятор 1ПМ, ссылка на установку.
(() => {
  "use strict";

  /** Ссылка на установку (APK или магазин). Пусто — кнопки показывают «Скоро». */
  const DOWNLOAD_URL = "download/dnevnik-trenirovok-0.5.0.apk";

  const root = document.documentElement;
  root.classList.remove("no-js");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------------------------------------------------------------- Шапка: черта при прокрутке
  const nav = document.querySelector(".nav");
  const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 8);
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // ---------------------------------------------------------------- Тема: тёмная или светлая
  // По умолчанию — как в системе; выбор кнопкой запоминается в браузере.
  const systemLight = window.matchMedia("(prefers-color-scheme: light)");
  const themeBtn = document.querySelector("[data-theme-toggle]");
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const currentTheme = () => root.dataset.theme || (systemLight.matches ? "light" : "dark");

  // Тема снимков: пока переключатель не трогали — как у сайта (data-shots не задан).
  const shots = document.querySelector(".shots");
  const shotButtons = document.querySelectorAll("[data-shots-theme]");
  function syncShots() {
    const t = (shots && shots.dataset.shots) || currentTheme();
    shotButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.shotsTheme === t)));
  }
  shotButtons.forEach((b) => b.addEventListener("click", () => {
    if (shots) shots.dataset.shots = b.dataset.shotsTheme;
    syncShots();
  }));

  function syncTheme() {
    syncShots();
    const dark = currentTheme() === "dark";
    themeBtn.setAttribute("aria-pressed", String(dark));
    themeBtn.title = dark ? "Светлая тема" : "Тёмная тема";
    if (themeMeta) themeMeta.content = getComputedStyle(root).getPropertyValue("--bg").trim() || themeMeta.content;
  }

  themeBtn.addEventListener("click", () => {
    const next = currentTheme() === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try { localStorage.setItem("theme", next); } catch (e) { /* без хранилища тема живёт до перезагрузки */ }
    syncTheme();
  });
  systemLight.addEventListener?.("change", syncTheme);
  syncTheme();

  // ---------------------------------------------------------------- Появление и счётчики
  const formatInt = (n) => Math.round(n).toLocaleString("ru-RU");

  function countUp(el) {
    const target = Number(el.dataset.count);
    if (!Number.isFinite(target) || reduceMotion) { el.textContent = formatInt(target); return; }
    const start = performance.now();
    const duration = 1100;
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = formatInt(target * eased);
      if (t < 1) requestAnimationFrame(step);
    };
    el.textContent = "0";
    requestAnimationFrame(step);
  }

  // Цифры видны сразу; когда блок попадает на экран, они коротко «набегают» до своего значения.
  const counters = document.querySelectorAll("[data-count]");
  if ("IntersectionObserver" in window && !reduceMotion) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        countUp(e.target);
        io.unobserve(e.target);
      }
    }, { threshold: 0.6 });
    counters.forEach((el) => io.observe(el));
  }

  // ---------------------------------------------------------------- Экраны в телефоне
  const tabs = Array.from(document.querySelectorAll(".phone-tabs [data-show]"));
  const screens = Array.from(document.querySelectorAll(".phone .screen"));
  let current = 0;
  let auto = null;

  function show(index, focus = false) {
    current = (index + tabs.length) % tabs.length;
    const name = tabs[current].dataset.show;
    tabs.forEach((t, i) => {
      const on = i === current;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
    });
    screens.forEach((s) => s.classList.toggle("is-active", s.dataset.screen === name));
    if (focus) tabs[current].focus();
  }

  function stopAuto() { if (auto) { clearInterval(auto); auto = null; } }

  tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => { stopAuto(); show(i); });
    tab.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") { e.preventDefault(); stopAuto(); show(current + 1, true); }
      if (e.key === "ArrowLeft") { e.preventDefault(); stopAuto(); show(current - 1, true); }
    });
  });
  show(0);
  if (!reduceMotion) auto = setInterval(() => show(current + 1), 5000);

  // Таймер отдыха в макете тренировки — тикает, чтобы было видно, как это выглядит.
  const restEl = document.querySelector("[data-rest]");
  const restBar = document.querySelector("[data-rest-bar]");
  const REST = 180;
  let left = 135;
  if (restEl && restBar && !reduceMotion) {
    setInterval(() => {
      left = left <= 0 ? REST : left - 1;
      const m = Math.floor(left / 60);
      const s = String(left % 60).padStart(2, "0");
      restEl.textContent = `${m}:${s}`;
      restBar.style.width = `${(left / REST) * 100}%`;
    }, 1000);
  }

  // ---------------------------------------------------------------- Калькулятор 1ПМ (как в приложении: Эпли)
  const form = document.getElementById("calc");
  const big = form.querySelector("[data-e1rm]");
  const hint = form.querySelector("[data-hint]");
  const table = form.querySelector("[data-table]");
  const kg = (v) => `${v.toLocaleString("ru-RU", { maximumFractionDigits: 1 })} кг`;
  const round = (v, step = 2.5) => Math.round(v / step) * step;

  /** 1ПМ ≈ вес × (1 + повторения / 30); один повтор — сам вес. RPE добавляет повторения «в запасе». */
  function e1rm(weight, reps, rpe) {
    const reserve = rpe ? Math.max(0, 10 - rpe) : 0;
    const total = reps + reserve;
    return total <= 1 ? weight : weight * (1 + total / 30);
  }

  function update() {
    const weight = Number(String(form.weight.value).replace(",", "."));
    const reps = Math.round(Number(form.reps.value));
    const rpe = Number(form.querySelector("input[name=rpe]:checked")?.value) || null;
    if (!(weight > 0 && weight <= 500 && reps >= 1 && reps <= 12)) {
      big.textContent = "—";
      hint.textContent = "вес до 500 кг, повторения 1–12";
      table.innerHTML = "";
      return;
    }
    const max = e1rm(weight, reps, rpe);
    big.textContent = kg(round(max, 0.5));
    hint.textContent = rpe ? `оценка 1ПМ с учётом RPE ${rpe}` : "оценка 1ПМ";
    const rows = [[95, "1–2"], [90, "2–3"], [85, "3–5"], [80, "5–6"], [75, "6–8"], [70, "8–10"], [65, "10–12"], [60, "12–15"]];
    table.innerHTML = rows.map(([p, r]) =>
      `<div class="calc__cell"><b>${kg(round(max * p / 100))}</b><span>${p} % · ${r} повт.</span></div>`).join("");
  }

  form.addEventListener("input", update);
  form.addEventListener("submit", (e) => e.preventDefault());
  update();

  // ---------------------------------------------------------------- Установка
  const soon = document.querySelector("[data-soon]");
  // Скачивание — только после подтверждения: кнопки открывают окно, файл отдаёт кнопка в нём.
  const dlDialog = document.querySelector("[data-download-dialog]");
  if (dlDialog) {
    dlDialog.querySelector("[data-download-confirm]")?.addEventListener("click", () => setTimeout(() => dlDialog.close(), 0));
    // Касание по затемнению вокруг окна — закрыть.
    dlDialog.addEventListener("click", (e) => { if (e.target === dlDialog) dlDialog.close(); });
  }
  document.querySelectorAll("[data-download]").forEach((a) => {
    if (DOWNLOAD_URL) {
      a.href = "#download";
      a.addEventListener("click", (e) => {
        e.preventDefault();
        if (dlDialog && typeof dlDialog.showModal === "function") dlDialog.showModal();
        else if (window.confirm("Скачать APK «Дневник тренировок» (4 МБ)?")) window.location.href = DOWNLOAD_URL;
      });
      return;
    }
    // Ссылки ещё нет: главная кнопка честно говорит «скоро», остальные ведут к ней.
    if (a.hasAttribute("data-download-main")) {
      a.setAttribute("aria-disabled", "true");
      a.addEventListener("click", (e) => { e.preventDefault(); if (soon) soon.hidden = false; });
    }
  });

  // ---------------------------------------------------------------- «Наверх» и логотип
  // Явная прокрутка: в окне просмотра (и при липкой шапке) переход по якорю может не сработать.
  document.querySelectorAll('a[href="#top"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    });
  });

  // ---------------------------------------------------------------- Год в подвале
  const year = document.querySelector("[data-year]");
  if (year) year.textContent = String(new Date().getFullYear());
})();
