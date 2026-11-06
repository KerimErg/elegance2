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
  const state = { range: "upcoming", showCancelled: false, appts: [], blocked: [], confirming: null, timer: null };

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
    const [from, to] = state.range === "upcoming" ? [today, addDays(today, 13)] : [addDays(today, -30), addDays(today, -1)];
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

  // ---------- Agenda ----------
  function renderAgenda(from, to) {
    const todayIso = iso(new Date());
    const blockedSet = new Map(state.blocked.map((b) => [b.day, b.reason]));
    const list = state.appts.filter((r) => state.showCancelled || r.status === "confirmed");
    const dayList = [];
    for (let d = new Date(from); d <= to; d = addDays(d, 1)) {
      if (state.range === "past" && !list.some((r) => r.day === iso(d))) continue;
      dayList.push(iso(d));
    }
    if (state.range === "upcoming") dayList.sort(); else dayList.reverse();
    $("#agenda").innerHTML = dayList.map((day) => {
      const items = list.filter((r) => r.day === day);
      const open = CFG.open[fromIso(day).getDay()];
      const closedNote = blockedSet.has(day) ? `Fermé${blockedSet.get(day) ? " · " + esc(blockedSet.get(day)) : ""}` : !open ? "Fermé" : `${items.filter((r) => r.status === "confirmed").length} rdv`;
      return `<section class="a-day${day === todayIso ? " is-today" : ""}">
        <h3><b>${fmtLong(day)}</b><span>${closedNote}</span></h3>
        ${items.length ? items.map(apptRow).join("") : `<p class="a-empty">${open && !blockedSet.has(day) ? "Aucun rendez-vous." : "Salon fermé."}</p>`}
      </section>`;
    }).join("") || `<p class="a-empty">Aucun rendez-vous sur cette période.</p>`;
  }

  function apptRow(r) {
    const cancelled = r.status === "cancelled";
    const tel = r.client_phone.replace(/[^0-9+]/g, "");
    const confirming = state.confirming === r.id;
    const actions = cancelled
      ? `<button class="a-btn" data-act="restore" data-id="${r.id}">Rétablir</button>`
      : confirming
        ? `<button class="a-btn a-btn--danger" data-act="cancel" data-id="${r.id}">Confirmer l’annulation</button><button class="a-btn" data-act="keep" data-id="${r.id}">Garder</button>`
        : `<button class="a-btn" data-act="ask" data-id="${r.id}">Annuler</button>`;
    return `<article class="a-appt${cancelled ? " is-cancelled" : ""}">
      <span class="a-time">${esc(String(r.slot).slice(0, 5))}</span>
      <div class="a-who">
        <strong>${esc(r.client_name)}</strong>${cancelled ? '<span class="a-badge">Annulé</span>' : ""}
        <p>${esc(r.service)}${r.price ? " · " + esc(r.price) + " €" : ""}</p>
        <p><a href="tel:${esc(tel)}">${esc(r.client_phone)}</a>${r.client_email ? ` · <a href="mailto:${esc(r.client_email)}">${esc(r.client_email)}</a>` : ""}</p>
      </div>
      <div class="a-actions">${actions}</div>
    </article>`;
  }

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
    const [from, to] = state.range === "upcoming" ? [today, addDays(today, 13)] : [addDays(today, -30), addDays(today, -1)];
    renderAgenda(from, to);
  };

  document.querySelectorAll(".a-tab").forEach((t) => t.addEventListener("click", () => {
    state.range = t.dataset.range;
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

  db.auth.getSession().then(({ data }) => enter(data.session));
}
