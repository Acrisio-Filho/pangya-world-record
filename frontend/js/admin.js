let COURSES = [], BANDS = [], ALLRECS = [], ME = null;
let PAGE_PEND = 1, PAGE_ALL = 1, PAGE_USERS = 1;
const cname = (id) => (COURSES.find(x => String(x.id) === String(id)) || {}).name || id;
const bname = (id) => (BANDS.find(x => String(x.id) === String(id)) || {}).label || id;

async function load() {
  ME = await requireAdmin(); if (!ME) return;
  await reloadTables();
  fillRecordFormSelects();
  await renderPending(1);
  await reloadAllRecords(1);
  await reloadUsers(1);
}

// ---- pendentes (validar + realocar) ----
async function renderPending(page = 1) {
  PAGE_PEND = page;
  const { rows: pend, total } = await apiPage("listPending", {}, page);
  document.getElementById("pend").innerHTML = pend.map(r => `
    <div class="card" data-id="${esc(r.id)}">
      <b>${esc(r.score)}</b> (${esc(r.pang ?? "")} pang) — <b>${esc(mlabel(r.method))}</b> / ${esc(wlabel(r.wind))} — user <a href="profile.html?id=${esc(r.user_id)}">${esc(r.nickname || r.user_id)}</a> — ${esc(r.course_id)}/${esc(r.powerband_id)} (${esc(r.power_value)}) — enviado em ${esc(fmtDate(r.submitted_at))} — ${Number(r.community || 0) === 1 ? `<span class="best">✓ comunidade — decisão final</span>` : r.edit_of ? `<i>proposta de melhoria</i>` : r.edited === "TRUE" ? `<i>edição (reenviado)</i>` : `<i>novo pedido</i>`}
      ${r.screenshot_url ? `<a href="${esc(safeUrl(r.screenshot_url))}" target="_blank">print</a>` : ""} ${r.video_url ? `<a href="${esc(safeUrl(r.video_url))}" target="_blank">vídeo</a>` : ""}
      <div class="filters">
        <select class="nc">${COURSES.map(c => `<option value="${esc(c.id)}" ${c.id === r.course_id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select>
        <select class="nb">${BANDS.map(b => `<option value="${esc(b.id)}" ${b.id === r.powerband_id ? "selected" : ""}>${esc(b.label)}</option>`).join("")}</select>
        <input class="nt" placeholder="nota p/ realocação">
        <button class="ok">Aprovar</button><button class="no">Rejeitar</button>
      </div>
    </div>`).join("") || "Nada pendente.";
  document.querySelectorAll("#pend .card").forEach(card => {
    const id = card.dataset.id;
    card.querySelector(".ok").onclick = () => validate(id, "approved", card);
    card.querySelector(".no").onclick = () => validate(id, "rejected", card);
  });
  const pg = document.getElementById("pend-pager");
  pg.innerHTML = pagerHTML(page, total);
  bindPager(pg, renderPending);
}
async function validate(id, status, card) {
  const r = await apiPost("validateRecord", { id, status, course_id: card.querySelector(".nc").value, powerband_id: card.querySelector(".nb").value, note: card.querySelector(".nt").value });
  if (r.erro) toast(r.erro, "error"); else { toast("Validado.", "success"); card.remove(); reloadAllRecords(PAGE_ALL); }
}

// ---- todos os records (editar mesmo depois de aceito) ----
const ALL_FILTERS = {
  all: { status: "all" }, pending: { status: "pending" }, approved: { status: "approved" },
  rejected: { status: "rejected" }, comm_ok: { status: "all", community: "1" },
  comm_rejected: { status: "all", community: "-1" }, final: { status: "pending", community: "1" },
  best: { status: "all", best: "1" }, proposal: { status: "all", proposal: "1" },
  edited: { status: "all", edited: "1" },
};
async function reloadAllRecords(page = 1) {
  PAGE_ALL = page;
  const f = document.getElementById("r-filter").value;
  const { rows, total, erro } = await apiPage("listRecords", ALL_FILTERS[f] || ALL_FILTERS.all, page);
  ALLRECS = erro ? [] : rows;
  document.getElementById("all-rows").innerHTML = erro ? `<tr><td colspan="14">${esc(erro)}</td></tr>` : rows.map(r => `<tr>
    <td>${esc(r.score)}${r.is_best === "TRUE" ? `<span class="best">BEST</span>` : ""}</td><td>${esc(r.pang ?? "")}</td><td>${esc(mlabel(r.method))}</td><td>${esc(wlabel(r.wind))}</td><td><a href="profile.html?id=${esc(r.user_id)}">${esc(r.nickname || r.user_id)}</a></td><td>${esc(cname(r.course_id))}</td><td>${esc(bname(r.powerband_id))}</td><td>${esc(r.power_value ?? "")}</td><td>${esc(r.status)}</td><td>${esc(comlabel(r.community))}</td><td>${r.edit_of ? "proposta" : "—"}</td><td>${esc(r.note || "")}</td><td>${esc(fmtDate(r.submitted_at))}</td>
    <td><button class="btn" data-edit-rec="${esc(r.id)}">Editar</button></td></tr>`).join("") || `<tr><td colspan="14">Nada aqui.</td></tr>`;
  const pg = document.getElementById("all-pager");
  pg.innerHTML = pagerHTML(page, total);
  bindPager(pg, reloadAllRecords);
  document.querySelectorAll("[data-edit-rec]").forEach(b => b.onclick = () => {
    const r = ALLRECS.find(x => x.id === b.dataset.editRec);
    document.getElementById("r-id").value = r.id;
    document.getElementById("r-score").value = r.score;
    document.getElementById("r-pang").value = r.pang ?? "";
    document.getElementById("r-method").value = r.method || "com_ajuda";
    document.getElementById("r-wind").value = r.wind || "normal";
    document.getElementById("r-course").value = r.course_id;
    document.getElementById("r-band").value = r.powerband_id;
    document.getElementById("r-power").value = r.power_value;
    document.getElementById("r-shot").value = r.screenshot_url || "";
    document.getElementById("r-video").value = r.video_url || "";
    document.getElementById("r-status").value = r.status;
    document.getElementById("r-note").value = r.note || "";
    document.getElementById("r-force").checked = Number(r.community || 0) === 1;
    window.scrollTo(0, document.getElementById("f-record").offsetTop);
  });
}
function fillRecordFormSelects() {
  const rc = document.getElementById("r-course"), rb = document.getElementById("r-band");
  rc.innerHTML = ""; rb.innerHTML = "";
  COURSES.forEach(x => rc.add(new Option(x.name, x.id)));
  BANDS.forEach(x => rb.add(new Option(x.label, x.id)));
}

// ---- usuários (liberar / bloquear) ----
async function reloadUsers(page = 1) {
  PAGE_USERS = page;
  const { rows: users, total, erro } = await apiPage("listUsers", {}, page);
  document.getElementById("users-rows").innerHTML = erro ? `<tr><td colspan="5">${esc(erro)}</td></tr>` : users.map(u => `<tr>
    <td><a href="profile.html?id=${esc(u.id)}">${esc(u.nickname)}</a></td><td><span class="email-mask">••••••</span> <button class="btn email-toggle" data-email="${esc(u.email)}" title="mostrar/ocultar">👁️</button></td><td>${esc(u.role)}</td><td>${esc(u.status)}</td>
    <td>${u.id === ME.id ? "(você)" : `<button class="btn" data-toggle-user="${esc(u.id)}" data-to="${u.status === "active" ? "blocked" : "active"}">${u.status === "active" ? "Bloquear" : "Liberar"}</button>`}</td></tr>`).join("");
  document.querySelectorAll(".email-toggle").forEach(b => b.onclick = () => {
    const cell = b.previousElementSibling;
    const shown = cell.dataset.shown === "1";
    cell.textContent = shown ? "••••••" : b.dataset.email;
    cell.dataset.shown = shown ? "" : "1";
    b.textContent = shown ? "👁️" : "🙈";
  });
  document.querySelectorAll("[data-toggle-user]").forEach(b => b.onclick = async () => {
    const r = await apiPost("setUserStatus", { id: b.dataset.toggleUser, status: b.dataset.to });
    if (r.erro) { toast(r.erro, "error"); return; }
    toast("Conta atualizada.", "success"); reloadUsers(PAGE_USERS);
  });
  const pg = document.getElementById("users-pager");
  pg.innerHTML = pagerHTML(page, total);
  bindPager(pg, reloadUsers);
}

// ---- courses / faixas ----
async function reloadTables() {
  COURSES = await apiGet("listCourses", { include_inactive: "1" });
  BANDS = await apiGet("listBands", { include_inactive: "1" });
  document.getElementById("courses-rows").innerHTML = COURSES.map(c => `<tr>
    <td>${esc(c.id)}</td><td>${esc(c.name)}</td><td>${esc(c.active)}</td>
    <td><button class="btn" data-edit-course="${esc(c.id)}">Editar</button><button class="btn btn-danger" data-del-course="${esc(c.id)}">Excluir</button></td></tr>`).join("");
  document.getElementById("bands-rows").innerHTML = BANDS.map(b => `<tr>
    <td>${esc(b.id)}</td><td>${esc(b.label)}</td><td>${esc(b.min)}</td><td>${esc(b.max)}</td><td>${esc(b.active)}</td>
    <td><button class="btn" data-edit-band="${esc(b.id)}">Editar</button><button class="btn btn-danger" data-del-band="${esc(b.id)}">Excluir</button></td></tr>`).join("");
  document.querySelectorAll("[data-edit-course]").forEach(b => b.onclick = () => {
    const c = COURSES.find(x => x.id === b.dataset.editCourse);
    document.getElementById("c-id").value = c.id;
    document.getElementById("c-name").value = c.name;
    document.getElementById("c-active").checked = String(c.active).toUpperCase() === "TRUE";
    document.getElementById("course-form-title").textContent = `Editar course (${c.id})`;
  });
  document.querySelectorAll("[data-edit-band]").forEach(b => b.onclick = () => {
    const x = BANDS.find(x => x.id === b.dataset.editBand);
    document.getElementById("b-id").value = x.id;
    document.getElementById("b-label").value = x.label;
    document.getElementById("b-min").value = x.min;
    document.getElementById("b-max").value = x.max;
    document.getElementById("b-active").checked = String(x.active).toUpperCase() === "TRUE";
    document.getElementById("band-form-title").textContent = `Editar faixa (${x.id})`;
  });
  document.querySelectorAll("[data-del-course]").forEach(b => b.onclick = async () => {
    if (!confirm(`Excluir course ${b.dataset.delCourse}?`)) return;
    const r = await apiPost("deleteCourse", { id: b.dataset.delCourse });
    if (r.erro) { toast(r.erro, "error"); return; }
    toast("Course excluído.", "success"); reloadTables();
  });
  document.querySelectorAll("[data-del-band]").forEach(b => b.onclick = async () => {
    if (!confirm(`Excluir faixa ${b.dataset.delBand}?`)) return;
    const r = await apiPost("deleteBand", { id: b.dataset.delBand });
    if (r.erro) { toast(r.erro, "error"); return; }
    toast(`Faixa excluída (${r.realocados ?? 0} records realocados).`, "success"); reloadTables();
  });
}

function resetCourseForm() {
  document.getElementById("f-course").reset();
  document.getElementById("c-id").value = "";
  document.getElementById("course-form-title").textContent = "Adicionar course";
}
function resetBandForm() {
  document.getElementById("f-band").reset();
  document.getElementById("b-id").value = "";
  document.getElementById("band-form-title").textContent = "Adicionar faixa";
}

document.addEventListener("DOMContentLoaded", () => {
  load();
  document.getElementById("r-filter").onchange = () => reloadAllRecords(1);
  document.getElementById("f-record").onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById("r-id").value;
    if (!id) { document.getElementById("msg").textContent = "Escolha um record (Editar) primeiro."; return; }
    const orig = (ALLRECS.find(x => x.id === id) || {}).status;
    const origCom = Number((ALLRECS.find(x => x.id === id) || {}).community || 0) === 1;
    const data = { score: Number(document.getElementById("r-score").value), pang: Number(document.getElementById("r-pang").value || 0), method: document.getElementById("r-method").value, wind: document.getElementById("r-wind").value, course_id: document.getElementById("r-course").value, powerband_id: document.getElementById("r-band").value, power_value: Number(document.getElementById("r-power").value), screenshot_url: document.getElementById("r-shot").value, video_url: document.getElementById("r-video").value, note: document.getElementById("r-note").value };
    let r = await apiPost("updateRecord", { id, direct: true, data });
    const st = document.getElementById("r-status").value;
    const force = document.getElementById("r-force").checked && !origCom;
    if (!r.erro && !r.proposal && (st !== orig || force)) r = await apiPost("validateRecord", { id, status: st, course_id: data.course_id, powerband_id: data.powerband_id, note: document.getElementById("r-note").value, ...(force ? { community_ok: true } : {}) });
    if (r.erro) { toast(r.erro, "error"); return; }
    toast(r.proposal ? "Proposta enviada — original segue valendo até aprovação total." : "Record salvo.", "success");
    document.getElementById("f-record").reset(); document.getElementById("r-id").value = ""; reloadAllRecords(PAGE_ALL); renderPending(PAGE_PEND);
  };
  document.getElementById("r-cancel").onclick = () => { document.getElementById("f-record").reset(); document.getElementById("r-id").value = ""; };
  document.getElementById("f-course").onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector("button:not([type=button])");
    if (btn.disabled) return;
    btn.disabled = true;
    try {
      const r = await apiPost("upsertCourse", { id: document.getElementById("c-id").value || undefined, data: { name: document.getElementById("c-name").value, active: document.getElementById("c-active").checked ? "TRUE" : "FALSE" } });
      if (r.erro) { toast(r.erro, "error"); return; }
      toast("Course salvo.", "success"); resetCourseForm(); reloadTables();
    } finally { btn.disabled = false; }
  };
  document.getElementById("f-band").onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector("button:not([type=button])");
    if (btn.disabled) return;
    btn.disabled = true;
    try {
      const r = await apiPost("upsertBand", { id: document.getElementById("b-id").value || undefined, data: { label: document.getElementById("b-label").value, min: Number(document.getElementById("b-min").value), max: Number(document.getElementById("b-max").value), active: document.getElementById("b-active").checked ? "TRUE" : "FALSE" } });
      if (r.erro) { toast(r.erro, "error"); return; }
      toast("Faixa salva.", "success"); resetBandForm(); reloadTables();
    } finally { btn.disabled = false; }
  };
  document.getElementById("c-cancel").onclick = resetCourseForm;
  document.getElementById("b-cancel").onclick = resetBandForm;
});
