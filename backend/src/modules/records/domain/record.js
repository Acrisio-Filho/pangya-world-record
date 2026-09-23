// Immutable value object. Storage, transport and framework independent.
function RecordDraft(input) {
  const number = value => value !== null && value !== undefined && String(value).trim() !== '' && Number.isFinite(Number(value));
  const url = value => !value || /^https?:\/\/[^\s<>"'`]+$/i.test(String(value).trim());
  const trustedVideoUrl = value => !value || /^https?:\/\/(?:(?:www\.|m\.)?(?:youtube\.com|youtu\.be)|(?:www\.)?twitch\.tv|clips\.twitch\.tv|(?:www\.)?vimeo\.com|player\.vimeo\.com|(?:www\.)?tiktok\.com|vm\.tiktok\.com|(?:www\.)?kick\.com|(?:www\.)?facebook\.com|fb\.watch|(?:www\.)?instagram\.com)\//i.test(String(value).trim());
  if (!["sem_ajuda", "com_ajuda"].includes(input.method)) throw new Error("Informe o método: sem_ajuda ou com_ajuda");
  if (!["normal", "natural"].includes(input.wind)) throw new Error("Informe o vento: normal ou natural");
  if (!number(input.score) || !Number.isInteger(Number(input.score))) throw new Error("Score inválido");
  if (!number(input.power_value) || Number(input.power_value) <= 0) throw new Error("Força inválida");
  if (input.pang !== undefined && input.pang !== '' && (!number(input.pang) || Number(input.pang) < 0 || !Number.isInteger(Number(input.pang)))) throw new Error("Pang inválido");
  if (!String(input.course_id || '').trim()) throw new Error("Informe o campo");
  if (!url(input.screenshot_url)) throw new Error("URL do print inválida (use http/https)");
  if (!trustedVideoUrl(input.video_url)) throw new Error("Use um link de vídeo do YouTube, Twitch, Vimeo, TikTok, Kick, Facebook ou Instagram");
  if (input.method === "sem_ajuda" && !String(input.video_url || '').trim()) throw new Error("Sem ajuda exige vídeo de prova");
  return Object.freeze({
    course_id: String(input.course_id), power_value: Number(input.power_value),
    score: Number(input.score), pang: Number(input.pang || 0),
    method: input.method, wind: input.wind,
    screenshot_url: String(input.screenshot_url || '').trim(), video_url: String(input.video_url || '').trim(),
  });
}
