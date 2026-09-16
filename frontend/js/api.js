// Wrapper da API (Apps Script). GET p/ leituras, POST p/ escritas.
// Falha de rede/HTTP/resposta NUNCA retorna silencioso: lança Error que o
// handler global abaixo mostra em toast (sem precisar abrir o console).
// Requisições ao Apps Script falham de forma intermitente (cold start, rajadas,
// transiência do Google): tenta até 3x com espera crescente antes de apanhar.
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
async function _fetchJson(action, url, opts, attempt = 0) {
  _pending++;
  _loading();
  try {
    let r;
    try {
      r = await fetch(url, opts);
    } catch {
      if (attempt < 2) { await sleep(600 * (attempt + 1)); return _fetchJson(action, url, opts, attempt + 1); }
      throw new Error(`API fora do ar (${action})`);
    }
    if (!r.ok) {
      // 404/429/5xx do Google costumam ser transitórios; 4xx de verdade repetem e apanham
      if ((r.status >= 500 || r.status === 404 || r.status === 429) && attempt < 2) {
        await sleep(600 * (attempt + 1));
        return _fetchJson(action, url, opts, attempt + 1);
      }
      throw new Error(`API respondeu HTTP ${r.status} (${action})`);
    }
    try {
      return await r.json();
    } catch {
      if (attempt < 2) { await sleep(600 * (attempt + 1)); return _fetchJson(action, url, opts, attempt + 1); }
      throw new Error(`Resposta inválida da API (${action})`);
    }
  } finally {
    _pending--;
    _loading();
  }
}
let _pending = 0;
function _loading() {
  if (typeof document === "undefined") return;
  let el = document.getElementById("loading");
  if (!el) {
    el = document.createElement("div");
    el.id = "loading";
    el.textContent = "Carregando...";
    document.body.appendChild(el);
  }
  el.style.display = _pending > 0 ? "block" : "none";
}
async function apiGet(action, params = {}) {
  const q = new URLSearchParams({ origem: ORIGEM_TOKEN, action, ...params });
  const token = localStorage.getItem("pwr_token");
  if (token) q.set("token", token);
  return _fetchJson(action, `${URL_API}?${q.toString()}`);
}

async function apiPost(action, data = {}) {
  const token = localStorage.getItem("pwr_token");
  const payload = { origem: ORIGEM_TOKEN, action, ...data };
  if (token) payload.token = token;
  // text/plain evita preflight CORS no Apps Script e a resposta continua legível
  return _fetchJson(action, `${URL_API}?origem=${encodeURIComponent(ORIGEM_TOKEN)}`, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });
}
if (typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", (e) => {
    toast("Erro na API: " + ((e.reason && e.reason.message) || "falha inesperada"), "error");
  });
}

// Escape p/ evitar XSS armazenado: nickname/notas/etc. vêm de outros usuários
// e são interpolados via innerHTML nas páginas.
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
// Só permite http(s) em links (barra javascript:).
function safeUrl(u) {
  u = String(u || "").trim();
  return /^https?:\/\//i.test(u) ? u : "#";
}
// Data ISO → pt-BR curta p/ tabelas.
function fmtDate(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return "";
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
// Rótulo do método do record.
function mlabel(m) {
  return m === "sem_ajuda" ? "Sem ajuda" : m === "com_ajuda" ? "Com ajuda" : String(m || "—");
}
// Rótulo do vento.
function wlabel(w) {
  return w === "natural" ? "Natural" : w === "normal" ? "Normal" : String(w || "—");
}
// Símbolo do voto da comunidade: 1 aprovado, -1 rejeitado, 0 não votado.
function comlabel(v) {
  v = Number(v || 0);
  return v === 1 ? "✓" : v === -1 ? "✗" : "—";
}
// Toast no canto superior direito: some sozinho + botão fechar.
function toast(text, type = "info") {
  let box = document.getElementById("toasts");
  if (!box) { box = document.createElement("div"); box.id = "toasts"; document.body.appendChild(box); }
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  const span = document.createElement("span");
  span.textContent = text;
  const btn = document.createElement("button");
  btn.textContent = "×";
  btn.setAttribute("aria-label", "Fechar");
  btn.onclick = () => el.remove();
  el.append(span, btn);
  box.appendChild(el);
  setTimeout(() => el.remove(), 5000);
}
// Paginação: 30 linhas por página; backend retorna { rows, total } quando há limit.
const PAGE_SIZE = 30;
async function apiPage(action, params, page) {
  const r = await apiGet(action, { ...params, limit: String(PAGE_SIZE), offset: String((page - 1) * PAGE_SIZE) });
  if (!r || r.erro || !Array.isArray(r.rows)) return { rows: [], total: 0, erro: (r || {}).erro };
  return { rows: r.rows, total: Number(r.total || 0) };
}
function pagerHTML(page, total) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (pages <= 1) return "";
  return `<button data-pg="${page - 1}" ${page <= 1 ? "disabled" : ""}>← Anterior</button><span> Página ${page} de ${pages} (${total}) </span><button data-pg="${page + 1}" ${page >= pages ? "disabled" : ""}>Próxima →</button>`;
}
function bindPager(el, go) {
  if (!el) return;
  el.querySelectorAll("[data-pg]").forEach(b => b.onclick = () => go(Number(b.dataset.pg)));
}
