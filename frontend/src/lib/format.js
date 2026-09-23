import { useConfirmStore } from "../stores/confirm.js";

// Formatação/rótulos compartilhados. Vue escapa interpolação de template
// sozinho, então (diferente da versão vanilla) não precisamos de esc() manual.

// Só permite http(s) em links: barra javascript:/data: e quebra de atributo.
export function safeUrl(u) {
  u = String(u || "").trim();
  return /^https?:\/\/[^\s<>"'`]+$/i.test(u) ? u : "#";
}

export function trustedVideoUrl(u) {
  u = String(u || "").trim();
  return /^https?:\/\/(?:(?:www\.|m\.)?(?:youtube\.com|youtu\.be)|(?:www\.)?twitch\.tv|clips\.twitch\.tv|(?:www\.)?vimeo\.com|player\.vimeo\.com|(?:www\.)?tiktok\.com|vm\.tiktok\.com|(?:www\.)?kick\.com|(?:www\.)?facebook\.com|fb\.watch|(?:www\.)?instagram\.com)\//i.test(u);
}

export function fmtDate(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return "";
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function mlabel(m) {
  return m === "sem_ajuda" ? "Sem ajuda" : m === "com_ajuda" ? "Com ajuda" : String(m || "—");
}

export function wlabel(w) {
  return w === "natural" ? "Natural" : w === "normal" ? "Normal" : String(w || "—");
}

export function comlabel(v) {
  v = Number(v || 0);
  return v === 1 ? "✓ aprovado" : v === -1 ? "✗ rejeitado" : "— não votado";
}

// Links enviados por usuários (provas, canal): confirma antes de abrir,
// identificando quem forneceu.
export function confirmOpen(e, by) {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  const href = e.currentTarget?.href;
  useConfirmStore().ask({ title: "Abrir link externo?", message: `Link fornecido por ${by}. Abra somente se você confiar no conteúdo.`, confirmLabel: "Abrir link" }).then((accepted) => {
    if (accepted && href) window.open(href, "_blank", "noopener,noreferrer");
  });
}
