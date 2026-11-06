// ===== Données (à adapter au salon) =====
const SERVICES = [
  { id: "coupe-femme", name: "Coupe & brushing femme", price: 45, duration: 60 },
  { id: "coupe-homme", name: "Coupe homme", price: 25, duration: 30 },
  { id: "coupe-barbe", name: "Coupe + barbe", price: 38, duration: 45 },
  { id: "couleur", name: "Couleur racines", price: 45, duration: 75 },
  { id: "balayage", name: "Balayage / mèches", price: 85, duration: 120 },
];

const STYLISTS = [
  { id: "sarah", name: "Sarah", role: "Coloriste", rating: 4.9, bio: "Experte balayage et couleurs lumineuses." },
  { id: "karim", name: "Karim", role: "Barbier", rating: 4.9, bio: "Dégradés précis et rasage traditionnel." },
  { id: "lea", name: "Léa", role: "Coiffeuse visagiste", rating: 4.8, bio: "Coupes sur-mesure adaptées à votre visage." },
  { id: "thomas", name: "Thomas", role: "Coiffeur mixte", rating: 4.7, bio: "Tendances homme & femme, coiffures de soirée." },
];

// Jours d'ouverture (0 = dimanche … 6 = samedi) et créneaux
const OPEN_DAYS = [2, 3, 4, 5, 6];
const SLOTS = ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00", "18:00"];

// ===== État =====
const state = { service: null, stylist: null, date: null, time: null };
const today = new Date(); today.setHours(0, 0, 0, 0);
let viewMonth = new Date(today.getFullYear(), today.getMonth(), 1);

const $ = (id) => document.getElementById(id);
const fmtDate = (d) => d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const fmtDuration = (m) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, "0") : ""}` : `${m} min`);

// ===== Rendu des options =====
function renderServices() {
  $("serviceList").innerHTML = SERVICES.map((s) => `
    <button type="button" class="option" data-id="${s.id}">
      <span class="option__body"><span class="option__name">${s.name}</span><span class="option__meta">${s.price} € · ${fmtDuration(s.duration)}</span></span>
      <span class="option__check"></span>
    </button>`).join("");
  $("serviceList").onclick = (e) => {
    const btn = e.target.closest(".option"); if (!btn) return;
    state.service = SERVICES.find((s) => s.id === btn.dataset.id);
    select($("serviceList"), btn); update();
  };
}

function renderStylists() {
  $("stylistList").innerHTML = STYLISTS.map((s) => `
    <button type="button" class="option" data-id="${s.id}">
      <span class="avatar">${s.name[0]}</span>
      <span class="option__body"><span class="option__name">${s.name}</span><span class="option__meta"><span class="star">★</span> ${s.rating} · ${s.role}</span></span>
      <span class="option__check"></span>
    </button>`).join("");
  $("stylistList").onclick = (e) => {
    const btn = e.target.closest(".option"); if (!btn) return;
    state.stylist = STYLISTS.find((s) => s.id === btn.dataset.id);
    select($("stylistList"), btn); renderSlots(); update();
  };

  $("teamGrid").innerHTML = STYLISTS.map((s) => `
    <article class="member"><div class="avatar">${s.name[0]}</div><h3>${s.name}</h3><p>${s.role}</p><small>${s.bio}</small></article>`).join("");
}

function select(list, btn) {
  list.querySelectorAll(".option").forEach((b) => b.classList.toggle("is-selected", b === btn));
}

// ===== Calendrier =====
function renderCalendar() {
  $("monthLabel").textContent = viewMonth.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const first = (viewMonth.getDay() + 6) % 7; // lundi = 0
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
  const maxDate = new Date(today); maxDate.setDate(maxDate.getDate() + 60);

  let html = "<span></span>".repeat(first);
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d);
    const disabled = date < today || date > maxDate || !OPEN_DAYS.includes(date.getDay());
    const cls = ["day",
      date.getTime() === today.getTime() ? "is-today" : "",
      state.date && date.getTime() === state.date.getTime() ? "is-selected" : ""].join(" ");
    html += `<button type="button" class="${cls}" data-d="${d}" ${disabled ? "disabled" : ""}>${d}</button>`;
  }
  $("calendarDays").innerHTML = html;
  $("prevMonth").disabled = viewMonth <= new Date(today.getFullYear(), today.getMonth(), 1);
  $("nextMonth").disabled = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1) > maxDate;
}

$("calendarDays").onclick = (e) => {
  const btn = e.target.closest(".day"); if (!btn || btn.disabled) return;
  state.date = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), +btn.dataset.d);
  state.time = null;
  renderCalendar(); renderSlots(); update();
};
$("prevMonth").onclick = () => { viewMonth.setMonth(viewMonth.getMonth() - 1); renderCalendar(); };
$("nextMonth").onclick = () => { viewMonth.setMonth(viewMonth.getMonth() + 1); renderCalendar(); };

// ===== Créneaux (indisponibilités simulées, stables par jour + coiffeur) =====
function isTaken(time) {
  const key = `${state.date.toDateString()}${state.stylist?.id || ""}${time}`;
  let h = 0; for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  if (h % 4 === 0) return true;
  if (state.date.getTime() === today.getTime()) {
    const [hh, mm] = time.split(":").map(Number), now = new Date();
    return hh * 60 + mm <= now.getHours() * 60 + now.getMinutes();
  }
  if (state.date.getDay() === 6 && time === "18:00") return true; // samedi : fermeture 18h
  return false;
}

function renderSlots() {
  if (!state.date) { $("slotList").innerHTML = `<p class="slots__empty">Sélectionnez d’abord une date.</p>`; return; }
  $("slotList").innerHTML = SLOTS.map((t) => {
    const taken = isTaken(t);
    if (taken && state.time === t) state.time = null;
    return `<button type="button" class="slot ${state.time === t ? "is-selected" : ""}" data-t="${t}" ${taken ? "disabled" : ""}>${t.replace(":", "h")}</button>`;
  }).join("");
}

$("slotList").onclick = (e) => {
  const btn = e.target.closest(".slot"); if (!btn || btn.disabled) return;
  state.time = btn.dataset.t; renderSlots(); update();
};

// ===== Récapitulatif & étapes =====
function update() {
  const { service, stylist, date, time } = state;
  $("sumService").textContent = service ? service.name : "—";
  $("sumPrice").textContent = service ? `${service.price} €` : "";
  $("sumStylist").textContent = stylist ? stylist.name : "—";
  $("sumDate").textContent = date ? fmtDate(date) : "—";
  $("sumTime").textContent = time ? time.replace(":", "h") : "—";
  $("sumDuration").textContent = service ? fmtDuration(service.duration) : "—";
  $("sumTotal").textContent = `${service ? service.price : 0} €`;

  const done = [!!service, !!stylist, !!(date && time)];
  const ready = done.every(Boolean);
  const active = ready ? 4 : done.indexOf(false) + 1;
  document.querySelectorAll(".step").forEach((el) => {
    const n = +el.dataset.step;
    el.classList.toggle("is-done", n < 4 ? done[n - 1] : false);
    el.classList.toggle("is-active", n === active);
  });
  $("confirmBtn").disabled = !ready;
}

$("confirmBtn").onclick = () => {
  const { service, stylist, date, time } = state;
  $("modalText").textContent = `${service.name} avec ${stylist.name}, le ${fmtDate(date)} à ${time.replace(":", "h")}. À très bientôt chez Élégance !`;
  $("modal").hidden = false;
  $("modalClose").focus();
};
const closeModal = () => {
  $("modal").hidden = true;
  Object.assign(state, { service: null, stylist: null, date: null, time: null });
  document.querySelectorAll(".option.is-selected").forEach((b) => b.classList.remove("is-selected"));
  renderCalendar(); renderSlots(); update();
};
$("modalClose").onclick = closeModal;
$("modal").onclick = (e) => { if (e.target === $("modal")) closeModal(); };
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("modal").hidden) closeModal(); });

// ===== Header & menu mobile =====
const header = $("header"), nav = $("nav"), burger = $("burger");
addEventListener("scroll", () => header.classList.toggle("is-scrolled", scrollY > 40), { passive: true });
burger.onclick = () => {
  const open = nav.classList.toggle("is-open");
  burger.setAttribute("aria-expanded", open);
};
nav.onclick = (e) => { if (e.target.tagName === "A") { nav.classList.remove("is-open"); burger.setAttribute("aria-expanded", false); } };

// ===== Init =====
$("year").textContent = today.getFullYear();
renderServices(); renderStylists(); renderCalendar(); renderSlots(); update();
