// ===================== Données du salon (à adapter) =====================
const CARTE = [
  { title: "Coupes", intro: "Shampoing et coiffage inclus.", items: [
    ["Coupe homme", "25 €"], ["Dégradé (taper, mid, high)", "25 €"], ["Coupe ciseaux", "28 €"], ["Coupe enfant (−12 ans)", "18 €"] ] },
  { title: "Barbe", intro: "Contours au rasoir et serviette chaude.", items: [
    ["Taille de barbe", "15 €"], ["Coupe + barbe", "35 €"], ["Rasage traditionnel", "20 €"] ] },
  { title: "Couleur", intro: "Décoloration et mèches réalisées avec soin du cheveu.", items: [
    ["Décoloration / platine", "dès 50 €"], ["Mèches", "dès 40 €"], ["Coloration", "dès 30 €"] ] },
  { title: "Finitions", intro: "Les détails qui font la différence.", items: [
    ["Trait / motif", "5 €"], ["Contour seul", "10 €"], ["Sourcils", "5 €"] ] },
];

const SERVICES = [
  { id: "coupe", name: "Coupe", price: 25 },
  { id: "degrade", name: "Dégradé", price: 25 },
  { id: "cb", name: "Coupe + barbe", price: 35 },
  { id: "barbe", name: "Barbe", price: 15 },
  { id: "deco", name: "Décoloration", price: 50 },
  { id: "enfant", name: "Enfant", price: 18 },
];

// Dernier créneau par jour d'ouverture (0 = dimanche … 6 = samedi)
const OPEN = { 2: "18:00", 3: "18:00", 4: "18:00", 5: "18:00", 6: "17:00" };
const SLOT_TIMES = ["09:00", "10:00", "11:00", "12:00", "14:00", "15:00", "16:00", "17:00", "18:00"];

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const pad = (n) => String(n).padStart(2, "0");
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

// ===================== Header, menu, lien actif =====================
const header = $("#header"), nav = $("#nav"), burger = $("#burger");
const navLinks = $$(".nav a:not(.nav__cta)");
const onScroll = () => {
  header.classList.toggle("is-solid", scrollY > 30);
  const y = scrollY + innerHeight * .4;
  let active = null;
  navLinks.forEach((a) => { const s = $(a.getAttribute("href")); if (s && s.offsetTop <= y) active = a; });
  navLinks.forEach((a) => a.classList.toggle("is-active", a === active));
};
addEventListener("scroll", onScroll, { passive: true }); onScroll();
const setMenu = (open) => {
  nav.classList.toggle("is-open", open);
  burger.setAttribute("aria-expanded", open);
  document.body.style.overflow = open ? "hidden" : "";
};
burger.addEventListener("click", () => setMenu(!nav.classList.contains("is-open")));
nav.addEventListener("click", (e) => { if (e.target.closest("a")) setMenu(false); });
addEventListener("keydown", (e) => { if (e.key === "Escape") setMenu(false); });

// ===================== Plafond nid d'abeille (accueil) =====================
const hive = $("#hive"), ctx = hive.getContext("2d");
let mouse = { x: -999, y: -999 }, cells = [];
function sizeHive() {
  const r = hive.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
  hive.width = r.width * dpr; hive.height = r.height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const R = Math.max(46, Math.min(80, r.width / 18)), w = Math.sqrt(3) * R, h = 1.5 * R;
  cells = [];
  for (let row = -1; row * h < r.height + R; row++)
    for (let col = -1; col * w < r.width + w; col++)
      cells.push({ x: col * w + (row % 2 ? w / 2 : 0), y: row * h, R, seed: Math.random() });
  drawHive(0);
}
function hexPath(x, y, R) {
  ctx.beginPath();
  for (let k = 0; k < 6; k++) {
    const a = Math.PI / 180 * (60 * k - 30);
    if (k) ctx.lineTo(x + R * Math.cos(a), y + R * Math.sin(a)); else ctx.moveTo(x + R * Math.cos(a), y + R * Math.sin(a));
  }
  ctx.closePath();
}
function drawHive(t) {
  const W = hive.clientWidth, H = hive.clientHeight;
  ctx.clearRect(0, 0, W, H);
  for (const c of cells) {
    const near = Math.max(0, 1 - Math.hypot(c.x - mouse.x, c.y - mouse.y) / 260);
    const fadeY = Math.max(0, 1 - c.y / (H * .95)); // plus lumineux en haut, comme un plafond
    const pulse = reduced ? 0 : (Math.sin(t / 1400 + c.seed * 12) + 1) / 2 * .05;
    const a = (.05 + pulse) * fadeY + near * .55;
    if (a < .01) continue;
    hexPath(c.x, c.y, c.R * .94);
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = `rgba(255,255,255,${a})`;
    ctx.shadowColor = "rgba(255,255,255,.8)";
    ctx.shadowBlur = near > .05 ? 14 * near : 0;
    ctx.stroke();
  }
}
let raf;
const loop = (t) => { drawHive(t); raf = requestAnimationFrame(loop); };
const heroEl = hive.parentElement;
heroEl.addEventListener("pointermove", (e) => { const r = hive.getBoundingClientRect(); mouse = { x: e.clientX - r.left, y: e.clientY - r.top }; });
heroEl.addEventListener("pointerleave", () => (mouse = { x: -999, y: -999 }));
addEventListener("resize", sizeHive);
sizeHive();
new IntersectionObserver(([en]) => { cancelAnimationFrame(raf); if (en.isIntersecting) raf = requestAnimationFrame(loop); }).observe(hive);

// ===================== Carte (accordéon) =====================
const acc = $("#accordion");
acc.innerHTML = CARTE.map((c, k) => `
  <div class="acc${k === 0 ? " is-open" : ""}">
    <button class="acc__head" aria-expanded="${k === 0}" aria-controls="acc-${k}" id="acc-h-${k}"><span class="acc__num">${pad(k + 1)}</span>${c.title}</button>
    <div class="acc__body" id="acc-${k}" role="region" aria-labelledby="acc-h-${k}">
      <div class="acc__inner"><p>${c.intro}</p><ul>${c.items.map(([n, p]) => `<li class="price"><span>${n}</span><i></i><b>${p}</b></li>`).join("")}</ul></div>
    </div>
  </div>`).join("");
acc.addEventListener("click", (e) => {
  const head = e.target.closest(".acc__head"); if (!head) return;
  const target = head.parentElement, wasOpen = target.classList.contains("is-open");
  $$(".acc", acc).forEach((item) => {
    const open = item === target && !wasOpen;
    item.classList.toggle("is-open", open);
    $(".acc__head", item).setAttribute("aria-expanded", open);
  });
});

// ===================== Réservation (téléphone) =====================
const state = { service: SERVICES[0].id, date: null, time: null, done: false };
const today = new Date(); today.setHours(0, 0, 0, 0);
const days = [];
for (let d = new Date(today); days.length < 12; d.setDate(d.getDate() + 1)) if (OPEN[d.getDay()]) days.push(new Date(d));
const fmtDay = (t) => new Date(t).toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "");
const fmtLong = (t) => new Date(t).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

function taken(time) {
  const d = new Date(state.date);
  if (time > OPEN[d.getDay()]) return true;
  if (state.date === today.getTime()) {
    const n = new Date(), [hh, mm] = time.split(":").map(Number);
    if (hh * 60 + mm <= n.getHours() * 60 + n.getMinutes() + 30) return true;
  }
  let h = 7; for (const c of state.date + time) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % 4 === 0; // créneaux déjà pris (simulation)
}
const chip = (g, v, label, sub) =>
  `<button class="chip${state[g] === v ? " is-on" : ""}" data-g="${g}" data-v="${v}" aria-pressed="${state[g] === v}">${label}${sub ? `<small>${sub}</small>` : ""}</button>`;

function renderPhone() {
  $("#pService").innerHTML = SERVICES.map((s) => chip("service", s.id, s.name, `${s.price} €`)).join("");
  $("#pDate").innerHTML = days.map((d) => chip("date", d.getTime(), `${fmtDay(d)} ${d.getDate()}`)).join("");
  $("#pSlots").innerHTML = SLOT_TIMES.map((t) => {
    const off = taken(t); if (off && state.time === t) state.time = null;
    return `<button class="slot${state.time === t ? " is-on" : ""}" data-t="${t}" ${off ? "disabled" : ""}>${t}</button>`;
  }).join("");
  const s = SERVICES.find((x) => x.id === state.service), btn = $("#pConfirm");
  btn.disabled = !state.time;
  btn.textContent = state.time ? `Confirmer · ${s.name} · ${state.time}` : "Choisissez un créneau";
  $("#phoneStatus").classList.toggle("is-ok", state.done);
  $("#phoneStatusText").textContent = state.done ? `Rendez-vous confirmé · ${fmtLong(state.date)}, ${state.time}` : "Réservez en moins d’une minute";
}
$("#phone").addEventListener("click", (e) => {
  const c = e.target.closest(".chip"), sl = e.target.closest(".slot");
  if (c) {
    const box = c.parentElement, left = box.scrollLeft;
    state[c.dataset.g] = c.dataset.g === "date" ? +c.dataset.v : c.dataset.v;
    state.done = false;
    renderPhone(); $("#" + box.id).scrollLeft = left;
  } else if (sl && !sl.disabled) { state.time = sl.dataset.t; state.done = false; renderPhone(); }
  else if (e.target.closest("#pConfirm") && state.time) { state.done = true; renderPhone(); }
});
for (const d of days) { state.date = d.getTime(); if (SLOT_TIMES.some((t) => !taken(t))) break; }
renderPhone();

// ===================== Divers =====================
$("#year").textContent = today.getFullYear();
const rows = $$(".hours tbody tr");
rows.forEach((r) => { if (r.cells[1].textContent.trim() === "Fermé") r.classList.add("is-closed"); });
rows[(today.getDay() + 6) % 7]?.classList.add("is-today");

// ===================== Réalisations : dévoilement + profondeur =====================
const looks = $$(".look");
looks.forEach((el, k) => {
  el.style.setProperty("--d", (k * .18) + "s");
  // on ne masque que ce qui est hors écran au chargement : la page reste complète sans script
  if (!reduced && el.getBoundingClientRect().top > innerHeight) {
    el.classList.add("will-reveal", "instant"); // masquage sans transition
    void el.offsetHeight;
    requestAnimationFrame(() => el.classList.remove("instant"));
  }
});
const lookIO = new IntersectionObserver((entries) => entries.forEach((en) => {
  if (en.isIntersecting) { en.target.classList.add("is-in"); lookIO.unobserve(en.target); }
}), { threshold: .2 });
looks.forEach((el) => lookIO.observe(el));

const speeds = [-0.04, 0.03, 0.08];
const parallax = () => {
  const off = reduced || innerWidth < 641;
  looks.forEach((el, k) => {
    if (off) return el.style.setProperty("--py", "0px");
    const r = el.parentElement.getBoundingClientRect();
    const mid = r.top + r.height / 2 - innerHeight / 2;
    el.style.setProperty("--py", (-mid * speeds[k]).toFixed(1) + "px");
  });
};
addEventListener("scroll", parallax, { passive: true });
addEventListener("resize", parallax);
parallax();

// ===================== Réalisations : mise en avant automatique en boucle =====================
const row = $(".travail__row");
let focusIdx = -1, cycleTimer = null;
const cycle = () => {
  looks.forEach((el) => el.classList.remove("is-focus"));
  focusIdx = (focusIdx + 1) % looks.length;
  void looks[focusIdx].offsetWidth; // relance le balayage
  looks[focusIdx].classList.add("is-focus");
};
const startCycle = () => {
  if (reduced || cycleTimer) return;
  row.classList.add("is-cycling"); cycle();
  cycleTimer = setInterval(cycle, 2800);
};
const stopCycle = () => { clearInterval(cycleTimer); cycleTimer = null; };
new IntersectionObserver(([en]) => {
  if (en.isIntersecting) setTimeout(startCycle, 1800); // après le dévoilement
  else stopCycle();
}, { threshold: .3 }).observe(row);
