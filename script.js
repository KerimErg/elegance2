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


// ===================== Réservation =====================
// Les rendez-vous se prennent sur Planity (liens dans la page).
const today = new Date();

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
// En descendant, la vidéo plein écran rétrécit et se pose exactement sur la première bande
// des prestations, puis se fond dans sa photo ; les autres bandes et le titre arrivent ensuite.
(() => {
  const sec = $("#prestations"), strips = $$(".svc2__item"), root = document.documentElement;
  strips.forEach((st, k) => st.style.setProperty("--k", k));
  if (!sec || !strips.length) return;
  // transition réservée aux ordinateurs : sur téléphone, défilement simple et fiable
  // animation de passage retirée : défilement simple
  sec.classList.add("is-in", "is-head"); return;
  const slidesBox = $(".hero__slides"), media = $(".hero__media"), video = $("#heroVideo"), center = $(".hero__center"), cue = $(".hero__scroll"), mobile = !matchMedia("(min-width: 961px)").matches, first = mobile ? strips[0] : document.getElementById("svcMedia"), RAD = mobile ? 14 : 2;
  root.classList.add("flying");
  const clamp = (v) => Math.min(1, Math.max(0, v));
  const ease = (t) => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const lerp = (a, b, t) => a + (b - a) * t;
  let end = 1, land = null;
  const measure = () => {
    const r = first.getBoundingClientRect(), docTop = r.top + scrollY;
    const landTop = 72 + Math.max(0, (innerHeight - 72 - r.height) / 2);   // la bande arrive au centre de l'écran
    end = Math.max(innerHeight * .6, docTop - landTop);
    land = { left: r.left, right: r.right, top: docTop - end, bottom: docTop - end + r.height };
    shown = -1; render(target()); shown = target();
  };
  // progression amortie : la vidéo suit le défilement avec une légère inertie
  let shown = -1, raf = 0;
  const target = () => clamp(scrollY / end);
  const render = (p) => {
    const e = ease(p);
    center.style.opacity = Math.max(0, 1 - p * 4).toFixed(3);
    center.style.transform = `translate3d(0,${(-p * 160).toFixed(1)}px,0)`;
    cue.style.opacity = Math.max(0, 1 - p * 8).toFixed(3);
    if (p >= 1) {
      media.style.visibility = "hidden"; video.pause(); first.style.opacity = "";
      sec.classList.add("is-in", "is-head"); return;
    }
    media.style.visibility = ""; if (video.paused) { const pr = video.play(); if (pr) pr.catch(() => {}); }
    if (p < .97) sec.classList.remove("is-in"); else sec.classList.add("is-in");
    sec.classList.toggle("is-head", p > .9);
    const W = innerWidth, H = innerHeight, r = land;
    // rectangle visible : de l'écran entier à la bande
    const L = lerp(0, r.left, e), T = lerp(0, r.top, e), Rr = lerp(W, r.right, e), B = lerp(H, r.bottom, e);
    const sx = (Rr - L) / W, sy = (B - T) / H, s = Math.max(sx, sy);
    // tout en transformations (calculées par la carte graphique) : le cadre se déforme,
    // la vidéo à l'intérieur compense pour garder ses proportions
    media.style.transform = `translate3d(${L.toFixed(2)}px,${T.toFixed(2)}px,0) scale(${sx.toFixed(5)},${sy.toFixed(5)})`;
    media.style.borderRadius = `${(e * RAD / sx).toFixed(2)}px / ${(e * RAD / sy).toFixed(2)}px`;
    video.style.transform = `scale(${(s / sx).toFixed(5)},${(s / sy).toFixed(5)})`;
    if (slidesBox) slidesBox.style.transform = video.style.transform;
    media.style.setProperty("--grad", (1 - e).toFixed(3));
    const f = clamp((p - .86) / .12);
    media.style.opacity = (1 - f).toFixed(3);                       // fondu final dans la photo
    first.style.opacity = f.toFixed(3);
  };
  const step = () => {
    const t = target();
    shown = t;
    render(shown);
    raf = shown !== t ? requestAnimationFrame(step) : 0;
  };
  const update = () => { if (!raf && target() !== shown) raf = requestAnimationFrame(step); };

  // La page s'arrête toujours sur les prestations : en arrivant d'en haut, même en défilant vite,
  // on marque l'arrêt au moment où la vidéo s'est posée ; si l'on s'arrête en pleine transition,
  // le mouvement se termine tout seul (vers les prestations ou vers l'accueil).
  const goTo = (y) => {
    if (lenis) lenis.scrollTo(y, { duration: .9, lock: true, force: true, easing: (t) => 1 - Math.pow(1 - t, 3) });
    else scrollTo({ top: y, behavior: "smooth" });
  };
  let prevY = scrollY, dir = 0, idle = 0, snapping = false;
  const hold = () => {
    snapping = true;
    if (lenis) { lenis.stop(); setTimeout(() => { lenis.start(); snapping = false; }, 650); }
    else setTimeout(() => { snapping = false; }, 650);
  };
  scrollWork.push(() => {
    const y = scrollY;
    if (y !== prevY) dir = y > prevY ? 1 : -1;
    if (!mobile && !snapping && dir > 0 && prevY < end - 2 && y > end + 2) {
      // on a dépassé l'arrêt sur sa lancée : retour sur les prestations, puis courte pause
      goTo(end); hold();
    }
    prevY = y;
    clearTimeout(idle);
    if (!mobile && !snapping && y > 2 && y < end - 2) {
      idle = setTimeout(() => {
        const p = scrollY / end;
        if (p <= 0 || p >= 1) return;
        goTo(dir < 0 && p < .85 ? 0 : end);
      }, 160);
    }
  });
  scrollWork.push(update);
  addEventListener("resize", () => { clearTimeout(measure.t); measure.t = setTimeout(measure, 120); });
  addEventListener("load", measure);
  if (document.fonts) document.fonts.ready.then(measure);
  measure();
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

// ===================== Réalisations : carrousel en profondeur, continu =====================
// Chaque vidéo a une position continue (0 = au centre, ±1 = sur les côtés) : sous le doigt, tout glisse
// en douceur entre les états ; au lâcher, un ressort amorti ramène la vidéo la plus proche au centre.
(() => {
  const sec = document.getElementById("realisations"), cf = document.getElementById("cf"); if (!sec || !cf) return;
  const items = $$(".cf__item", cf), vids = items.map((it) => $("video", it)), titles = $$(".cf__title", sec), dotsBox = document.getElementById("cfDots"), n = items.length;
  items.forEach((it, k) => { it.style.backgroundImage = `url("${vids[k].poster}")`; });
  dotsBox.innerHTML = items.map((_, k) => `<button type="button" aria-label="Vidéo ${k + 1}"></button>`).join("");
  const dots = $$("button", dotsBox);
  cf.classList.add("is-js");
  const mobile = matchMedia("(max-width: 720px)").matches;
  const SIDE = mobile ? .84 : .78, SCALE = mobile ? .7 : .74, ROT = mobile ? 14 : 16;
  let pos = 0, vel = 0, target = 0, i = 0, visible = false, timer = 0, raf = 0, drag = null, settled = true;
  const wrap = (p) => { p = ((p % n) + n) % n; return p >= n / 2 ? p - n : p; };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const draw = () => {
    const w = items[0].offsetWidth;
    items.forEach((it, k) => {
      const p = wrap(k - pos), q = Math.abs(p), c = Math.min(q, 1), far = clamp(q - 1, 0, 1);
      const x = Math.sign(p) * (c * SIDE + far * .35) * w;
      const s = 1 - c * (1 - SCALE) - far * .14;
      const r = -clamp(p, -1, 1) * ROT;
      it.style.transform = `translate3d(calc(-50% + ${x.toFixed(1)}px), 0, 0) scale(${s.toFixed(4)}) rotateY(${r.toFixed(2)}deg)`;
      it.style.opacity = (1 - c * .38 - far * .62).toFixed(3);
      it.style.setProperty("--dim", (c * .45).toFixed(3));
      it.style.zIndex = String(10 - Math.round(q * 3));
    });
  };
  const setActive = (k) => {
    if (k === i && !settled) return;
    i = k;
    titles.forEach((t, j) => t.classList.toggle("is-on", j === i));
    dots.forEach((b, j) => b.classList.toggle("is-on", j === i));
    items.forEach((it, j) => it.dataset.d = String(Math.round(wrap(j - i))));
  };
  const playActive = () => {
    vids.forEach((v, j) => {
      if (j === i && visible && !reduced) { v.preload = "auto"; if (v.paused) { try { v.currentTime = 0; } catch (e) {} const pr = v.play(); if (pr) pr.catch(() => {}); } }
      else v.pause();
    });
    vids[(i + 1) % n].preload = "auto";
  };
  const schedule = () => { clearTimeout(timer); if (visible && !reduced && !drag) timer = setTimeout(() => go(target + 1), 4600); };
  const step = () => {
    raf = 0;
    if (!drag) {
      // ressort amorti : arrivée douce, sans rebond
      const k = 120, d = 2 * Math.sqrt(k) * .92, dt = 1 / 60;
      vel += (-(pos - target) * k - vel * d) * dt; pos += vel * dt;
      if (Math.abs(pos - target) < .0005 && Math.abs(vel) < .002) { pos = target; vel = 0; }
    }
    draw();
    const k = ((Math.round(pos) % n) + n) % n; if (k !== i) setActive(k);
    if (drag || pos !== target) { settled = false; raf = requestAnimationFrame(step); }
    else if (!settled) { settled = true; playActive(); schedule(); }
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(step); };
  const go = (t) => { target = t; settled = false; vids.forEach((v, j) => { if (j !== ((t % n) + n) % n) v.pause(); }); kick(); };
  const goIndex = (k) => { go(target + wrap(k - target)); };
  if (reduced) { items.forEach((it, k) => it.addEventListener("click", () => { pos = target = k; draw(); setActive(k); })); }
  items.forEach((it, k) => it.addEventListener("click", () => { if (Math.abs(wrap(k - pos)) > .5) goIndex(k); }));
  dots.forEach((b, k) => b.addEventListener("click", () => goIndex(k)));
  $$(".cf__arrow", sec).forEach((b) => b.addEventListener("click", () => go(target + Number(b.dataset.dir))));
  // glisser au doigt
  cf.addEventListener("touchstart", (e) => {
    const t = e.touches[0]; drag = { x: t.clientX, y: t.clientY, p: pos, lock: 0, lx: t.clientX, lt: performance.now(), v: 0 }; vel = 0; clearTimeout(timer);
  }, { passive: true });
  cf.addEventListener("touchmove", (e) => {
    if (!drag) return; const t = e.touches[0], dx = t.clientX - drag.x, dy = t.clientY - drag.y;
    if (!drag.lock) { if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return; drag.lock = Math.abs(dx) > Math.abs(dy) ? 1 : -1; }
    if (drag.lock < 0) return;
    const w = items[0].offsetWidth * SIDE, now = performance.now();
    drag.v = .8 * drag.v + .2 * ((t.clientX - drag.lx) / Math.max(1, now - drag.lt)); drag.lx = t.clientX; drag.lt = now;
    pos = drag.p - dx / w; kick();
  }, { passive: true });
  const end = () => {
    if (!drag) return; const d = drag; drag = null;
    if (d.lock > 0) {
      const w = items[0].offsetWidth * SIDE, flick = -d.v * 1000 / w * .18;   // un geste rapide fait avancer d'une vidéo
      target = Math.round(pos + clamp(flick, -1, 1)); if (target === Math.round(d.p) && Math.abs(pos - d.p) > .12) target = Math.round(d.p) + (pos > d.p ? 1 : -1);
      target = clamp(target, Math.round(d.p) - 1, Math.round(d.p) + 1); vel = -d.v * 1000 / w * .5;
    }
    settled = false; kick();
  };
  cf.addEventListener("touchend", end); cf.addEventListener("touchcancel", end);
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) { playActive(); schedule(); } else { clearTimeout(timer); vids.forEach((v) => v.pause()); } }, { threshold: .3 }).observe(cf);
  addEventListener("resize", draw);
  setActive(0); draw();
})();

// ===================== Prestations : la grande photo suit la prestation au centre de l'écran =====================
(() => {
  const media = document.getElementById("svcMedia"), list = $$(".svc2__item"); if (!media || !list.length) return;
  const pics = $$("img", media);
  let cur = 0;
  const set = (k) => {
    if (k === cur) return;
    pics.forEach((p, j) => { p.classList.toggle("was-on", j === cur); p.classList.toggle("is-on", j === k); });
    list.forEach((it, j) => it.classList.toggle("is-on", j === k));
    const prev = cur; cur = k;
    setTimeout(() => { if (cur !== prev) pics[prev].classList.remove("was-on"); }, 1200);
  };
  const io = new IntersectionObserver((en) => en.forEach((e) => { if (e.isIntersecting) set(Number(e.target.dataset.k)); }), { rootMargin: "-45% 0px -45% 0px" });
  list.forEach((it) => io.observe(it));
})();

// ===================== Apparitions à l'entrée dans l'écran =====================
// Seuls les éléments encore hors écran au chargement sont masqués : la page reste complète sans script.
if (!reduced && "IntersectionObserver" in window) {
  const io = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
  }), { threshold: .12, rootMargin: "0px 0px -6% 0px" });
  // titres : une lettre après l'autre
  $$(".t-big[data-reveal]").forEach((t) => {
    const txt = t.textContent; t.setAttribute("aria-label", txt);
    let k = 0;
    t.innerHTML = txt.split(" ").map((w) => `<span class="wd" aria-hidden="true">${[...w].map((c) => `<span class="ch" style="--c:${k++}">${c}</span>`).join("")}</span>`).join(" ");
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
const phoneSec = $("#reserver");
let phoneInView = false;
if (phoneSec) new IntersectionObserver(([en]) => { phoneInView = en.isIntersecting; toggleMbar(); }, { threshold: .15 }).observe(phoneSec);
let mbarOn = null;
function toggleMbar() {
  const on = scrollY > innerHeight * .6 && !phoneInView;
  if (on === mbarOn) return; mbarOn = on;
  mbar.classList.toggle("is-on", on);
  mbar.setAttribute("aria-hidden", String(!on));
  mbar.querySelectorAll("a").forEach((a) => (on ? a.removeAttribute("tabindex") : a.setAttribute("tabindex", "-1")));
}
scrollWork.push(toggleMbar);

// ===================== Vidéo d'accueil : lecture automatique bloquée =====================
// Certains téléphones (économie d'énergie, navigateurs intégrés aux applis) refusent la lecture
// automatique : on garde alors l'image fixe et on relance la vidéo au premier geste.
(() => {
  const v = document.getElementById("heroVideo"); if (!v || reduced) return;
  v.muted = true; v.defaultMuted = true; v.setAttribute("muted", ""); v.playsInline = true;
  const ok = () => v.classList.add("is-playing");
  const block = () => v.classList.remove("is-playing");
  const tryPlay = () => { const p = v.play(); if (p) p.then(ok).catch(block); };
  v.addEventListener("playing", ok);
  v.addEventListener("timeupdate", () => { if (v.currentTime > 0) ok(); });
  v.addEventListener("error", block);
  setTimeout(() => { if (v.paused || v.readyState < 2) tryPlay(); }, 1200);
  const kick = () => { if (v.paused) tryPlay(); };
  ["touchstart", "pointerdown", "scroll", "keydown"].forEach((ev) => addEventListener(ev, kick, { passive: true, once: true }));
  tryPlay();
})();

// ===================== Prestations sur téléphone : flèches du carrousel =====================
(() => {
  const box = $("#strips"), nav = $(".strips-nav"); if (!box || !nav) return;
  $$("button", nav).forEach((b) => b.addEventListener("click", () => {
    const card = $(".strip", box); const step = card ? card.getBoundingClientRect().width + 14 : box.clientWidth * .8;
    box.scrollBy({ left: step * Number(b.dataset.dir), behavior: "smooth" });
  }));
})();

// ===================== Avis : une citation à la fois, défilement automatique =====================
(() => {
  const grid = document.getElementById("avisGrid"), dots = document.getElementById("avisDots"); if (!grid || !dots) return;
  const items = $$(".avis__item", grid); if (!items.length) return;
  dots.innerHTML = items.map((_, k) => `<button type="button" aria-label="Avis ${k + 1}"></button>`).join("");
  const btns = $$("button", dots);
  let i = 0, t = 0, visible = false;
  const go = (k) => {
    i = (k + items.length) % items.length;
    items.forEach((el, j) => el.classList.toggle("is-on", j === i));
    btns.forEach((b, j) => b.classList.toggle("is-on", j === i));
    clearTimeout(t); if (visible && !reduced) t = setTimeout(() => go(i + 1), 6000);
  };
  btns.forEach((b, k) => b.addEventListener("click", () => go(k)));
  let x0 = null;
  grid.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  grid.addEventListener("touchend", (e) => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) go(i + (dx < 0 ? 1 : -1)); x0 = null; });
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; go(i); }, { threshold: .3 }).observe(grid);
  go(0);
})();

// ===================== Chiffres qui comptent jusqu'à leur valeur =====================
(() => {
  const els = $$("[data-count]"); if (!els.length || reduced || !("IntersectionObserver" in window)) return;
  const io = new IntersectionObserver((en) => en.forEach((e) => {
    if (!e.isIntersecting) return; io.unobserve(e.target);
    const el = e.target, to = parseFloat(el.dataset.count), dec = Number(el.dataset.dec || 0), t0 = performance.now(), dur = 1600;
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / dur), v = to * (1 - Math.pow(1 - p, 4));
      el.textContent = v.toFixed(dec).replace(".", ",");
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }), { threshold: .6 });
  els.forEach((el) => { el.textContent = (0).toFixed(Number(el.dataset.dec || 0)).replace(".", ","); io.observe(el); });
})();

// ===================== Prestations sur téléphone : la carte au centre ressort =====================
(() => {
  const box = document.getElementById("strips"); if (!box || reduced) return;
  const mq = matchMedia("(max-width: 720px)");
  const cards = $$(".strip", box);
  let raf = 0;
  const update = () => {
    raf = 0; if (!mq.matches) { box.classList.remove("is-live"); return; }
    box.classList.add("is-live");
    const mid = box.getBoundingClientRect().left + box.clientWidth / 2;
    let best = 0, bd = Infinity;
    cards.forEach((c, k) => { const r = c.getBoundingClientRect(), d = Math.abs(r.left + r.width / 2 - mid); if (d < bd) { bd = d; best = k; } });
    cards.forEach((c, k) => c.classList.toggle("is-center", k === best));
  };
  box.addEventListener("scroll", () => { if (!raf) raf = requestAnimationFrame(update); }, { passive: true });
  addEventListener("resize", update); update();
})();

// ===================== Profondeur : la photo du salon glisse dans son cadre =====================
(() => {
  if (reduced) return;
  const els = $$(".salon__photo"); if (!els.length) return;
  let raf = 0;
  const upd = () => {
    raf = 0;
    els.forEach((el) => {
      const r = el.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return;
      const p = (r.top + r.height / 2 - innerHeight / 2) / innerHeight;   // -1 … 1
      el.style.setProperty("--py", `${(p * -40).toFixed(1)}px`);
    });
  };
  addEventListener("scroll", () => { if (!raf) raf = requestAnimationFrame(upd); }, { passive: true });
  upd();
})();

// ===================== Avis : étoiles une à une =====================
$$(".avis__stars").forEach((s) => { s.innerHTML = [...s.textContent.trim()].map((c, k) => `<span class="st" style="--s:${k}">${c}</span>`).join(""); });

// ===================== Téléphone : les cartes des prestations apparaissent en douceur =====================
(() => {
  const list = document.getElementById("svcList");
  if (!list || reduced || !matchMedia("(max-width: 720px)").matches || !("IntersectionObserver" in window)) return;
  if (list.getBoundingClientRect().top < innerHeight * .9) return;
  [...list.children].forEach((it, k) => it.style.setProperty("--k", k));
  list.classList.add("lt");
  const io = new IntersectionObserver(([en]) => { if (en.isIntersecting) { list.classList.add("in"); io.disconnect(); } }, { threshold: .15 });
  io.observe(list);
})();

// ===================== Téléphone : les blocs montent au rythme du doigt =====================
// Remplace les apparitions ponctuelles : on voit l'effet à chaque défilement, dans les deux sens.
(() => {
  if (reduced || !matchMedia("(max-width: 720px)").matches) return;
  const sel = "#svcList, .cf, .cf__titles, .cf__nav, .avis__score, .avis__grid, .avis__dots, .planity__lead, .planity__steps, .planity__btn, .planity__alt, .salon__photo, .salon__facts, .salon__map, .salon__actions, .footer__inner";
  const els = $$(sel);
  if (!els.length) return;
  const off = (el) => el.classList.toggle("rv", false);
  const list = document.getElementById("svcList"); if (list) list.classList.toggle("lt", false);
  els.forEach((el) => { off(el); $$(".rv", el).forEach((c) => { if (!c.classList.contains("t-big")) off(c); }); el.classList.add("sl"); });
  const clamp = (v) => Math.min(1, Math.max(0, v)), ease = (t) => 1 - Math.pow(1 - t, 3);
  let raf = 0;
  const upd = () => {
    raf = 0; const H = innerHeight;
    els.forEach((el) => {
      const r = el.getBoundingClientRect(), top = r.top - (parseFloat(el.style.getPropertyValue("--sy")) || 0);
      if (top > H * 1.2 || r.bottom < -H * .2) return;
      const e = ease(clamp((H - top) / (H * .6)));
      el.style.setProperty("--sy", `${((1 - e) * 120).toFixed(1)}px`);
      el.style.setProperty("--ss", (.88 + e * .12).toFixed(4));
      el.style.setProperty("--so", Math.min(1, e * 1.15).toFixed(3));
    });
  };
  addEventListener("scroll", () => { if (!raf) raf = requestAnimationFrame(upd); }, { passive: true });
  addEventListener("resize", upd); upd();
})();

// ===================== Carte Google : chargée seulement si le visiteur le demande =====================
// Google Maps dépose des cookies : on attend l'accord du visiteur (gardé sur cet appareil).
(() => {
  const box = document.querySelector(".salon__map"), btn = document.getElementById("mapShow"); if (!box || !btn) return;
  const KEY = "elegance-carte-ok";
  const show = () => {
    if (box.classList.contains("is-live")) return;
    const f = document.createElement("iframe");
    f.title = "Plan d’accès : Elegance Strasbourg, 162 route de Bischwiller, Schiltigheim";
    f.src = "https://www.google.com/maps?q=Elegance+Strasbourg,+162+Route+de+Bischwiller,+67300+Schiltigheim&z=16&output=embed";
    f.referrerPolicy = "no-referrer-when-downgrade";
    box.appendChild(f); box.classList.add("is-live");
  };
  btn.addEventListener("click", () => { try { localStorage.setItem(KEY, "1"); } catch (e) {} show(); });
  try { if (localStorage.getItem(KEY) === "1") show(); } catch (e) {}
})();
