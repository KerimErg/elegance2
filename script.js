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
// Un seul calcul par image affichée ; positions des sections mesurées une fois (et au redimensionnement).
const header = $("#header"), nav = $("#nav"), burger = $("#burger");
const navLinks = $$(".nav a:not(.nav__cta)");
let navTops = [], scrollTick = false, lastSolid = null, lastActive = null;
const measureNav = () => { navTops = navLinks.map((a) => { const s = $(a.getAttribute("href")); return s ? s.offsetTop : Infinity; }); };
const scrollWork = [];                       // autres tâches liées au défilement (barre mobile…)
const onScroll = () => {
  scrollTick = false;
  const solid = scrollY > 30;
  if (solid !== lastSolid) { header.classList.toggle("is-solid", solid); lastSolid = solid; }
  const y = scrollY + innerHeight * .4;
  let active = -1;
  navTops.forEach((top, i) => { if (top <= y) active = i; });
  if (active !== lastActive) { navLinks.forEach((a, i) => a.classList.toggle("is-active", i === active)); lastActive = active; }
  scrollWork.forEach((fn) => fn());
};
addEventListener("scroll", () => { if (!scrollTick) { scrollTick = true; requestAnimationFrame(onScroll); } }, { passive: true });
addEventListener("resize", () => { measureNav(); onScroll(); });
addEventListener("load", () => { measureNav(); onScroll(); });
measureNav(); onScroll();
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

// Rendu rapide : chaque hexagone (net et lumineux) est dessiné une seule fois dans une petite
// image, puis simplement recopié. L'animation ne tourne que pendant l'allumage et quand la souris bouge.
const hexTrace = (c, x, y, R) => {
  c.beginPath();
  for (let k = 0; k < 6; k++) {
    const a = Math.PI / 180 * (60 * k - 30), px = x + R * Math.cos(a), py = y + R * Math.sin(a);
    if (k) c.lineTo(px, py); else c.moveTo(px, py);
  }
  c.closePath();
};
const hexSprite = (R, glow, dpr, lw = 1.4, blur = 16) => {
  const pad = glow ? blur * 1.6 : 4, size = Math.ceil((R + pad) * 2), s = document.createElement("canvas");
  s.width = Math.ceil(size * dpr); s.height = Math.ceil(size * dpr);
  const c = s.getContext("2d"); c.scale(dpr, dpr);
  hexTrace(c, size / 2, size / 2, R * .94);
  c.lineWidth = lw; c.strokeStyle = "#fff";
  if (glow) { c.shadowColor = "rgba(255,255,255,.95)"; c.shadowBlur = blur; c.stroke(); }
  c.stroke();
  s.half = size / 2;
  return s;
};

const hive = $("#hive"), ctx = hive.getContext("2d");
const heroEl = hive.parentElement;
let mouse = { x: -999, y: -999 }, cells = [], hiveW = 0, hiveH = 0, sprLine = null, sprGlow = null, baseLayer = null, introDone = 0;
const introStart = performance.now();
const introOn = document.documentElement.classList.contains("intro");
let lastMove = -1e9, raf = 0, hiveVisible = true;

function sizeHive() {
  const dpr = Math.min(devicePixelRatio || 1, 1.5);
  hiveW = hive.offsetWidth; hiveH = hive.offsetHeight;
  hive.width = Math.round(hiveW * dpr); hive.height = Math.round(hiveH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const R = Math.max(46, Math.min(80, hiveW / 18)), w = Math.sqrt(3) * R, h = 1.5 * R;
  sprLine = hexSprite(R, false, dpr); sprGlow = hexSprite(R, true, dpr);
  cells = [];
  for (let row = -1; row * h < hiveH + R; row++)
    for (let col = -1; col * w < hiveW + w; col++) {
      const x = col * w + (row % 2 ? w / 2 : 0), y = row * h, seed = Math.random();
      cells.push({ x, y, seed,
        onAt: 150 + Math.hypot(x - hiveW * .62, y + R) / Math.hypot(hiveW, hiveH) * 1500 + seed * 300,
        fadeY: Math.max(0, 1 - y / (hiveH * .95)) });   // plus lumineux en haut, comme un plafond
    }
  introDone = Math.max(...cells.map((c) => c.onAt)) + 1200;   // fin de l'allumage (dernier flash éteint)
  // grille au repos, figée une fois pour toutes dans une seule image
  baseLayer = document.createElement("canvas"); baseLayer.width = hive.width; baseLayer.height = hive.height;
  { const b = baseLayer.getContext("2d"), sl = sprLine.half; b.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const c of cells) { const a = .08 * c.fadeY; if (a > .01) { b.globalAlpha = a; b.drawImage(sprLine, c.x - sl, c.y - sl, sl * 2, sl * 2); } } }
  kickHive();
}
function drawHive(t) {
  const el = introOn ? t - introStart : 1e9;
  ctx.clearRect(0, 0, hiveW, hiveH);
  const sl = sprLine.half, sg = sprGlow.half;
  if (el > introDone) {
    // Après l'allumage : la grille figée en une fois, puis seulement les néons proches de la souris
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(baseLayer, 0, 0);
    ctx.setTransform(hive.width / hiveW, 0, 0, hive.height / hiveH, 0, 0);
    if (mouse.x > -500) for (const c of cells) {
      const dx = c.x - mouse.x, dy = c.y - mouse.y;
      if (dx * dx + dy * dy > 67600) continue;               // au-delà de 260 px : rien à faire
      const near = 1 - Math.sqrt(dx * dx + dy * dy) / 260;
      ctx.globalAlpha = near * .35; ctx.drawImage(sprLine, c.x - sl, c.y - sl, sl * 2, sl * 2);
      ctx.globalAlpha = near * .7; ctx.drawImage(sprGlow, c.x - sg, c.y - sg, sg * 2, sg * 2);
    }
    ctx.globalAlpha = 1;
    return;
  }
  for (const c of cells) {
    const since = el - c.onAt;
    if (since < 0) continue;
    if (since < 240 && Math.sin(since * .11 + c.seed * 40) < 0) continue;   // grésillement
    const flash = Math.max(0, 1 - (since - 240) / 900);
    const near = Math.max(0, 1 - Math.hypot(c.x - mouse.x, c.y - mouse.y) / 260);
    const base = (.08 + flash * .7) * c.fadeY + near * .35;
    if (base > .01) { ctx.globalAlpha = Math.min(1, base); ctx.drawImage(sprLine, c.x - sl, c.y - sl, sl * 2, sl * 2); }
    const glow = Math.max(near * .7, flash * c.fadeY * .85);
    if (glow > .03) { ctx.globalAlpha = Math.min(1, glow); ctx.drawImage(sprGlow, c.x - sg, c.y - sg, sg * 2, sg * 2); }
  }
  ctx.globalAlpha = 1;
}
function hiveFrame(t) {
  raf = 0;
  drawHive(t);
  const busy = (introOn && t - introStart < 3800) || t - lastMove < 450;
  if (busy && hiveVisible) raf = requestAnimationFrame(hiveFrame);
}
function kickHive() { if (!raf && hiveVisible) raf = requestAnimationFrame(hiveFrame); }
heroEl.addEventListener("pointermove", (e) => {
  const r = hive.getBoundingClientRect();
  mouse = { x: e.clientX - r.left, y: e.clientY - r.top }; lastMove = performance.now(); kickHive();
});
heroEl.addEventListener("pointerleave", () => { mouse = { x: -999, y: -999 }; lastMove = performance.now(); kickHive(); });
let hiveResize = 0;
addEventListener("resize", () => { clearTimeout(hiveResize); hiveResize = setTimeout(sizeHive, 150); });
sizeHive();
new IntersectionObserver(([en]) => { hiveVisible = en.isIntersecting; if (hiveVisible) kickHive(); }).observe(hive);


// ===================== Carte des prestations (tous les prix visibles) =====================
$("#menu").innerHTML = CARTE.map((c, k) => `
  <section class="menu__cat">
    <header class="menu__head"><h3>${c.title}</h3></header>
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

// ===================== L'équipe =====================
$("#team").innerHTML = BARBERS.map((b, k) => `
  <li class="crew__row" data-reveal>
    <span class="crew__name">${b.name}</span>
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

// ===================== Allumage du plafond (piloté par le défilement) =====================
(() => {
  const sec = $("#ceiling"), cv = $("#ceilingCanvas");
  if (!sec || !cv) return;
  const g = cv.getContext("2d");
  let cells = [], W = 0, H = 0, lastP = -1, sprOff = null, sprOn = null, sprGlow = null, grid = null, secTop = 0, secSpan = 1;

  function build() {
    const dpr = 1;                                     // le halo des néons masque la résolution
    W = cv.offsetWidth; H = cv.offsetHeight;          // taille réelle, avant la mise en perspective
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const R = Math.max(40, Math.min(66, W / 30)), w = Math.sqrt(3) * R, h = 1.5 * R;
    sprGlow = hexSprite(R, true, dpr, 2, 20);
    // néon allumé = trait net + halo, réunis dans une seule image
    sprOn = document.createElement("canvas"); sprOn.width = sprGlow.width; sprOn.height = sprGlow.height; sprOn.half = sprGlow.half;
    { const c = sprOn.getContext("2d"), line = hexSprite(R, false, dpr, 1.8), o = (sprGlow.width - line.width) / 2;
      c.globalAlpha = .4; c.drawImage(sprGlow, 0, 0); c.globalAlpha = .8; c.drawImage(line, o, o); }
    sprOff = hexSprite(R, false, dpr, 1.2);
    const cx = W / 2, cy = H * .42;
    cells = [];
    for (let row = -1; row * h < H + R; row++)
      for (let col = -1; col * w < W + w; col++) {
        const x = col * w + (row % 2 ? w / 2 : 0), y = row * h;
        cells.push({ x, y, d: Math.hypot(x - cx, (y - cy) * 1.15), seed: Math.random() * 40 });
      }
    // ordre d'allumage : du centre vers l'extérieur, réparti sur toute la séquence
    const maxD = Math.max(...cells.map((c) => c.d));
    cells.forEach((c) => { c.at = .02 + Math.pow(c.d / maxD, .6) * .9 + (Math.random() - .5) * .06; });   // étalé sur la partie visible
    // grille éteinte dessinée une seule fois
    grid = document.createElement("canvas"); grid.width = cv.width; grid.height = cv.height;
    { const c = grid.getContext("2d"), so = sprOff.half; c.setTransform(dpr, 0, 0, dpr, 0, 0); c.globalAlpha = .08;
      for (const cell of cells) c.drawImage(sprOff, cell.x - so, cell.y - so, so * 2, so * 2); }
    cells.sort((a, b) => a.at - b.at);
    measure(); lastP = -1; draw(current());
  }
  function draw(p) {
    if (Math.abs(p - lastP) < .0015) return; lastP = p;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, cv.width, cv.height);
    g.drawImage(grid, 0, 0);                            // toute la grille éteinte, en une fois
    g.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
    const on = p / .5;                                 // tout le plafond est allumé à mi-parcours
    const sn = sprOn.half, sg = sprGlow.half;
    for (const c of cells) {                           // triés par ordre d'allumage
      const since = on - c.at;
      if (since <= 0) break;
      if (since < .035 && Math.sin(since * 900 + c.seed) < 0) continue;   // grésillement
      g.globalAlpha = 1; g.drawImage(sprOn, c.x - sn, c.y - sn, sn * 2, sn * 2);
      const flash = 1 - since / .12;
      if (flash > .02) { g.globalAlpha = flash * .7; g.drawImage(sprGlow, c.x - sg, c.y - sg, sg * 2, sg * 2); }
    }
    g.globalAlpha = 1;
  }
  const measure = () => { secTop = sec.offsetTop; secSpan = Math.max(1, sec.offsetHeight - innerHeight); };
  const current = () => Math.min(1, Math.max(0, (scrollY - secTop) / secSpan));
  // Mouvement lissé : la séquence glisse vers la position du défilement au lieu d'avancer par à-coups.
  let shown = -1, anim = 0;
  const step = () => {
    const target = current();
    shown = shown < 0 ? target : shown + (target - shown) * .2;
    if (Math.abs(target - shown) < .0015) shown = target;
    sec.style.setProperty("--p", shown.toFixed(4)); draw(shown);
    anim = shown !== target ? requestAnimationFrame(step) : 0;
  };
  const onScroll = () => {
    const target = current();
    if (target === shown && !anim) return;               // hors de la séquence : rien à faire
    if (!anim) anim = requestAnimationFrame(step);
  };
  if (reduced) { build(); draw(1); sec.style.setProperty("--p", "1"); return; }
  let rs = 0;
  addEventListener("resize", () => { clearTimeout(rs); rs = setTimeout(build, 150); });
  addEventListener("load", measure);
  addEventListener("scroll", onScroll, { passive: true });
  build(); onScroll();
})();

// ===================== Le travail : galerie horizontale pilotée par le défilement =====================
// La section se fige à l'écran et le défilement vertical fait avancer les photos de droite à gauche.
(() => {
  const sec = $("#realisations"), track = $("#hTrack"), bar = $("#hBar");
  if (!sec || !track || reduced) return;
  const works = [...track.querySelectorAll(".work")], imgs = works.map((w) => $("img, video", w));
  let dist = 0, top = 0, shown = -1, anim = 0, lastIdx = -1;

  const measure = () => {
    dist = Math.max(0, track.scrollWidth - innerWidth);
    sec.style.height = `${innerHeight + dist}px`;          // autant de défilement que de galerie
    top = sec.offsetTop;
    shown = -1; render(target());
  };
  const target = () => Math.min(1, Math.max(0, (scrollY - top) / Math.max(1, dist)));
  const render = (p) => {
    const x = -p * dist;
    track.style.transform = `translate3d(${x.toFixed(1)}px,0,0)`;
    bar.style.transform = `scaleX(${p.toFixed(4)})`;
    // léger décalage de chaque photo dans son cadre : effet de profondeur
    const mid = innerWidth / 2;
    let best = 0;
    works.forEach((w, i) => {
      const r = w.getBoundingClientRect(), c = r.left + r.width / 2, d = (c - mid) / innerWidth;
      imgs[i].style.transform = `translate3d(${(-d * 6).toFixed(2)}%,0,0)`;
      if (c < innerWidth * .62) best = i;                // photo « en cours » : la dernière passée au centre
    });
  };
  // mouvement lissé : la galerie glisse vers la position du défilement
  const step = () => {
    const t = target();
    shown = shown < 0 ? t : shown + (t - shown) * .16;
    if (Math.abs(t - shown) < .0008) shown = t;
    render(shown);
    anim = shown !== t ? requestAnimationFrame(step) : 0;
  };
  const onScroll = () => { if (!anim && target() !== shown) anim = requestAnimationFrame(step); };
  let rs = 0;
  addEventListener("resize", () => { clearTimeout(rs); rs = setTimeout(measure, 150); });
  addEventListener("load", measure);
  addEventListener("scroll", onScroll, { passive: true });
  measure();
})();

// ===================== Vidéos : lecture seulement quand elles sont à l'écran =====================
// Économise la batterie et le processeur ; aucune lecture automatique si l'appareil limite les animations.
(() => {
  const vids = $$("video");
  if (reduced) { vids.forEach((v) => { v.removeAttribute("autoplay"); v.pause(); v.controls = true; }); return; }
  const io = new IntersectionObserver((entries) => entries.forEach((en) => {
    const v = en.target;
    if (en.isIntersecting) { const p = v.play(); if (p) p.catch(() => {}); } else v.pause();
  }), { threshold: .15 });
  vids.forEach((v) => { v.muted = true; io.observe(v); });
})();

// ===================== Barre fixe mobile (Appeler / Réserver) =====================
const mbar = $("#mbar");
const phoneSec = $("#phone");
let phoneInView = false;
new IntersectionObserver(([en]) => { phoneInView = en.isIntersecting; toggleMbar(); }, { threshold: .15 }).observe(phoneSec);
let mbarOn = null;
function toggleMbar() {
  const on = scrollY > innerHeight * .6 && !phoneInView;
  if (on === mbarOn) return; mbarOn = on;
  mbar.classList.toggle("is-on", on);
  mbar.setAttribute("aria-hidden", String(!on));
  mbar.querySelectorAll("a").forEach((a) => (on ? a.removeAttribute("tabindex") : a.setAttribute("tabindex", "-1")));
}
scrollWork.push(toggleMbar);
