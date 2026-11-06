// ===================== Données du salon (à adapter) =====================
const CARTE = [
  { title: "Femme", intro: "Coupe, brushing et coiffage, shampoing soin inclus.", items: [
    ["Coupe & brushing", "45 €"], ["Brushing", "28 €"], ["Coupe enfant (−12 ans)", "18 €"], ["Chignon & coiffure de soirée", "dès 55 €"] ] },
  { title: "Couleur & lumière", intro: "Diagnostic couleur offert avant chaque prestation.", items: [
    ["Couleur racines", "45 €"], ["Couleur complète", "60 €"], ["Balayage / mèches", "dès 85 €"], ["Patine & gloss", "25 €"] ] },
  { title: "Homme & barbier", intro: "Finitions au rasoir et serviette chaude.", items: [
    ["Coupe homme", "25 €"], ["Coupe + barbe", "38 €"], ["Taille de barbe", "18 €"], ["Rasage traditionnel", "25 €"] ] },
  { title: "Soins", intro: "Des rituels professionnels pour réparer et sublimer.", items: [
    ["Soin profond", "20 €"], ["Soin kératine", "dès 120 €"], ["Massage crânien", "15 €"] ] },
];

const SERVICES = [
  { id: "cf", name: "Coupe femme", price: 45, min: 60 },
  { id: "ch", name: "Coupe homme", price: 25, min: 30 },
  { id: "cb", name: "Coupe + barbe", price: 38, min: 45 },
  { id: "bal", name: "Balayage", price: 85, min: 150 },
  { id: "col", name: "Couleur", price: 45, min: 75 },
  { id: "bar", name: "Barbe", price: 18, min: 20 },
];

const TEAM = [
  { id: "sarah", name: "Sarah", role: "Coloriste", spec: "Balayages lumineux et couleurs naturelles.", fb: "var(--fb-2)" },
  { id: "karim", name: "Karim", role: "Barbier", spec: "Dégradés précis et rasage à l’ancienne.", fb: "var(--fb-3)" },
  { id: "lea", name: "Léa", role: "Visagiste", spec: "Coupes pensées pour la forme du visage.", fb: "var(--fb-1)" },
  { id: "thomas", name: "Thomas", role: "Coiffeur mixte", spec: "Tendances homme & femme, chignons.", fb: "var(--fb-4)" },
];

// 0 = dimanche … 6 = samedi
const OPEN = { 2: ["09:00", "18:00"], 3: ["09:00", "18:00"], 4: ["09:00", "18:00"], 5: ["09:00", "18:00"], 6: ["09:00", "17:00"] };
const SLOT_TIMES = ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00", "18:00"];

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const pad = (n) => String(n).padStart(2, "0");
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

// ===================== Header & menu =====================
const header = $("#header"), nav = $("#nav"), burger = $("#burger");
const onScroll = () => header.classList.toggle("is-solid", scrollY > 30);
addEventListener("scroll", onScroll, { passive: true }); onScroll();
const setMenu = (open) => {
  nav.classList.toggle("is-open", open);
  burger.setAttribute("aria-expanded", open);
  document.body.style.overflow = open ? "hidden" : "";
};
burger.addEventListener("click", () => setMenu(!nav.classList.contains("is-open")));
nav.addEventListener("click", (e) => { if (e.target.closest("a")) setMenu(false); });
addEventListener("keydown", (e) => { if (e.key === "Escape") setMenu(false); });

// ===================== Sliders =====================
$$(".slider").forEach((root) => {
  const slides = $$(".slide", root);
  const cur = $("[data-current]", root), bar = $(".slider__progress span", root);
  const delay = +root.dataset.autoplay || 0;
  let i = 0, timer = null;
  $("[data-total]", root).textContent = pad(slides.length);

  const go = (n) => {
    slides[i].classList.remove("is-active");
    slides[i].setAttribute("aria-hidden", "true");
    i = (n + slides.length) % slides.length;
    slides[i].classList.add("is-active");
    slides[i].removeAttribute("aria-hidden");
    cur.textContent = pad(i + 1);
    restart();
  };
  const restart = () => {
    clearTimeout(timer);
    bar.classList.remove("run"); void bar.offsetWidth;
    if (delay && !reduced) {
      bar.style.setProperty("--dur", delay + "ms");
      bar.classList.add("run");
      timer = setTimeout(() => go(i + 1), delay);
    } else {
      bar.style.width = ((i + 1) / slides.length) * 100 + "%";
    }
  };
  slides.forEach((s, k) => k && s.setAttribute("aria-hidden", "true"));
  $("[data-prev]", root).addEventListener("click", () => go(i - 1));
  $("[data-next]", root).addEventListener("click", () => go(i + 1));

  // swipe
  let x0 = null;
  root.addEventListener("touchstart", (e) => (x0 = e.touches[0].clientX), { passive: true });
  root.addEventListener("touchend", (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0; x0 = null;
    if (Math.abs(dx) > 50) go(i + (dx < 0 ? 1 : -1));
  });
  // pause hors écran
  new IntersectionObserver(([en]) => { if (en.isIntersecting) restart(); else clearTimeout(timer); }, { threshold: .3 }).observe(root);
  restart();
});

// ===================== Navigation à points =====================
const dotLinks = $$("#dots a");
const sections = dotLinks.map((a) => $(a.getAttribute("href")));
const markDots = () => {
  const y = scrollY + innerHeight * .45;
  let k = 0;
  sections.forEach((s, n) => { if (s.offsetTop <= y) k = n; });
  dotLinks.forEach((a, n) => { a.classList.toggle("is-active", n === k); a.classList.toggle("is-past", n < k); });
};
addEventListener("scroll", markDots, { passive: true }); markDots();

// ===================== Carte (accordéon) =====================
const acc = $("#accordion");
acc.innerHTML = CARTE.map((c, k) => `
  <div class="acc${k === 0 ? " is-open" : ""}">
    <button class="acc__head" aria-expanded="${k === 0}" aria-controls="acc-${k}" id="acc-h-${k}">
      <span class="acc__num">${pad(k + 1)}</span>${c.title}
    </button>
    <div class="acc__body" id="acc-${k}" role="region" aria-labelledby="acc-h-${k}">
      <div class="acc__inner"><p>${c.intro}</p><ul>${c.items.map(([n, p]) => `<li class="price"><span>${n}</span><i></i><b>${p}</b></li>`).join("")}</ul></div>
    </div>
  </div>`).join("");
acc.addEventListener("click", (e) => {
  const head = e.target.closest(".acc__head"); if (!head) return;
  $$(".acc", acc).forEach((item) => {
    const open = item === head.parentElement;
    item.classList.toggle("is-open", open);
    $(".acc__head", item).setAttribute("aria-expanded", open);
  });
});

// ===================== Équipe =====================
$("#team").innerHTML = TEAM.map((m) => `
  <article class="member">
    <div class="member__art has-photo" style="--fb:${m.fb}; --img:url('images/team-${m.id}.jpg')"><span>${m.name[0]}</span><em>${m.role}</em></div>
    <div class="member__body">
      <h3>${m.name}</h3>
      <p>${m.spec}</p>
      <a href="#prestations" class="member__book" data-stylist="${m.id}">Réserver avec ${m.name} <span aria-hidden="true">→</span></a>
    </div>
  </article>`).join("");

// ===================== Réservation (téléphone) =====================
const state = { service: SERVICES[0].id, stylist: "any", date: null, time: null, done: false };
const today = new Date(); today.setHours(0, 0, 0, 0);
const days = [];
for (let d = new Date(today); days.length < 12; d.setDate(d.getDate() + 1)) if (OPEN[d.getDay()]) days.push(new Date(d));
state.date = days[0].getTime();
// démarre sur le premier jour qui a encore un créneau libre
queueMicrotask(() => {
  for (const d of days) { state.date = d.getTime(); if (SLOT_TIMES.some((t) => !taken(t))) break; }
  renderPhone();
});

const fmtDay = (t) => new Date(t).toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "");
const fmtLong = (t) => new Date(t).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

function taken(time) {
  const d = new Date(state.date);
  const [hh, mm] = time.split(":").map(Number);
  if (time > OPEN[d.getDay()][1]) return true;
  if (state.date === today.getTime()) { const n = new Date(); if (hh * 60 + mm <= n.getHours() * 60 + n.getMinutes() + 30) return true; }
  let h = 7; for (const c of state.date + state.stylist + time) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % 4 === 0; // créneaux déjà réservés (simulation)
}

function chip(group, value, label, sub) {
  const on = state[group] === value;
  return `<button class="chip${on ? " is-on" : ""}" data-g="${group}" data-v="${value}" aria-pressed="${on}">${label}${sub ? `<small>${sub}</small>` : ""}</button>`;
}

function renderPhone() {
  $("#pService").innerHTML = SERVICES.map((s) => chip("service", s.id, s.name, `${s.price} €`)).join("");
  $("#pStylist").innerHTML = chip("stylist", "any", "Sans préférence") + TEAM.map((m) => chip("stylist", m.id, m.name)).join("");
  $("#pDate").innerHTML = days.map((d) => chip("date", d.getTime(), `${fmtDay(d)} ${d.getDate()}`)).join("");
  $("#pSlots").innerHTML = SLOT_TIMES.map((t) => {
    const off = taken(t);
    if (off && state.time === t) state.time = null;
    return `<button class="slot${state.time === t ? " is-on" : ""}" data-t="${t}" ${off ? "disabled" : ""}>${t}</button>`;
  }).join("");

  const s = SERVICES.find((x) => x.id === state.service);
  const btn = $("#pConfirm");
  btn.disabled = !state.time;
  btn.textContent = state.time ? `Confirmer · ${s.name} · ${state.time}` : "Choisissez un créneau";

  const status = $("#phoneStatus");
  status.classList.toggle("is-ok", state.done);
  $("#phoneStatusText").textContent = state.done
    ? `Rendez-vous confirmé · ${fmtLong(state.date)}, ${state.time}`
    : "Réservez en moins d’une minute";
}

$("#phone").addEventListener("click", (e) => {
  const c = e.target.closest(".chip"), sl = e.target.closest(".slot");
  if (c) {
    const g = c.dataset.g;
    state[g] = g === "date" ? +c.dataset.v : c.dataset.v;
    if (g !== "service") state.time = state.time; // conserve l'heure si encore libre
    state.done = false;
    const scroller = c.parentElement, left = scroller.scrollLeft;
    renderPhone();
    $(`#${scroller.id}`).scrollLeft = left;
  } else if (sl && !sl.disabled) {
    state.time = sl.dataset.t; state.done = false; renderPhone();
  } else if (e.target.closest("#pConfirm") && state.time) {
    state.done = true; renderPhone();
  }
});

// Liens « Réserver avec … »
document.addEventListener("click", (e) => {
  const a = e.target.closest("[data-stylist]");
  if (a) { state.stylist = a.dataset.stylist; state.done = false; renderPhone(); }
});

renderPhone();

// ===================== Divers =====================
$("#year").textContent = today.getFullYear();
const dayIdx = today.getDay();
const row = { 1: 0, 2: 1, 3: 1, 4: 1, 5: 1, 6: 2, 0: 3 }[dayIdx];
$$(".hours tbody tr")[row]?.classList.add("is-today");
