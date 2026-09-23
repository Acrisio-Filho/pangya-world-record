const ORIGEM_TOKEN = "TROQUE_ISSO_pwr_123"; // igual ao frontend/js/config.js
const SALT = "TROQUE_ISSO_salt_bem_longo"; // usado no hash da senha
const SESSION_DIAS = 30;
// Login Google (GIS): Client ID é público por desenho (vai no JS). Troque pelo seu
// (console.cloud.google.com → APIs e serviços → Credenciais → ID do cliente OAuth).
const GOOGLE_CLIENT_ID = "TROQUE_ISSO_google_client_id"; // igual ao frontend/js/config.js
// Comunidade: voto pesa os pontos; aprova com peso 50+, 3+ votantes e >2x o contrário
const VOTE_QUORUM = 50;
const VOTE_MIN_VOTERS = 3;
const PTS_ADMIN_OK = 10; // record aceito pelo admin
const PTS_COM_OK = 25; // record aceito pela comunidade (vale mais)
const PTS_IMPROVE_ADMIN = 5; // melhoria aprovada (metade)
const PTS_IMPROVE_COM = 12; // melhoria aceita pela comunidade (metade)
// Método do record: sem_ajuda (só o jogo aberto, vídeo obrigatório) ou com_ajuda (programas)
const METHODS = ["sem_ajuda", "com_ajuda"];
// Vento: normal ou natural (parte da categoria, como o método)
const WINDS = ["normal", "natural"];
function _methodLabel(m) {
  return m === "sem_ajuda" ? "Sem ajuda" : m === "com_ajuda" ? "Com ajuda" : String(m || "");
}

function _out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function _ss() { return SpreadsheetApp.getActiveSpreadsheet(); }
function _sheet(name) { return _ss().getSheetByName(name); }
function _rows(name) {
  const sh = _sheet(name);
  if (!sh) return { header: [], rows: [] };
  const v = sh.getDataRange().getValues();
  if (v.length === 0) return { header: [], rows: [] };
  return { header: v[0], rows: v.slice(1) };
}
function _toObj(header, r) {
  const o = {};
  header.forEach((c, i) => { o[String(c)] = r[i]; });
  return o;
}
// Paginação: com limit=N retorna { rows, total }; sem limit retorna o array (compatível).
function _page(arr, p) {
  const raw = Number(p.limit) || 0;
  if (!raw) return arr;
  const lim = Math.min(200, Math.max(1, raw));
  const off = Math.max(0, Number(p.offset) || 0);
  return { rows: arr.slice(off, off + lim), total: arr.length };
}
function _append(name, obj, header) {
  _sheet(name).appendRow(header.map(h => obj[h] !== undefined ? obj[h] : ""));
}
function _hash(s) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, SALT + s);
  return bytes.map(b => ("0" + ((b < 0 ? b + 256 : b)).toString(16)).slice(-2)).join("");
}
function _checkOrigem(e) {
  const p = (e && e.parameter) || {};
  return p.origem === ORIGEM_TOKEN;
}
function _publicUser(u) {
  return { id: u.id, nickname: u.nickname, role: u.role, status: u.status || "active", bio: u.bio || "", youtube_url: u.youtube_url || "", avatar_url: u.avatar_url || "", has_password: !!u.pass_hash, points: _effPoints(u), created_at: u.created_at };
}
function _effPoints(u) { return effectivePoints(u, new Date()); }
function _addPoints(userId, pts) {
  const sh = _sheet("Users");
  const vals = sh.getDataRange().getValues();
  const head = vals[0];
  const ci = head.indexOf("points");
  if (ci < 0) return;
  for (let i = 1; i < vals.length; i++) {
    if (String(vals[i][0]) === String(userId)) {
      sh.getRange(i + 1, ci + 1).setValue(Number(vals[i][ci] || 0) + pts);
      return;
    }
  }
}
function _tally(recordId) {
  const { header, rows } = _rows("Votes");
  let approve = 0, reject = 0;
  const voters = {};
  rows.forEach(r => {
    const v = _toObj(header, r);
    if (String(v.record_id) !== String(recordId)) return;
    voters[String(v.user_id)] = 1;
    if (v.vote === "approve") approve += Number(v.weight || 0);
    else reject += Number(v.weight || 0);
  });
  return { approve, reject, voters: Object.keys(voters).length };
}
function _youtubeOk(u) {
  // canal: só YouTube (youtube.com / youtu.be), outros sites bloqueados
  return /^(https?:\/\/)?(www\.|m\.)?(youtube\.com|youtu\.be)\//i.test(String(u || "").trim());
}
function _urlOk(u) {
  // print/vídeo são opcionais (vazio ok); preenchidos: só http(s), sem espaços/<>"/'
  // p/ barrar javascript:/data: e quebra de atributo HTML
  u = String(u == null ? "" : u).trim();
  return u === "" || /^https?:\/\/[^\s<>"'`]+$/i.test(u);
}
function _findUserByEmail(email) {
  const { header, rows } = _rows("Users");
  email = String(email).toLowerCase().trim();
  for (const r of rows) {
    const u = _toObj(header, r);
    if (String(u.email).toLowerCase() === email) return u;
  }
  return null;
}
function _findUserById(id) {
  const { header, rows } = _rows("Users");
  for (const r of rows) {
    const u = _toObj(header, r);
    if (String(u.id) === String(id)) return u;
  }
  return null;
}
function _getSession(token) {
  if (!token) return null;
  const { header, rows } = _rows("Sessions");
  for (const r of rows) {
    const s = _toObj(header, r);
    if (String(s.token) === String(token)) {
      if (new Date(s.expires_at) < new Date()) return null;
      return s;
    }
  }
  return null;
}
function _pruneSessions() {
  // higiene: apaga sessões expiradas p/ a aba não crescer p/ sempre
  const sh = _sheet("Sessions");
  const vals = sh.getDataRange().getValues();
  const ei = vals[0].indexOf("expires_at");
  if (ei < 0) return;
  const now = new Date();
  for (let i = vals.length - 1; i >= 1; i--) {
    if (new Date(vals[i][ei]) < now) sh.deleteRow(i + 1);
  }
}
function _newSession(userId) {
  _pruneSessions();
  const token = Utilities.getUuid();
  const exp = new Date(); exp.setDate(exp.getDate() + SESSION_DIAS);
  const { header } = _rows("Sessions");
  _append("Sessions", { token, user_id: userId, expires_at: exp.toISOString() }, header);
  return token;
}
function _authUser(e, payload) {
  const token = (e.parameter && e.parameter.token) || (payload && payload.token);
  const s = _getSession(token);
  if (!s) return null;
  return _findUserById(s.user_id);
}
function _isAdmin(e) {
  const u = _authUser(e, null);
  return u && u.role === "admin";
}
function _isLiveRow(head, r) {
  // live no index: approved + comunidade aprovou
  return RecordPolicy.isPublished(_toObj(head, r));
}
function _makeProposal(sh, head, col, origIdx, vals, u, data) {
  // Melhoria de record live: cria linha pendente ligada ao original (que segue valendo).
  const o = _toObj(head, vals[origIdx]);
  const rec = {
    id: Utilities.getUuid(), user_id: u.id, edit_of: String(o.id),
    course_id: String(data.course_id !== undefined ? data.course_id : o.course_id),
    powerband_id: String(data.powerband_id !== undefined ? data.powerband_id : o.powerband_id),
    power_value: Number(data.power_value !== undefined ? data.power_value : o.power_value),
    score: Number(data.score !== undefined ? data.score : o.score),
    pang: Number(data.pang !== undefined ? data.pang : (o.pang || 0)),
    method: String(data.method !== undefined ? data.method : (o.method || "com_ajuda")),
    wind: String(data.wind !== undefined ? data.wind : (o.wind || "normal")),
    screenshot_url: String(data.screenshot_url !== undefined ? data.screenshot_url : (o.screenshot_url || "")),
    video_url: String(data.video_url !== undefined ? data.video_url : (o.video_url || "")),
    status: "pending", submitted_at: new Date().toISOString(), validated_by: "", validated_at: "",
    note: "", is_best: "", community: "0", pts_admin: "", pts_com: "", edited: "TRUE"
  };
  const { header } = _rows("Records");
  _append("Records", rec, header);
  return rec.id;
}
function _bandForPower(power) {
  const { header, rows } = _rows("PowerBands");
  for (const r of rows) {
    const b = _toObj(header, r);
    if (String(b.active).toUpperCase() === "TRUE" && Number(power) >= Number(b.min) && Number(power) <= Number(b.max)) return b;
  }
  return null;
}
function _recalcBest(courseId, bandId, method, wind) {
  // Melhor da categoria (course+faixa+método+vento) entre os aprovados PELA COMUNIDADE:
  // menor score, empate → maior pang. Marca is_best.
  const sh = _sheet("Records");
  const vals = sh.getDataRange().getValues();
  if (vals.length < 2) return;
  const head = vals[0];
  const ci = head.indexOf("is_best");
  if (ci < 0) return;
  const col = n => head.indexOf(n);
  const mi = head.indexOf("method");
  const wi = head.indexOf("wind");
  const coi = head.indexOf("community");
  const idx = [];
  const inCat = {};
  for (let i = 1; i < vals.length; i++) {
    if (String(vals[i][col("course_id")]) === String(courseId) && String(vals[i][col("powerband_id")]) === String(bandId) && String(vals[i][col("status")]) === "approved" && (mi < 0 || String(vals[i][mi]) === String(method)) && (wi < 0 || String(vals[i][wi]) === String(wind)) && (coi < 0 || Number(vals[i][coi] || 0) === 1)) idx.push(i);
  }
  idx.forEach(i => { inCat[i] = 1; });
  let best = -1;
  idx.forEach(i => {
    if (best < 0) { best = i; return; }
    if (RecordPolicy.compare(_toObj(head, vals[i]), _toObj(head, vals[best])) < 0) best = i;
  });
  // 1 escrita em lote p/ coluna toda (fora da categoria preserva o valor atual)
  const out = [];
  for (let i = 1; i < vals.length; i++) out.push([inCat[i] ? (i === best ? "TRUE" : "") : vals[i][ci]]);
  sh.getRange(2, ci + 1, vals.length - 1, 1).setValues(out);
}


// Outgoing repository port. No Apps Script object escapes this adapter.
function _table(name) {
  const sheet = _sheet(name);
  return {
    read: () => sheet.getDataRange().getValues(),
    remove: row => sheet.deleteRow(row),
    range: (...args) => ({
      write: value => sheet.getRange(...args).setValue(value),
      writeMany: values => sheet.getRange(...args).setValues(values),
    }),
  };
}
const googleIdentity = {
  verify(idToken) {
    const response = UrlFetchApp.fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(idToken), { muteHttpExceptions: true });
    return JSON.parse(response.getContentText());
  }
};
