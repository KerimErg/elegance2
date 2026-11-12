// ===================== Données du salon (à adapter) =====================
// Prestations, horaires et clés Supabase : voir config.js
const CFG = window.ELEGANCE;
const SERVICES = CFG.services, OPEN = CFG.open, SLOT_TIMES = CFG.slots;

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const pad = (n) => String(n).padStart(2, "0");
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

// ===================== Défilement adouci =====================
// Molette et pavé tactile glissent en douceur ; le toucher reste natif sur téléphone.
const lenis = (!reduced && window.Lenis) ? new window.Lenis({ lerp: .085, wheelMultiplier: .9 }) : null;
if (lenis) {
  const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
  requestAnimationFrame(raf);
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="#"]'); if (!a) return;
    const id = a.getAttribute("href"), el = id.length > 1 && document.querySelector(id); if (!el) return;
    e.preventDefault(); lenis.scrollTo(el, { offset: id === "#accueil" ? 0 : -70, duration: 1.4 });
  });
}

// ===================== Header, menu, lien actif =====================
// Un seul calcul par image affichée ; positions des sections mesurées une fois (et au redimensionnement).
const header = $("#header"), nav = $("#nav"), burger = $("#burger");
const navLinks = $$(".nav a:not(.nav__cta)");
const NAV_SECS = ["accueil", "prestations", "realisations", "avis", "reserver", "salon"];
let navTops = [], scrollTick = false, lastSolid = null, lastActive = null;
const measureNav = () => { navTops = NAV_SECS.map((id) => { const s = document.getElementById(id); return s ? s.getBoundingClientRect().top + scrollY : Infinity; }); };
const scrollWork = [];                       // autres tâches liées au défilement (barre mobile…)
const onScroll = () => {
  scrollTick = false;
  const solid = scrollY > 30;
  if (solid !== lastSolid) { header.classList.toggle("is-solid", solid); lastSolid = solid; }
  const y = scrollY + innerHeight * .4;
  let active = 0;
  navTops.forEach((top, i) => { if (top <= y) active = i; });
  if (active !== lastActive) { navLinks.forEach((a) => a.classList.toggle("is-active", a.getAttribute("href") === "#" + NAV_SECS[active])); lastActive = active; }
  scrollWork.forEach((fn) => fn());
};
addEventListener("scroll", () => { if (!scrollTick) { scrollTick = true; requestAnimationFrame(onScroll); } }, { passive: true });
addEventListener("resize", () => { measureNav(); onScroll(); });
addEventListener("load", () => { measureNav(); onScroll(); });
measureNav(); onScroll();
const setMenu = (open) => {
  nav.classList.toggle("is-open", open);
  burger.setAttribute("aria-expanded", open);
  document.body.style.overflow = open ? "hidden" : ""; if (lenis) open ? lenis.stop() : lenis.start();
};
burger.addEventListener("click", () => setMenu(!nav.classList.contains("is-open")));
nav.addEventListener("click", (e) => { if (e.target.closest("a")) setMenu(false); });
addEventListener("keydown", (e) => { if (e.key === "Escape") setMenu(false); });

// ===================== Bannière : logo =====================
// Lettres du nom découpées pour l'apparition une à une
const word = $(".hero__word");
word.setAttribute("data-text", word.textContent);
word.innerHTML = [...word.textContent].map((ch, i) => `<span style="--i:${i}">${ch}</span>`).join("");
$(".hero__title").setAttribute("aria-label", "Elegance Strasbourg");


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
    + BARBERS.map((b) => chip("barber", b.id, `<span class="av" aria-hidden="true">${b.name.slice(0, 2)}</span>`, b.name)).join("");
  $("#pDate").innerHTML = days.map((d) => chip("date", d, `${fmtDay(d)} ${fromIso(d).getDate()}`, book.blocked.has(d) ? "fermé" : !dayHasSlot(d) ? "complet" : "", !dayHasSlot(d))).join("");
  if (book.time && !slotFree(book.date, book.time)) book.time = null;
  $("#pSlots").innerHTML = SLOT_TIMES.map((t) => {
    const off = !slotFree(book.date, t);
    return `<button type="button" class="slot${book.time === t ? " is-on" : ""}" data-t="${t}" ${off ? "disabled" : ""}>${t}</button>`;
  }).join("");
  const s = SERVICES.find((x) => x.id === book.service);
  el.next.disabled = !book.time;
  el.next.textContent = book.time ? `Continuer · ${s.name} · ${book.time}` : "Choisissez un créneau";
  updateRecap(s);
}
function updateRecap(s) {
  const set = (id, txt, empty) => { const e = document.getElementById(id); if (!e) return; e.textContent = txt; e.classList.toggle("is-empty", !!empty); };
  set("rcService", s.name);
  set("rcBarber", book.barber === "any" ? "Premier disponible" : barberName(book.barber));
  set("rcDate", book.date ? fmtLong(book.date).replace(/^./, (c) => c.toUpperCase()) : "—", !book.date);
  set("rcTime", book.time || "À choisir", !book.time);
  set("rcPrice", `${s.price} €`);
}

// Sur téléphone, garder le haut du panneau à l'écran quand on change d'étape
function keepPanelInView() {
  if (innerWidth > 720) return;
  const r = $("#phone").getBoundingClientRect();
  if (r.top < 60 || r.top > innerHeight * .5) scrollTo({ top: scrollY + r.top - 84, behavior: reduced ? "auto" : "smooth" });
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
  show("form"); keepPanelInView();
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
    show("done"); keepPanelInView();
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

// ===================== L'équipe =====================
if ($("#team")) $("#team").innerHTML = BARBERS.map((b) => `
  <li data-reveal><a href="#reserver" data-pick-barber="${b.id}">
    <span class="crew__photo">${b.photo ? `<img src="${b.photo}" alt="${b.name}, barbier" loading="lazy" decoding="async">` : `<span class="crew__mono" aria-hidden="true">${b.name.slice(0, 2)}</span>`}</span>
    <span class="crew__name">${b.name}</span>
    ${b.specialty ? `<span class="crew__spec">${b.specialty}</span>` : ""}
    <span class="crew__go">Réserver<span class="sr-only"> avec ${b.name}</span> →</span>
  </a></li>`).join("");

// Choix d'un barbier ou d'une prestation depuis la page : le module de réservation suit
document.addEventListener("click", (e) => {
  const a = e.target.closest("[data-pick-barber], [data-pick-service]"); if (!a) return;
  if (a.dataset.pickBarber) book.barber = a.dataset.pickBarber;
  if (a.dataset.pickService) book.service = a.dataset.pickService;
  book.time = null; show("pick"); renderPick();
});

// ===================== Prestations : bandes qui s'ouvrent =====================
(() => {
  const strips = $$("#strips .strip"); if (!strips.length) return;
  const fine = matchMedia("(hover: hover) and (pointer: fine)");
  const open = (st) => strips.forEach((x) => x.classList.toggle("is-on", x === st));
  strips.forEach((st) => {
    st.addEventListener("mouseenter", () => { if (fine.matches) open(st); });
    st.addEventListener("click", (e) => { if (!e.target.closest("a")) open(st); });
    st.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && e.target === st) { e.preventDefault(); open(st); } });
  });
})();

// ===================== Passage accueil -> prestations =====================
(() => {
  const sec = $("#prestations"), strips = $$("#strips .strip");
  strips.forEach((st, k) => st.style.setProperty("--k", k));
  if (!sec) return;
  if (reduced || !("IntersectionObserver" in window)) { sec.classList.add("is-in"); return; }
  const io = new IntersectionObserver(([en]) => { if (en.isIntersecting) { sec.classList.add("is-in"); io.disconnect(); } }, { threshold: .35 });
  io.observe(sec);
  // l'accueil reste fixé, se resserre en carte arrondie et s'assombrit pendant que les prestations montent
  const media = $(".hero__media"), center = $(".hero__center"), cue = $(".hero__scroll"), shade = $("#heroShade");
  let last = -1;
  scrollWork.push(() => {
    const p = Math.min(1.3, Math.max(0, scrollY / innerHeight));
    if (Math.abs(p - last) < .001) return; last = p;
    const q = Math.min(1, p / .9), e = q * q * (3 - 2 * q);   // départ et arrivée en douceur
    media.style.transform = `translate3d(0,${(-e * 3).toFixed(2)}vh,0) scale(${(1 - e * .38).toFixed(4)})`;
    media.style.borderRadius = `${(e * 36).toFixed(1)}px`;
    center.style.opacity = Math.max(0, 1 - p * 1.8).toFixed(3);
    center.style.transform = `translate3d(0,${(-p * 90).toFixed(1)}px,0) scale(${(1 - Math.min(p, 1) * .08).toFixed(4)})`;
    cue.style.opacity = Math.max(0, 1 - p * 4).toFixed(3);
    shade.style.opacity = (e * .55).toFixed(3);
  });
})();

// ===================== Repères de section (droite) =====================
(() => {
  const rail = $("#rail"), secs = $$("[data-rail]"); if (!rail || !secs.length) return;
  rail.innerHTML = secs.map((s) => `<a href="#${s.id}"><span>${s.dataset.rail}</span><i></i></a>`).join("");
  const dots = $$("a", rail);
  let tops = [], last = -1;
  const measure = () => { tops = secs.map((s) => s.offsetTop); };
  const update = () => {
    const y = scrollY + innerHeight * .45; let k = 0;
    tops.forEach((t, i) => { if (t <= y) k = i; });
    if (k !== last) { dots.forEach((d, i) => d.classList.toggle("is-on", i === k)); last = k; }
  };
  measure(); update();
  addEventListener("resize", () => { measure(); update(); });
  addEventListener("load", () => { measure(); update(); });
  scrollWork.push(update);
})();

// ===================== Le travail : vitrine vidéo =====================
// Chapitres avec barre de progression ; la vidéo suivante se dévoile de bas en haut.
(() => {
  const sec = $("#realisations"); if (!sec) return;
  const vids = $$(".show__main video", sec), items = $$(".show__item", sec), chaps = $$(".show__chap", sec), n = vids.length;
  const DUR = 2800;
  sec.style.setProperty("--dur", DUR + "ms");
  let i = 0, visible = false, timer = 0, left = DUR, started = 0;
  const play = () => vids.forEach((v, k) => { if (k === i && visible && !reduced) { const p = v.play(); if (p) p.catch(() => {}); } else if (!v.classList.contains("is-prev")) v.pause(); });
  const go = (k) => {
    if (k === i) return;
    const prev = i; i = (k + n) % n;
    vids.forEach((v, j) => { v.classList.toggle("is-prev", j === prev); v.classList.remove("is-on"); });
    void vids[i].offsetWidth;                          // relance l'animation d'entrée
    vids[i].classList.add("is-on");
    try { vids[i].currentTime = 0; } catch (e) {}
    setTimeout(() => { vids[prev].classList.remove("is-prev"); vids[prev].pause(); }, 700);
    items.forEach((el, j) => el.classList.toggle("is-on", j === i));
    chaps.forEach((c, j) => { c.classList.remove("is-on"); if (j === i) { void c.offsetWidth; c.classList.add("is-on"); } });
    vids[(i + 1) % n].preload = "auto";
    play(); left = DUR; arm();
  };
  const arm = () => {
    clearTimeout(timer);
    if (visible && !reduced) { started = Date.now(); timer = setTimeout(() => go(i + 1), left); }
  };
  chaps.forEach((c) => c.addEventListener("click", () => go(Number(c.dataset.k))));
  new IntersectionObserver(([en]) => {
    const was = visible; visible = en.isIntersecting;
    sec.classList.toggle("is-paused", !visible);
    if (visible) { vids[(i + 1) % n].preload = "auto"; arm(); }
    else if (was) { clearTimeout(timer); left = Math.max(400, left - (Date.now() - started)); }
    play();
  }, { threshold: .25 }).observe(sec);
})();

// ===================== Apparitions à l'entrée dans l'écran =====================
// Seuls les éléments encore hors écran au chargement sont masqués : la page reste complète sans script.
if (!reduced && "IntersectionObserver" in window) {
  const io = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
  }), { threshold: .12, rootMargin: "0px 0px -6% 0px" });
  $$(".t-big[data-reveal]").forEach((t) => {
    t.innerHTML = t.innerHTML.split(/<br\s*\/?>/i).map((l, k) => `<span class="ln"><span style="--li:${k}">${l}</span></span>`).join("");
  });
  const groups = new Map();
  $$("[data-reveal]").forEach((el) => {
    if (el.getBoundingClientRect().top < innerHeight) return;
    const parent = el.parentElement, n = groups.get(parent) || 0;
    groups.set(parent, n + 1);
    el.style.setProperty("--rd", `${Math.min(n, 6) * 0.08}s`);
    el.classList.add("rv"); io.observe(el);
  });
}

// ===================== Bannière : vidéo adaptée à l'écran =====================
// Ordinateur : version horizontale plein écran ; téléphone : version verticale pleine résolution.
(() => {
  const v = $("#heroVideo"); if (!v) return;
  const size = matchMedia("(min-width: 961px)").matches ? "large" : "small";
  v.poster = v.dataset["poster" + (size === "large" ? "Large" : "Small")];
  v.src = v.dataset["src" + (size === "large" ? "Large" : "Small")];
})();

// ===================== Vidéos : lecture seulement quand elles sont à l'écran =====================
// Économise la batterie et le processeur ; aucune lecture automatique si l'appareil limite les animations.
(() => {
  const vids = $$("video:not([data-managed])");
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

// ===================== Curseur sur mesure et boutons aimantés (souris uniquement) =====================
(() => {
  const c = document.getElementById("cursor");
  if (!c || reduced || !matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  document.documentElement.classList.add("has-cursor");
  const ring = $(".cursor__ring", c), dot = $(".cursor__dot", c), label = $(".cursor__label", c);
  let x = innerWidth / 2, y = innerHeight / 2, rx = x, ry = y, raf = 0;
  const loop = () => {
    rx += (x - rx) * .16; ry += (y - ry) * .16;
    ring.style.transform = `translate3d(${rx.toFixed(1)}px,${ry.toFixed(1)}px,0)`;
    raf = Math.abs(x - rx) + Math.abs(y - ry) > .3 ? requestAnimationFrame(loop) : 0;
  };
  addEventListener("pointermove", (e) => {
    x = e.clientX; y = e.clientY;
    dot.style.transform = `translate3d(${x}px,${y}px,0)`;
    c.classList.remove("is-hidden");
    if (!raf) raf = requestAnimationFrame(loop);
  }, { passive: true });
  document.addEventListener("pointerleave", () => c.classList.add("is-hidden"));
  document.addEventListener("pointerover", (e) => {
    const t = e.target;
    const zone = t.closest("[data-cursor]"), link = t.closest("a, button, .strip");
    const field = t.closest("input, select, textarea");
    const lab = link && link.closest(".strip.is-on") && link.matches("a") ? "Réserver" : (zone && !(link && !link.matches(".strip")) ? zone.dataset.cursor : "");
    c.classList.toggle("is-label", !!lab && !field);
    c.classList.toggle("is-link", !lab && !!link && !field);
    c.classList.toggle("is-hidden", !!field);
    if (lab) label.textContent = lab;
  });
  // boutons aimantés
  $$(".btn, .header__cta").forEach((b) => {
    b.addEventListener("pointermove", (e) => {
      const r = b.getBoundingClientRect();
      b.style.transform = `translate(${((e.clientX - r.left - r.width / 2) * .22).toFixed(1)}px, ${((e.clientY - r.top - r.height / 2) * .3).toFixed(1)}px)`;
    });
    b.addEventListener("pointerleave", () => { b.style.transform = ""; });
  });
})();

// ===================== Grandes images : dévoilement depuis le centre =====================
(() => {
  const els = $$(".strips, .show__main");
  if (reduced || !("IntersectionObserver" in window)) return;
  const io = new IntersectionObserver((en) => en.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-unveiled"); io.unobserve(e.target); } }), { threshold: .2 });
  els.forEach((el) => { if (el.getBoundingClientRect().top > innerHeight * .8) { el.classList.add("unveil"); io.observe(el); } });
})();
