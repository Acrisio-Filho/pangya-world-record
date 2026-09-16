let COURSES = [], BANDS = [];
async function loadFilters() {
  COURSES = await apiGet("listCourses");
  BANDS = await apiGet("listBands");
  const c = document.getElementById("f-course"), b = document.getElementById("f-band");
  if (c) COURSES.forEach(x => { const o = document.createElement("option"); o.value = x.id; o.textContent = x.name; c.appendChild(o); });
  if (b) BANDS.forEach(x => { const o = document.createElement("option"); o.value = x.id; o.textContent = x.label; b.appendChild(o); });
}
function cname(id) { const c = COURSES.find(x => String(x.id) === String(id)); return c ? c.name : id; }
function bname(id) { const b = BANDS.find(x => String(x.id) === String(id)); return b ? b.label : id; }
async function search(page = 1) {
  const p = { status: "approved", community: "1" };
  const c = document.getElementById("f-course").value, b = document.getElementById("f-band").value, n = document.getElementById("f-nick").value.trim(), m = document.getElementById("f-method").value, w = document.getElementById("f-wind").value;
  if (c) p.course_id = c;
  if (b) p.powerband_id = b;
  if (m) p.method = m;
  if (w) p.wind = w;
  if (n) p.nickname = n;
  if (document.getElementById("f-best").checked) p.best = "1";
  const { rows, total, erro } = await apiPage("listRecords", p, page);
  const tb = document.getElementById("rows");
  if (erro) { tb.innerHTML = `<tr><td colspan="10">${esc(erro)}</td></tr>`; return; }
  tb.innerHTML = rows.map(r => `<tr><td>${esc(r.score)}${r.is_best === "TRUE" ? `<span class="best">BEST</span>` : ""}</td><td>${esc(r.pang ?? "")}</td><td>${esc(mlabel(r.method))}</td><td>${esc(wlabel(r.wind))}</td><td><a href="profile.html?id=${esc(r.user_id)}">${esc(r.nickname || r.user_id)}</a></td><td>${esc(cname(r.course_id))}</td><td>${esc(bname(r.powerband_id))}</td><td>${esc(r.power_value ?? "")}</td><td>${esc(fmtDate(r.submitted_at))}</td><td>${r.video_url ? `<a href="${esc(safeUrl(r.video_url))}" target="_blank">vídeo</a>` : ""} ${r.screenshot_url ? `<a href="${esc(safeUrl(r.screenshot_url))}" target="_blank">print</a>` : ""}</td></tr>`).join("") || `<tr><td colspan="10">Nenhum record.</td></tr>`;
  const pg = document.getElementById("pager");
  pg.innerHTML = pagerHTML(page, total);
  bindPager(pg, search);
}
document.addEventListener("DOMContentLoaded", async () => {
  await loadFilters(); await search(1);
  document.getElementById("f-btn").onclick = () => search(1);
});
