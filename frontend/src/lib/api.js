// Wrapper da API (Google Apps Script). GET p/ leituras, POST p/ escritas.
// Falha de rede/HTTP/resposta nunca fica silenciosa: lança Error (pego pelo
// listener global de unhandledrejection em main.js, que mostra toast).
// Leituras tentam até 3x em falhas transitórias; escritas nunca são repetidas automaticamente.
import { ref } from "vue";

const CFG = typeof window !== "undefined" ? window.PWR_CONFIG || {} : {};
const URL_API = CFG.URL_API || "";
const ORIGEM_TOKEN = CFG.ORIGEM_TOKEN || "";

export const pending = ref(0);

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

async function fetchJson(action, url, opts, attempt = 0) {
  if (!URL_API || URL_API.startsWith("TROQUE_")) throw new Error("O serviço de records ainda não está disponível. Tente novamente mais tarde.");
  pending.value++;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    let r;
    try {
      r = await fetch(url, { ...opts, signal: controller.signal });
    } catch {
      if (!opts?.method && attempt < 2) {
        await sleep(600 * (attempt + 1));
        return fetchJson(action, url, opts, attempt + 1);
      }
      throw new Error(`API fora do ar (${action})`);
    }
    if (!r.ok) {
      if ((r.status >= 500 || r.status === 404 || r.status === 429) && !opts?.method && attempt < 2) {
        await sleep(600 * (attempt + 1));
        return fetchJson(action, url, opts, attempt + 1);
      }
      throw new Error(`API respondeu HTTP ${r.status} (${action})`);
    }
    try {
      return await r.json();
    } catch {
      if (!opts?.method && attempt < 2) {
        await sleep(600 * (attempt + 1));
        return fetchJson(action, url, opts, attempt + 1);
      }
      throw new Error(`Resposta inválida da API (${action})`);
    }
  } finally {
    clearTimeout(timeout);
    pending.value--;
  }
}

function getToken() {
  try {
    return localStorage.getItem("pwr_token");
  } catch {
    return null;
  }
}

export async function apiGet(action, params = {}) {
  const q = new URLSearchParams({ origem: ORIGEM_TOKEN, action, ...params });
  const token = getToken();
  if (token) q.set("token", token);
  return fetchJson(action, `${URL_API}?${q.toString()}`);
}

export async function apiPost(action, data = {}) {
  const token = getToken();
  const payload = { origem: ORIGEM_TOKEN, action, ...data };
  if (token) payload.token = token;
  // text/plain evita preflight CORS no Apps Script e a resposta continua legível.
  return fetchJson(action, `${URL_API}?origem=${encodeURIComponent(ORIGEM_TOKEN)}`, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });
}

// Paginação: 30 linhas por página; backend retorna { rows, total } quando há limit.
export const PAGE_SIZE = 30;
export async function apiPage(action, params, page) {
  const r = await apiGet(action, { ...params, limit: String(PAGE_SIZE), offset: String((page - 1) * PAGE_SIZE) });
  if (!r || r.erro || !Array.isArray(r.rows)) return { rows: [], total: 0, erro: r?.erro || "Resposta inválida ao carregar os records" };
  return { rows: r.rows, total: Number(r.total || 0) };
}
