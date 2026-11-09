// ===================== Données du salon (à adapter) =====================
const CARTE = [
  { title: "Coupe", intro: "Coupe aux ciseaux ou à la tondeuse, dégradé compris.", items: [
    ["Coupe homme · 30 min", "18 €"], ["Coupe & taille de barbe · 30 min", "28 €"] ] },
  { title: "Barbe", intro: "Taille, contours et finitions.", items: [
    ["Taillage barbe · 15 min", "12 €"] ] },
  { title: "Soin", intro: "Un moment de détente pour la peau.", items: [
    ["Soin du visage à la vapeur · 30 min", "25 €"] ] },
  { title: "Coloration", intro: "Sur rendez-vous par téléphone uniquement : appelez le 03 88 97 74 68.", items: [
    ["Coloration · 30 min", "15 €"] ] },
]

// Prestations, horaires et clés Supabase : voir config.js
const CFG = window.ELEGANCE;
const SERVICES = CFG.services, OPEN = CFG.open, SLOT_TIMES = CFG.slots;

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
// Lettres du nom découpées pour l'apparition une à une
const word = $(".hero__word");
word.setAttribute("data-text", word.textContent);
word.innerHTML = [...word.textContent].map((ch, i) => `<span style="--i:${i}">${ch}</span>`).join("");
$(".hero__title").setAttribute("aria-label", "Elegance Strasbourg");

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
// Allumage : chaque néon s'allume à son tour en partant du haut, grésille puis flashe
const introStart = performance.now();
const introOn = document.documentElement.classList.contains("intro");
function drawHive(t) {
  const W = hive.clientWidth, H = hive.clientHeight;
  const el = introOn ? (t || performance.now()) - introStart : 1e9;
  ctx.clearRect(0, 0, W, H);
  for (const c of cells) {
    if (c.onAt === undefined) c.onAt = 150 + Math.hypot(c.x - W * .62, c.y + c.R) / Math.hypot(W, H) * 1500 + c.seed * 300;
    const since = el - c.onAt;
    if (since < 0) continue;
    if (since < 240 && Math.sin(since * .11 + c.seed * 40) < 0) continue; // grésillement
    const flash = Math.max(0, 1 - (since - 240) / 900);
    const near = Math.max(0, 1 - Math.hypot(c.x - mouse.x, c.y - mouse.y) / 260);
    const fadeY = Math.max(0, 1 - c.y / (H * .95)); // plus lumineux en haut, comme un plafond
    const pulse = reduced ? 0 : (Math.sin(t / 1400 + c.seed * 12) + 1) / 2 * .05;
    const a = (.06 + pulse + flash * .7) * fadeY + near * .55;
    if (a < .01) continue;
    hexPath(c.x, c.y, c.R * .94);
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = `rgba(255,255,255,${Math.min(a, 1)})`;
    ctx.shadowColor = "rgba(255,255,255,.85)";
    const glow = Math.max(near, flash * fadeY);
    ctx.shadowBlur = glow > .05 ? 16 * glow : 0;
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

// ===================== Carte des prestations (tous les prix visibles) =====================
$("#menu").innerHTML = CARTE.map((c, k) => `
  <section class="menu__cat">
    <header class="menu__head"><span class="menu__num">${pad(k + 1)}</span><h3>${c.title}</h3></header>
    <p class="menu__intro">${c.intro}</p>
    <ul>${c.items.map(([n, p]) => { const [name, dur] = n.split(" · ");
      return `<li class="menu__item"><span class="menu__name">${name}${dur ? `<small>${dur}</small>` : ""}</span><i aria-hidden="true"></i><b class="menu__price">${p.replace(/(\d+)\s*€/, '$1<span class="eur">€</span>')}</b></li>`; }).join("")}</ul>
  </section>`).join("");

// ===================== Réservation (téléphone) =====================
// Vraie réservation via Supabase quand config.js est rempli, sinon mode démonstration.
const db = CFG.supabaseUrl && CFG.supabaseAnonKey && window.supabase
  ? window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey)
  : null;
const DEMO = !db;

const today = new Date(); today.setHours(0, 0, 0, 0);
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromIso = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const fmtDay = (s) => fromIso(s).toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "");
const fmtLong = (s) => fromIso(s).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

const days = [];
for (let d = new Date(today), n = 0; n < CFG.daysAhead; n++, d.setDate(d.getDate() + 1)) if (OPEN[d.getDay()]) days.push(iso(d));

const BARBERS = CFG.barbers || [], CAP = Math.max(1, BARBERS.length);
const barberName = (id) => (BARBERS.find((b) => b.id === id) || {}).name;
// load : "jour|heure" -> { total, barbers:Set } (nombre de rdv et coiffeurs déjà pris)
const book = { service: SERVICES[0].id, barber: "any", date: null, time: null, load: new Map(), blocked: new Set(), loading: false };
const el = {
  pick: $("#stepPick"), form: $("#stepForm"), done: $("#stepDone"),
  status: $("#phoneStatus"), statusText: $("#phoneStatusText"),
  next: $("#pNext"), submit: $("#pSubmit"), error: $("#pError"), loading: $("#pLoading"),
};

if (DEMO) $("#phoneTag").textContent = "Mode démonstration · aucune réservation n’est enregistrée";

function demoTaken(day, time) {
  let h = 7; for (const c of day + time) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % 4 === 0;
}

async function loadAvailability() {
  book.loading = true; el.loading.hidden = false;
  try {
    if (DEMO) {
      book.load = new Map(days.flatMap((d) => SLOT_TIMES.filter((t) => demoTaken(d, t)).map((t) => [`${d}|${t}`, { total: CAP, barbers: new Set() }])));
    } else {
      const from = days[0], to = days[days.length - 1];
      let [load, blocked] = await Promise.all([
        db.rpc("slot_load", { from_day: from, to_day: to }),
        db.from("blocked_days").select("day").gte("day", from).lte("day", to),
      ]);
      if (load.error) { // base pas encore mise à jour : créneaux complets seulement
        const t = await db.rpc("taken_slots", { from_day: from, to_day: to });
        if (t.error) throw t.error;
        load = { data: t.data.map((r) => ({ ...r, total: CAP, barbers: [] })) };
      }
      if (blocked.error) throw blocked.error;
      book.load = new Map(load.data.map((r) => [`${r.day}|${String(r.slot).slice(0, 5)}`, { total: r.total, barbers: new Set(r.barbers || []) }]));
      book.blocked = new Set(blocked.data.map((r) => r.day));
    }
    el.error.textContent = "";
  } catch (err) {
    console.error(err);
    el.statusText.textContent = "Créneaux indisponibles pour le moment. Réessayez ou appelez le salon.";
  } finally {
    book.loading = false; el.loading.hidden = true;
  }
}

function slotFree(day, time) {
  const d = fromIso(day);
  if (book.blocked.has(day) || !OPEN[d.getDay()] || time > OPEN[d.getDay()]) return false;
  if (day === iso(today)) {
    const n = new Date(), [hh, mm] = time.split(":").map(Number);
    if (hh * 60 + mm <= n.getHours() * 60 + n.getMinutes() + 30) return false;
  }
  const l = book.load.get(`${day}|${time}`);
  if (!l) return true;
  if (l.total >= CAP) return false;
  return book.barber === "any" || !l.barbers.has(book.barber);
}
const dayHasSlot = (day) => SLOT_TIMES.some((t) => slotFree(day, t));

const chip = (g, v, label, sub, off) =>
  `<button type="button" class="chip${book[g] === v ? " is-on" : ""}" data-g="${g}" data-v="${v}" aria-pressed="${book[g] === v}" ${off ? "disabled" : ""}>${label}${sub ? `<small>${sub}</small>` : ""}</button>`;

function renderPick() {
  $("#pService").innerHTML = SERVICES.map((s) => chip("service", s.id, s.name, `${s.price} €`)).join("");
  $("#pBarber").innerHTML = chip("barber", "any", `<span class="av av--any" aria-hidden="true">✦</span>`, "Peu importe")
    + BARBERS.map((b) => chip("barber", b.id, `<span class="av" aria-hidden="true">${b.name[0]}</span>`, b.name)).join("");
  $("#pDate").innerHTML = days.map((d) => chip("date", d, `${fmtDay(d)} ${fromIso(d).getDate()}`, book.blocked.has(d) ? "fermé" : !dayHasSlot(d) ? "complet" : "", !dayHasSlot(d))).join("");
  if (book.time && !slotFree(book.date, book.time)) book.time = null;
  $("#pSlots").innerHTML = SLOT_TIMES.map((t) => {
    const off = !slotFree(book.date, t);
    return `<button type="button" class="slot${book.time === t ? " is-on" : ""}" data-t="${t}" ${off ? "disabled" : ""}>${t}</button>`;
  }).join("");
  const s = SERVICES.find((x) => x.id === book.service);
  el.next.disabled = !book.time;
  el.next.textContent = book.time ? `Continuer · ${s.name} · ${book.time}` : "Choisissez un créneau";
}

function show(step) {
  el.pick.hidden = step !== "pick"; el.form.hidden = step !== "form"; el.done.hidden = step !== "done";
  el.status.classList.toggle("is-ok", step === "done");
  if (step !== "done") el.statusText.textContent = step === "form" ? "Plus qu’une étape" : "Réservez en moins d’une minute";
}

el.pick.addEventListener("click", (e) => {
  const c = e.target.closest(".chip"), sl = e.target.closest(".slot");
  if (c && !c.disabled) {
    const box = c.parentElement, left = box.scrollLeft;
    book[c.dataset.g] = c.dataset.v;
    renderPick(); $("#" + box.id).scrollLeft = left;
  } else if (sl && !sl.disabled) { book.time = sl.dataset.t; renderPick(); }
});

el.next.addEventListener("click", () => {
  if (!book.time) return;
  const s = SERVICES.find((x) => x.id === book.service);
  $("#pRecap").innerHTML = `<b>${s.name}</b> · ${s.price} €<br>${fmtLong(book.date)} à ${book.time}<br>${book.barber === "any" ? "Premier coiffeur disponible" : "Avec " + barberName(book.barber)}`;
  el.error.textContent = "";
  show("form");
  $("#fName").focus({ preventScroll: true });
});
$("#pBack").addEventListener("click", () => show("pick"));

function validate() {
  const name = $("#fName").value.trim(), phone = $("#fPhone").value.trim(), email = $("#fEmail").value.trim();
  if (name.length < 2) return ["Indiquez votre nom et prénom.", "#fName"];
  if (!/^[0-9 +().-]{8,20}$/.test(phone) || phone.replace(/\D/g, "").length < 9) return ["Indiquez un numéro de téléphone valide, par exemple 06 12 34 56 78.", "#fPhone"];
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return ["L’adresse e-mail n’est pas valide. Corrigez-la ou laissez le champ vide.", "#fEmail"];
  return [null, { name, phone, email }];
}

el.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const [msg, data] = validate();
  if (msg) { el.error.textContent = msg; $(data).focus(); return; }
  const s = SERVICES.find((x) => x.id === book.service);
  el.submit.disabled = true; el.submit.textContent = "Envoi…"; el.error.textContent = "";
  try {
    if (DEMO) {
      await new Promise((r) => setTimeout(r, 600));
    } else {
      const row = {
        day: book.date, slot: book.time, service: s.name, price: s.price,
        client_name: data.name, client_phone: data.phone, client_email: data.email || null,
        barber: book.barber === "any" ? null : book.barber,
      };
      let { error } = await db.from("appointments").insert(row);
      if (error && error.code === "PGRST204") { delete row.barber; ({ error } = await db.from("appointments").insert(row)); } // base pas encore mise à jour
      if (error) throw error;
    }
    const k = `${book.date}|${book.time}`, l = book.load.get(k) || { total: 0, barbers: new Set() };
    l.total++; if (book.barber !== "any") l.barbers.add(book.barber); book.load.set(k, l);
    $("#pDoneText").textContent = `${s.name}${book.barber === "any" ? "" : " avec " + barberName(book.barber)} · ${fmtLong(book.date)} à ${book.time}. À très vite au salon, ${data.name.split(" ")[0]} !`;
    el.statusText.textContent = `Rendez-vous confirmé · ${fmtLong(book.date)}, ${book.time}`;
    show("done");
    el.form.reset();
  } catch (err) {
    console.error(err);
    const gone = err && (err.code === "23505" || err.code === "42501");
    if (gone) {
      await loadAvailability(); book.time = null; renderPick(); show("pick");
      el.statusText.textContent = "Ce créneau vient d’être pris. Choisissez-en un autre.";
    } else {
      el.error.textContent = "La réservation n’a pas pu être envoyée. Vérifiez votre connexion et réessayez, ou appelez le salon.";
    }
  } finally {
    el.submit.disabled = false; el.submit.textContent = "Confirmer le rendez-vous";
  }
});

$("#pAgain").addEventListener("click", () => { book.time = null; renderPick(); show("pick"); });

(async () => {
  book.date = days[0];
  renderPick();
  await loadAvailability();
  book.date = days.find(dayHasSlot) || days[0];
  renderPick();
})();

// ===================== Divers =====================
$("#year").textContent = today.getFullYear();
const rows = $$(".hours tbody tr");
rows.forEach((r) => { if (r.cells[1].textContent.trim() === "Fermé") r.classList.add("is-closed"); });
rows[(today.getDay() + 6) % 7]?.classList.add("is-today");

// ===================== Réalisations : défilement continu =====================
const track = $("#reelTrack");
const set = track.innerHTML;
track.innerHTML = set + set; // deux copies identiques -> boucle sans couture
track.querySelectorAll(".reel__item").forEach((el, k) => { if (k >= track.children.length / 2) el.setAttribute("aria-hidden", "true"); });

// ===================== L'équipe =====================
$("#team").innerHTML = BARBERS.map((b, k) => `
  <li class="crew__row" data-reveal>
    <span class="crew__num">${pad(k + 1)}</span>
    <span class="crew__name">${b.name}</span>
    <span class="crew__hexwrap" aria-hidden="true"><span class="crew__hex">${b.name[0]}</span></span>
    <a href="#prestations" class="crew__book" data-pick-barber="${b.id}">Réserver<span class="sr-only"> avec ${b.name}</span> <span aria-hidden="true">→</span></a>
  </li>`).join("");
$("#team").insertAdjacentHTML("afterend", `<p class="crew__any">Pas de préférence ? <a href="#prestations" data-pick-barber="any">Réserver avec le premier barbier disponible →</a></p>`);
document.addEventListener("click", (e) => {
  const a = e.target.closest("[data-pick-barber]"); if (!a) return;
  book.barber = a.dataset.pickBarber; book.time = null;
  show("pick"); renderPick();
});

// ===================== Apparitions à l'entrée dans l'écran =====================
// Seuls les éléments encore hors écran au chargement sont masqués : la page reste complète sans script.
if (!reduced && "IntersectionObserver" in window) {
  const io = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
  }), { threshold: .12, rootMargin: "0px 0px -6% 0px" });
  const groups = new Map();
  $$("[data-reveal]").forEach((el) => {
    if (el.getBoundingClientRect().top < innerHeight) return;
    const parent = el.parentElement, n = groups.get(parent) || 0;
    groups.set(parent, n + 1);
    el.style.setProperty("--rd", `${Math.min(n, 6) * 0.08}s`);
    el.classList.add("rv"); io.observe(el);
  });
}

// ===================== Barre fixe mobile (Appeler / Réserver) =====================
const mbar = $("#mbar");
const phoneSec = $("#phone");
let phoneInView = false;
new IntersectionObserver(([en]) => { phoneInView = en.isIntersecting; toggleMbar(); }, { threshold: .15 }).observe(phoneSec);
function toggleMbar() {
  const on = scrollY > innerHeight * .6 && !phoneInView;
  mbar.classList.toggle("is-on", on);
  mbar.setAttribute("aria-hidden", String(!on));
  mbar.querySelectorAll("a").forEach((a) => (on ? a.removeAttribute("tabindex") : a.setAttribute("tabindex", "-1")));
}
addEventListener("scroll", toggleMbar, { passive: true });
