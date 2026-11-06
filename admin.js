// =====================================================================
//  Page admin : connexion, rendez-vous, annulation, jours fermés.
//  La sécurité est assurée par la base (règles RLS dans supabase/schema.sql) :
//  sans compte admin, aucune donnée client n'est lisible.
// =====================================================================
const CFG = window.ELEGANCE;
const $ = (s) => document.querySelector(s);
const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromIso = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const fmtLong = (s) => fromIso(s).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

const views = { setup: $("#viewSetup"), login: $("#viewLogin"), dash: $("#viewDash") };
const show = (name) => Object.entries(views).forEach(([k, v]) => (v.hidden = k !== name));

if (!CFG.supabaseUrl || !CFG.supabaseAnonKey || !window.supabase) {
  show("setup");
} else {
  const db = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey);
  const state = { range: "upcoming", showCancelled: false, appts: [], blocked: [], confirming: null, timer: null, selected: null, query: "" };

  // ---------- Connexion ----------
  async function enter(session) {
    if (!session) { $("#userBox").hidden = true; show("login"); return; }
    const { data: ok, error } = await db.rpc("is_admin");
    if (error || !ok) {
      $("#loginMsg").textContent = "Ce compte n’a pas l’accès au salon. Demandez à l’administrateur de l’ajouter.";
      await db.auth.signOut(); show("login"); return;
    }
    $("#userEmail").textContent = session.user.email;
    $("#userBox").hidden = false;
    show("dash");
    await refresh();
    clearInterval(state.timer);
    state.timer = setInterval(refresh, 60000);
  }

  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("#loginBtn"); btn.disabled = true; btn.textContent = "Connexion…"; $("#loginMsg").textContent = "";
    const { data, error } = await db.auth.signInWithPassword({ email: $("#lEmail").value.trim(), password: $("#lPass").value });
    btn.disabled = false; btn.textContent = "Se connecter";
    if (error) { $("#loginMsg").textContent = "E-mail ou mot de passe incorrect."; return; }
    enter(data.session);
  });
  $("#logout").addEventListener("click", async () => { clearInterval(state.timer); await db.auth.signOut(); enter(null); });

  // ---------- Données ----------
  async function refresh() {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const [from, to] = state.range === "upcoming" ? [today, addDays(today, 60)] : [addDays(today, -30), addDays(today, -1)];
    const [a, b, w] = await Promise.all([
      db.from("appointments").select("*").gte("day", iso(from)).lte("day", iso(to)).order("day").order("slot"),
      db.from("blocked_days").select("*").gte("day", iso(today)).order("day"),
      db.from("appointments").select("day, price").eq("status", "confirmed").gte("day", iso(today)).lte("day", iso(addDays(today, 6))),
    ]);
    if (a.error || b.error || w.error) {
      $("#dashSub").textContent = "Impossible de charger les rendez-vous. Vérifiez votre connexion puis rechargez la page.";
      return;
    }
    $("#dashSub").textContent = `Mis à jour à ${new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} · actualisation automatique toutes les minutes.`;
    state.appts = a.data; state.blocked = b.data;
    const week = w.data;
    $("#sToday").textContent = week.filter((r) => r.day === iso(today)).length;
    $("#sWeek").textContent = week.length;
    $("#sRevenue").textContent = `${week.reduce((s, r) => s + (r.price || 0), 0)} €`;
    renderAgenda(from, to); renderBlocked();
  }

  // ---------- Agenda : un jour à la fois (taille de page constante) ----------
  const DOW = ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"];
  const telOf = (r) => (r.client_phone || "").replace(/[^0-9+]/g, "");

  function renderAgenda(from, to) {
    const todayIso = iso(new Date());
    const blocked = new Map(state.blocked.map((b) => [b.day, b.reason]));
    const list = state.appts.filter((r) => state.showCancelled || r.status === "confirmed");
    const days = [];
    for (let d = new Date(from); d <= to; d = addDays(d, 1)) days.push(iso(d));
    if (state.range === "past") days.reverse();
    const countOf = (day) => list.filter((r) => r.day === day && r.status === "confirmed").length;

    if (!state.selected || !days.includes(state.selected)) {
      state.selected = state.range === "upcoming"
        ? (countOf(todayIso) ? todayIso : days.find((d) => countOf(d)) || todayIso)
        : days.find((d) => countOf(d)) || days[0];
    }

    // Bandeau de dates
    $("#strip").innerHTML = days.map((day) => {
      const dt = fromIso(day), n = countOf(day);
      const closed = blocked.has(day) || !CFG.open[dt.getDay()];
      return `<button class="a-chip${day === state.selected ? " is-on" : ""}${closed ? " is-closed" : ""}${day === todayIso ? " is-today" : ""}" data-day="${day}" aria-pressed="${day === state.selected}">
        <small>${DOW[dt.getDay()]}</small><b>${dt.getDate()}</b><em>${closed && !n ? "fermé" : n ? n + " rdv" : "–"}</em></button>`;
    }).join("");
    $(`#strip [data-day="${state.selected}"]`)?.scrollIntoView({ block: "nearest", inline: "center" });

    // Recherche : remplace la vue du jour
    const q = state.query.trim().toLowerCase();
    if (q) {
      const digits = q.replace(/\D/g, "");
      const hits = state.appts.filter((r) => (state.showCancelled || r.status === "confirmed") && (
        r.client_name.toLowerCase().includes(q) || (r.client_email || "").toLowerCase().includes(q) || (digits.length >= 3 && telOf(r).includes(digits))));
      $("#agenda").innerHTML = `<div class="a-dayhead"><b>${hits.length} résultat${hits.length > 1 ? "s" : ""}</b><span>pour « ${esc(state.query.trim())} »</span></div>`
        + (hits.map((r) => apptRow(r, true)).join("") || `<p class="a-empty">Aucun client trouvé sur cette période.</p>`);
      return;
    }

    // Planning du jour sélectionné : une ligne par créneau
    const day = state.selected, dt = fromIso(day);
    const items = list.filter((r) => r.day === day);
    const confirmed = items.filter((r) => r.status === "confirmed");
    const last = CFG.open[dt.getDay()];
    const closed = blocked.has(day) || !last;
    const slots = closed ? [] : CFG.slots.filter((t) => t <= last);
    const extra = items.filter((r) => !slots.includes(String(r.slot).slice(0, 5)));
    const revenue = confirmed.reduce((s, r) => s + (r.price || 0), 0);
    $("#agenda").innerHTML = `<div class="a-dayhead${day === todayIso ? " is-today" : ""}"><b>${fmtLong(day)}</b>
        <span>${closed ? "Salon fermé" + (blocked.get(day) ? " · " + esc(blocked.get(day)) : "") : `${confirmed.length} rdv · ${slots.length - confirmed.filter((r) => slots.includes(String(r.slot).slice(0, 5))).length} libres · ${revenue} €`}</span></div>`
      + slots.map((t) => {
          const here = items.filter((r) => String(r.slot).slice(0, 5) === t);
          return here.length ? here.map((r) => apptRow(r)).join("") : `<div class="a-appt is-free"><span class="a-time">${t}</span><span class="a-freelabel">Libre</span><button class="a-add" data-add="${t}">+ Ajouter</button></div>`;
        }).join("")
      + extra.map((r) => apptRow(r)).join("")
      + (closed && !items.length ? `<p class="a-empty">Aucun rendez-vous ce jour-là.</p>` : "");
  }

  function apptRow(r, withDay) {
    const cancelled = r.status === "cancelled";
    const confirming = state.confirming === r.id;
    const actions = cancelled
      ? `<button class="a-btn" data-act="restore" data-id="${r.id}">Rétablir</button>`
      : confirming
        ? `<button class="a-btn a-btn--danger" data-act="cancel" data-id="${r.id}">Confirmer</button><button class="a-btn" data-act="keep" data-id="${r.id}">Garder</button>`
        : `<button class="a-btn" data-act="ask" data-id="${r.id}">Annuler</button>`;
    return `<article class="a-appt${cancelled ? " is-cancelled" : ""}">
      <span class="a-time">${withDay ? `<small>${esc(fromIso(r.day).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }))}</small>` : ""}${esc(String(r.slot).slice(0, 5))}</span>
      <div class="a-who">
        <strong>${esc(r.client_name)}</strong>${cancelled ? '<span class="a-badge">Annulé</span>' : ""}
        <span class="a-meta">${esc(r.service)}${r.price ? " · " + esc(r.price) + " €" : ""}</span>
        <span class="a-meta">${r.client_phone ? `<a href="tel:${esc(telOf(r))}">${esc(r.client_phone)}</a>` : "sans téléphone"}${r.client_email ? ` · <a href="mailto:${esc(r.client_email)}">${esc(r.client_email)}</a>` : ""}</span>
      </div>
      <div class="a-actions">${actions}</div>
    </article>`;
  }

  $("#strip").addEventListener("click", (e) => {
    const c = e.target.closest("[data-day]"); if (!c) return;
    state.selected = c.dataset.day; state.confirming = null; refreshView();
  });
  document.querySelectorAll("[data-scroll]").forEach((b) => b.addEventListener("click", () =>
    $("#strip").scrollBy({ left: +b.dataset.scroll * $("#strip").clientWidth * .8, behavior: "smooth" })));
  $("#search").addEventListener("input", (e) => { state.query = e.target.value; refreshView(); });

  $("#agenda").addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-act]"); if (!btn) return;
    const { act, id } = btn.dataset;
    if (act === "ask") { state.confirming = id; return refreshView(); }
    if (act === "keep") { state.confirming = null; return refreshView(); }
    btn.disabled = true;
    if (act === "restore") {
      const { error } = await db.from("appointments").update({ status: "confirmed" }).eq("id", id);
      if (error) { alertRow(btn, error.code === "23505" ? "Ce créneau a été repris par un autre client." : "Échec, réessayez."); return; }
    } else if (act === "cancel") {
      const { error } = await db.from("appointments").update({ status: "cancelled" }).eq("id", id);
      if (error) { alertRow(btn, "Échec, réessayez."); return; }
    }
    state.confirming = null;
    refresh();
  });
  const alertRow = (btn, msg) => { btn.disabled = false; btn.textContent = msg; };
  const refreshView = () => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const [from, to] = state.range === "upcoming" ? [today, addDays(today, 60)] : [addDays(today, -30), addDays(today, -1)];
    renderAgenda(from, to);
  };

  document.querySelectorAll(".a-tab").forEach((t) => t.addEventListener("click", () => {
    state.range = t.dataset.range; state.selected = null;
    document.querySelectorAll(".a-tab").forEach((x) => x.setAttribute("aria-pressed", x === t));
    refresh();
  }));
  $("#showCancelled").addEventListener("change", (e) => { state.showCancelled = e.target.checked; refreshView(); });

  // ---------- Jours fermés ----------
  function renderBlocked() {
    $("#blockedList").innerHTML = state.blocked.map((b) => `<li><span>${fmtLong(b.day)}${b.reason ? `<small>${esc(b.reason)}</small>` : ""}</span><button class="a-btn" data-unblock="${b.day}">Rouvrir</button></li>`).join("")
      || `<li><span class="a-empty">Aucune fermeture prévue.</span></li>`;
  }
  $("#bDay").min = iso(new Date());
  $("#blockForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const day = $("#bDay").value, reason = $("#bReason").value.trim() || null, msg = $("#blockMsg");
    const { error } = await db.from("blocked_days").upsert({ day, reason });
    msg.className = "a-msg" + (error ? "" : " ok");
    msg.textContent = error ? "La fermeture n’a pas pu être enregistrée." : `Fermé le ${fmtLong(day)}.`;
    if (!error) { e.target.reset(); refresh(); }
  });
  $("#blockedList").addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-unblock]"); if (!btn) return;
    btn.disabled = true;
    const { error } = await db.from("blocked_days").delete().eq("day", btn.dataset.unblock);
    if (error) { btn.disabled = false; btn.textContent = "Échec"; return; }
    refresh();
  });

  // ---------- Ajout manuel ----------
  const ALL_SERVICES = [...CFG.services, ...(CFG.salonOnlyServices || [])];
  $("#aService").innerHTML = ALL_SERVICES.map((s) => `<option value="${esc(s.id)}">${esc(s.name)} · ${s.price} €</option>`).join("");
  $("#aTime").innerHTML = CFG.slots.map((t) => `<option>${t}</option>`).join("");
  $("#aDay").value = iso(new Date());
  $("#agenda").addEventListener("click", (e) => {
    const b = e.target.closest("[data-add]"); if (!b) return;
    $("#aDay").value = state.selected; $("#aTime").value = b.dataset.add;
    const card = $("#addCard"); card.scrollIntoView({ behavior: "smooth", block: "center" });
    card.classList.add("is-flash"); setTimeout(() => card.classList.remove("is-flash"), 1200);
    $("#aName").focus({ preventScroll: true });
  });
  $("#addForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $("#addMsg"), btn = $("#addBtn");
    const name = $("#aName").value.trim(), phone = $("#aPhone").value.trim();
    const svc = ALL_SERVICES.find((s) => s.id === $("#aService").value);
    msg.className = "a-msg";
    if (name.length < 2) { msg.textContent = "Indiquez le nom du client."; return; }
    if (phone && (!/^[0-9 +().-]{8,20}$/.test(phone) || phone.replace(/\D/g, "").length < 9)) { msg.textContent = "Numéro invalide : corrigez-le ou laissez le champ vide."; return; }
    btn.disabled = true; btn.textContent = "Ajout…";
    const day = $("#aDay").value, slot = $("#aTime").value;
    const { error } = await db.from("appointments").insert({ day, slot, service: svc.name, price: svc.price, client_name: name, client_phone: phone || null, note: "Ajouté par le salon" });
    btn.disabled = false; btn.textContent = "Ajouter";
    if (error) {
      msg.textContent = error.code === "23505" ? `Le créneau de ${slot} est déjà pris ce jour-là.`
        : error.code === "42501" ? "Ajout refusé. Exécutez le fichier supabase/mise-a-jour.sql dans Supabase, puis réessayez."
        : "L’ajout a échoué. Vérifiez votre connexion et réessayez.";
      return;
    }
    msg.className = "a-msg ok"; msg.textContent = `${name} ajouté le ${fmtLong(day)} à ${slot}.`;
    $("#aName").value = ""; $("#aPhone").value = "";
    if (state.range !== "upcoming" && day >= iso(new Date())) state.range = "upcoming";
    state.selected = day; state.query = ""; $("#search").value = "";
    refresh();
  });

  db.auth.getSession().then(({ data }) => enter(data.session));
}
