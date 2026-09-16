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
  return { id: u.id, nickname: u.nickname, role: u.role, status: u.status || "active", bio: u.bio || "", youtube_url: u.youtube_url || "", points: _effPoints(u), created_at: u.created_at };
}
function _effPoints(u) {
  // bônus por eventos +5/mês de conta (teto 60 = 12 meses). Vale como peso do voto.
  const bonus = Number(u.points || 0);
  let months = 0;
  const created = new Date(u.created_at);
  if (!isNaN(created)) {
    const now = new Date();
    months = (now.getFullYear() - created.getFullYear()) * 12 + (now.getMonth() - created.getMonth());
    if (now.getDate() < created.getDate()) months--;
    months = Math.max(0, Math.min(12, months));
  }
  return bonus + months * 5;
}
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
  return String(r[head.indexOf("status")]) === "approved" && Number(r[head.indexOf("community")] || 0) === 1;
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
    const s = Number(vals[i][col("score")]), bs = Number(vals[best][col("score")]);
    const p = Number(vals[i][col("pang")] || 0), bp = Number(vals[best][col("pang")] || 0);
    if (s < bs || (s === bs && p > bp)) best = i;
  });
  // 1 escrita em lote p/ coluna toda (fora da categoria preserva o valor atual)
  const out = [];
  for (let i = 1; i < vals.length; i++) out.push([inCat[i] ? (i === best ? "TRUE" : "") : vals[i][ci]]);
  sh.getRange(2, ci + 1, vals.length - 1, 1).setValues(out);
}

// ---------- GET (leitura pública + consultas logadas) ----------
function doGet(e) {
  if (!_checkOrigem(e)) return _out({ erro: "Acesso negado. Origem não autorizada." });
  const action = (e.parameter.action || "").trim();

  if (action === "listCourses") {
    const { header, rows } = _rows("Courses");
    const all = rows.map(r => _toObj(header, r));
    if (e.parameter.include_inactive === "1" && _isAdmin(e)) return _out(all);
    return _out(all.filter(c => String(c.active).toUpperCase() === "TRUE"));
  }
  if (action === "listBands") {
    const { header, rows } = _rows("PowerBands");
    const all = rows.map(r => _toObj(header, r));
    all.sort((a, b) => Number(a.min) - Number(b.min));
    if (e.parameter.include_inactive === "1" && _isAdmin(e)) return _out(all);
    return _out(all.filter(b => String(b.active).toUpperCase() === "TRUE"));
  }
  if (action === "listRecords") {
    // filtros públicos: course_id, powerband_id, nickname, status default=approved
    // resposta inclui `nickname` do dono p/ linkar o perfil
    // não-approved (pending/rejected/all) só dono ou admin
    const p = e.parameter;
    const status = p.status || "approved";
    if (status !== "approved") {
      const me = _authUser(e, null);
      const mine = p.user_id && me && String(me.id) === String(p.user_id);
      if (!mine && !(me && me.role === "admin")) return _out({ erro: "Só dono ou admin" });
    }
    const { header, rows } = _rows("Records");
    const uh = _rows("Users");
    const users = {};
    uh.rows.forEach(r => { const u = _toObj(uh.header, r); users[String(u.id)] = u; });
    let recs = rows.map(r => _toObj(header, r));
    if (status !== "all") recs = recs.filter(x => String(x.status) === status);
    if (p.community === "1" || p.community === "0" || p.community === "-1") recs = recs.filter(x => Number(x.community || 0) === Number(p.community));
    if (p.best === "1") recs = recs.filter(x => x.is_best === "TRUE");
    if (p.proposal === "1") recs = recs.filter(x => String(x.edit_of || "") !== "");
    if (p.edited === "1") recs = recs.filter(x => x.edited === "TRUE" && !x.edit_of);
    if (p.course_id) recs = recs.filter(x => String(x.course_id) === String(p.course_id));
    if (p.powerband_id) recs = recs.filter(x => String(x.powerband_id) === String(p.powerband_id));
    if (p.method) recs = recs.filter(x => String(x.method || "com_ajuda") === String(p.method));
    if (p.wind) recs = recs.filter(x => String(x.wind || "normal") === String(p.wind));
    if (p.user_id) recs = recs.filter(x => String(x.user_id) === String(p.user_id));
    if (p.nickname) {
      const q = String(p.nickname).toLowerCase();
      recs = recs.filter(x => String((users[String(x.user_id)] || {}).nickname || "").toLowerCase().includes(q));
    }
    // melhor score primeiro
    recs.sort((a, b) => Number(a.score) - Number(b.score));
    const mapped = recs.map(x => Object.assign({}, x, { nickname: String((users[String(x.user_id)] || {}).nickname || "") }));
    return _out(_page(mapped, p));
  }
  if (action === "getUser") {
    const u = _findUserById(e.parameter.id);
    if (!u) return _out({ erro: "Usuário não encontrado" });
    return _out(_publicUser(u));
  }
  if (action === "getMe") {
    const u = _authUser(e, null);
    if (!u) return _out({ erro: "Sessão inválida" });
    return _out(_publicUser(u));
  }
  if (action === "listPending") {
    const u = _authUser(e, null);
    if (!u || u.role !== "admin") return _out({ erro: "Só admin" });
    const { header, rows } = _rows("Records");
    const uh = _rows("Users");
    const names = {};
    uh.rows.forEach(r => { const x = _toObj(uh.header, r); names[String(x.id)] = String(x.nickname || ""); });
    return _out(_page(rows.map(r => _toObj(header, r)).filter(x => String(x.status) === "pending")
      .map(x => Object.assign({}, x, { nickname: names[String(x.user_id)] || "" })), e.parameter));
  }
  if (action === "listUsers") {
    if (!_isAdmin(e)) return _out({ erro: "Só admin" });
    const { header, rows } = _rows("Users");
    return _out(_page(rows.map(r => { const u = _toObj(header, r); return { id: u.id, nickname: u.nickname, email: u.email, role: u.role, status: u.status || "active", bio: u.bio || "", youtube_url: u.youtube_url || "", points: _effPoints(u), created_at: u.created_at }; }), e.parameter));
  }
  if (action === "tally") {
    return _out(_tally(e.parameter.id || ""));
  }
  if (action === "tallies") {
    // placares em lote: 1 leitura p/ até 30 ids (página da comunidade fazia 1 request por candidato)
    const ids = String(e.parameter.ids || "").split(",").map(s => s.trim()).filter(Boolean).slice(0, 30);
    const { header, rows } = _rows("Votes");
    const out = {};
    ids.forEach(id => { out[id] = { approve: 0, reject: 0, voters: 0 }; });
    const seen = {};
    rows.forEach(r => {
      const v = _toObj(header, r);
      const t = out[String(v.record_id)];
      if (!t) return;
      const key = String(v.record_id) + "|" + String(v.user_id);
      if (!seen[key]) { seen[key] = 1; t.voters++; }
      if (v.vote === "approve") t.approve += Number(v.weight || 0);
      else t.reject += Number(v.weight || 0);
    });
    return _out(out);
  }
  if (action === "myVotes") {
    const u = _authUser(e, null);
    if (!u) return _out({ erro: "Faça login" });
    const { header, rows } = _rows("Votes");
    const mine = {};
    rows.forEach(r => { const v = _toObj(header, r); if (String(v.user_id) === String(u.id)) mine[String(v.record_id)] = v.vote; });
    return _out(mine);
  }
  return _out({ erro: "action desconhecida: " + action });
}

// ---------- POST (escritas) ----------
// Serializa escritas: 2 votos/validações simultâneos criavam linhas duplicadas.
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (err) {
    return _out({ erro: "Muita gente escrevendo junto — tente de novo" });
  }
  try {
    return _doPost(e);
  } finally {
    lock.releaseLock();
  }
}
function _doPost(e) {
  let payload;
  try {
    payload = JSON.parse((e.postData && e.postData.contents) || "{}");
  } catch (err) {
    return _out({ erro: "Requisição inválida" });
  }
  if (payload.origem !== ORIGEM_TOKEN && (!e.parameter || e.parameter.origem !== ORIGEM_TOKEN)) {
    return _out({ erro: "Acesso negado. Origem não autorizada." });
  }
  const action = payload.action || "";

  if (action === "register") {
    const nickname = String(payload.nickname || "").trim();
    const email = String(payload.email || "").toLowerCase().trim();
    const pass = String(payload.password || "");
    if (!nickname || !email || pass.length < 4) return _out({ erro: "Dados inválidos" });
    if ([...nickname].length > 22) return _out({ erro: "Nickname até 22 caracteres" });
    const bio = String(payload.bio || "").trim();
    const youtube = String(payload.youtube_url || "").trim();
    if (youtube && !_youtubeOk(youtube)) return _out({ erro: "Link do canal deve ser do YouTube" });
    if (_findUserByEmail(email)) return _out({ erro: "Email já cadastrado" });
    const { header } = _rows("Users");
    const user = { id: Utilities.getUuid(), nickname, email, pass_hash: _hash(pass), role: "user", status: "blocked", bio, youtube_url: youtube, created_at: new Date().toISOString() };
    _append("Users", user, header);
    return _out({ status: "ok", user: _publicUser(user) });
  }

  if (action === "login") {
    const u = _findUserByEmail(payload.email || "");
    if (!u || u.pass_hash !== _hash(String(payload.password || ""))) return _out({ erro: "Login inválido" });
    const token = _newSession(u.id);
    return _out({ status: "ok", token, user: _publicUser(u) });
  }

  if (action === "loginGoogle") {
    // GIS no frontend entrega id_token; validado AQUI (nunca confie no JWT decodificado no browser).
    const idToken = String(payload.id_token || "");
    if (!idToken) return _out({ erro: "Token do Google ausente" });
    let info;
    try {
      const resp = UrlFetchApp.fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(idToken), { muteHttpExceptions: true });
      info = JSON.parse(resp.getContentText());
    } catch (err) {
      return _out({ erro: "Falha ao validar Google" });
    }
    if (!info || info.aud !== GOOGLE_CLIENT_ID) return _out({ erro: "Google inválido" });
    if (info.email_verified !== "true" && info.email_verified !== true) return _out({ erro: "Email do Google não verificado" });
    if (new Date((Number(info.exp) || 0) * 1000) < new Date()) return _out({ erro: "Login expirado" });
    const email = String(info.email || "").toLowerCase().trim();
    const sub = String(info.sub || "");
    if (!email || !sub) return _out({ erro: "Google inválido" });
    const uh = _rows("Users");
    let found = null;
    uh.rows.forEach(r => {
      const x = _toObj(uh.header, r);
      if (!found && (String(x.google_sub || "") === sub || String(x.email).toLowerCase() === email)) found = x;
    });
    const sh = _sheet("Users");
    const vals = sh.getDataRange().getValues();
    const head = vals[0];
    const ci = head.indexOf("google_sub");
    if (found) {
      // vincula o sub (conta cadastrada antes do Google entra pelo email verificado)
      for (let i = 1; i < vals.length; i++) {
        if (String(vals[i][0]) === String(found.id)) {
          if (ci >= 0 && !String(vals[i][ci] || "")) sh.getRange(i + 1, ci + 1).setValue(sub);
          break;
        }
      }
      const token = _newSession(found.id);
      return _out({ status: "ok", token, user: _publicUser(found) });
    }
    // conta nova via Google: bloqueada até o admin liberar (mesmo fluxo do register)
    const nick = String(email.split("@")[0] || "player").slice(0, 22);
    const user = { id: Utilities.getUuid(), nickname: nick, email, pass_hash: "", role: "user", status: "blocked", bio: "", youtube_url: "", google_sub: sub, created_at: new Date().toISOString() };
    _append("Users", user, head);
    const token = _newSession(user.id);
    return _out({ status: "ok", token, user: _publicUser(user) });
  }

  if (action === "logout") {
    const sh = _sheet("Sessions");
    const vals = sh.getDataRange().getValues();
    for (let i = vals.length - 1; i >= 1; i--) {
      if (String(vals[i][0]) === String(payload.token)) sh.deleteRow(i + 1);
    }
    return _out({ status: "ok" });
  }

  if (action === "updateMe") {
    const u = _authUser(e, payload);
    if (!u) return _out({ erro: "Sessão inválida" });
    const sh = _sheet("Users");
    const vals = sh.getDataRange().getValues();
    const head = vals[0];
    const iNick = head.indexOf("nickname");
    for (let i = 1; i < vals.length; i++) {
      if (String(vals[i][0]) === String(u.id)) {
        if (payload.nickname) {
          const nick = String(payload.nickname).trim();
          if ([...nick].length > 22) return _out({ erro: "Nickname até 22 caracteres" });
          sh.getRange(i + 1, iNick + 1).setValue(nick);
        }
        if (payload.bio !== undefined) sh.getRange(i + 1, head.indexOf("bio") + 1).setValue(String(payload.bio));
        if (payload.youtube_url !== undefined) {
          const yt = String(payload.youtube_url).trim();
          if (yt && !_youtubeOk(yt)) return _out({ erro: "Link do canal deve ser do YouTube" });
          sh.getRange(i + 1, head.indexOf("youtube_url") + 1).setValue(yt);
        }
        break;
      }
    }
    return _out({ status: "ok" });
  }

  if (action === "submitRecord") {
    const u = _authUser(e, payload);
    if (!u) return _out({ erro: "Faça login" });
    if ((u.status || "active") !== "active") return _out({ erro: "Conta bloqueada — aguarde liberação do admin" });
    const method = String(payload.method || "");
    if (!METHODS.includes(method)) return _out({ erro: "Informe o método: sem_ajuda ou com_ajuda" });
    if (method === "sem_ajuda" && !String(payload.video_url || "").trim()) return _out({ erro: "Sem ajuda exige vídeo de prova" });
    if (!_urlOk(payload.screenshot_url)) return _out({ erro: "URL do print inválida (use http/https)" });
    if (!_urlOk(payload.video_url)) return _out({ erro: "URL do vídeo inválida (use http/https)" });
    const wind = String(payload.wind || "");
    if (!WINDS.includes(wind)) return _out({ erro: "Informe o vento: normal ou natural" });
    if (!Number.isFinite(Number(payload.score))) return _out({ erro: "Score inválido" });
    const power = Number(payload.power_value);
    const courseId = String(payload.course_id || "");
    const band = payload.powerband_id
      ? (() => { const { header, rows } = _rows("PowerBands"); for (const r of rows) { const b = _toObj(header, r); if (String(b.id) === String(payload.powerband_id)) return b; } return null; })()
      : _bandForPower(power);
    if (!band) return _out({ erro: "Faixa de força não encontrada p/ power_value=" + power });
    if (String(band.active).toUpperCase() !== "TRUE") return _out({ erro: "Faixa desativada" });
    const sh = _sheet("Records");
    const vals = sh.getDataRange().getValues();
    const head = vals[0];
    const col = n => head.indexOf(n) + 1;
    const FIELDS = ["course_id", "powerband_id", "power_value", "score", "pang", "method", "wind", "screenshot_url", "video_url"];
    const data = { course_id: courseId, powerband_id: String(band.id), power_value: power, score: Number(payload.score), pang: Number(payload.pang || 0), method, wind, screenshot_url: String(payload.screenshot_url || ""), video_url: String(payload.video_url || "") };
    // (user, course, força, método) identificam o record.
    // live (approved+comunidade) não é tocado: melhoria vira proposta ligada.
    const hi = n => head.indexOf(n);
    const same = [];
    vals.forEach((r, i) => {
      if (i > 0 && String(r[hi("user_id")]) === String(u.id) && String(r[hi("course_id")]) === courseId && Number(r[hi("power_value")]) === power && String(r[hi("method")] || "com_ajuda") === method && String(r[hi("wind")] || "normal") === wind) same.push(i);
    });
    const pendProp = same.find(i => String(vals[i][hi("status")]) === "pending" && String(vals[i][hi("edit_of")] || "") !== "");
    const clearPending = (idx) => {
      FIELDS.forEach(k => sh.getRange(idx + 1, col(k)).setValue(data[k]));
      sh.getRange(idx + 1, col("status")).setValue("pending");
      sh.getRange(idx + 1, col("validated_by")).setValue("");
      sh.getRange(idx + 1, col("validated_at")).setValue("");
      if (col("is_best") > 0) sh.getRange(idx + 1, col("is_best")).setValue("");
      if (col("edited") > 0) sh.getRange(idx + 1, col("edited")).setValue("TRUE");
    };
    if (pendProp !== undefined) {
      clearPending(pendProp);
      _recalcBest(courseId, String(band.id), method, wind);
      return _out({ status: "ok", id: String(vals[pendProp][hi("id")]), updated: true });
    }
    if (same.some(i => _isLiveRow(head, vals[i]))) {
      const liveIdx = same.find(i => _isLiveRow(head, vals[i]));
      const id = _makeProposal(sh, head, col, liveIdx, vals, u, data);
      return _out({ status: "ok", id, proposal: true });
    }
    const dup = same[0];
    if (dup !== undefined) {
      clearPending(dup);
      _recalcBest(courseId, String(band.id), method, wind);
      return _out({ status: "ok", id: String(vals[dup][hi("id")]), updated: true });
    }
    const rec = Object.assign({ id: Utilities.getUuid(), user_id: u.id, status: "pending", submitted_at: new Date().toISOString(), validated_by: "", validated_at: "", note: "" }, data);
    _append("Records", rec, head); // head já lido acima: sem releitura
    return _out({ status: "ok", id: rec.id });
  }

  if (action === "validateRecord") {
    // admin aprova/rejeita e pode REALOCAR course_id / powerband_id
    const u = _authUser(e, payload);
    if (!u || u.role !== "admin") return _out({ erro: "Só admin" });
    if (!["approved", "rejected"].includes(payload.status)) return _out({ erro: "status inválido" });
    const sh = _sheet("Records");
    const vals = sh.getDataRange().getValues();
    const head = vals[0];
    const col = n => head.indexOf(n) + 1;
    for (let i = 1; i < vals.length; i++) {
      if (String(vals[i][head.indexOf("id")]) === String(payload.id)) {
        const oldCourse = String(vals[i][head.indexOf("course_id")]);
        const oldBand = String(vals[i][head.indexOf("powerband_id")]);
        const oldMethod = String(vals[i][head.indexOf("method")] || "com_ajuda");
        const oldWind = String(vals[i][head.indexOf("wind")] || "normal");
        const origEditOf = String(vals[i][head.indexOf("edit_of")] || "");
        if (payload.method && !METHODS.includes(payload.method)) return _out({ erro: "método inválido" });
        if (payload.wind && !WINDS.includes(payload.wind)) return _out({ erro: "vento inválido" });
        const newMethod = String(payload.method || oldMethod);
        const newWind = String(payload.wind || oldWind);
        sh.getRange(i + 1, col("status")).setValue(payload.status); // approved|rejected
        if (col("is_best") > 0) sh.getRange(i + 1, col("is_best")).setValue(""); // recalc abaixo re-marca se for best
        if (payload.course_id) sh.getRange(i + 1, col("course_id")).setValue(String(payload.course_id));
        if (payload.powerband_id) sh.getRange(i + 1, col("powerband_id")).setValue(String(payload.powerband_id));
        if (payload.method && col("method") > 0) sh.getRange(i + 1, col("method")).setValue(newMethod);
        if (payload.wind && col("wind") > 0) sh.getRange(i + 1, col("wind")).setValue(newWind);
        if (payload.community_ok === true && col("community") > 0) sh.getRange(i + 1, col("community")).setValue("1"); // admin força ok da comunidade
        if (["-1", "0", "1"].includes(String(payload.community ?? "")) && col("community") > 0) sh.getRange(i + 1, col("community")).setValue(String(payload.community)); // admin define: reprovado / não votado / aprovado
        sh.getRange(i + 1, col("validated_by")).setValue(u.nickname);
        sh.getRange(i + 1, col("validated_at")).setValue(new Date().toISOString());
        sh.getRange(i + 1, col("note")).setValue(String(payload.note || ""));
        if (payload.status === "approved" && col("pts_admin") > 0 && String(vals[i][head.indexOf("pts_admin")]) !== "TRUE") {
          sh.getRange(i + 1, col("pts_admin")).setValue("TRUE");
          _addPoints(String(vals[i][head.indexOf("user_id")]), origEditOf ? PTS_IMPROVE_ADMIN : PTS_ADMIN_OK);
        }
        if (payload.status === "approved" && origEditOf) {
          // Aprovação FINAL da proposta (voltou da comunidade): aplica no original e apaga.
          // Na primeira aprovação vai p/ votação da comunidade como record normal.
          const postCom = payload.community_ok === true ? "1" : String(vals[i][head.indexOf("community")] || "0");
          if (postCom !== "1") {
            _recalcBest(oldCourse, oldBand, oldMethod, oldWind);
            _recalcBest(String(payload.course_id || oldCourse), String(payload.powerband_id || oldBand), newMethod, newWind);
            return _out({ status: "ok" });
          }
          // Aprovação final da proposta: aplica no original e apaga a proposta.
          // vals já tem tudo (original não foi tocado); proposta = vals[i] + overrides gravados acima.
          const oi = vals.findIndex((r, k) => k > 0 && String(r[head.indexOf("id")]) === origEditOf);
          if (oi > 0) {
            const ocat = [String(vals[oi][head.indexOf("course_id")]), String(vals[oi][head.indexOf("powerband_id")]), String(vals[oi][head.indexOf("method")] || "com_ajuda"), String(vals[oi][head.indexOf("wind")] || "normal")];
            const eff = _toObj(head, vals[i]);
            if (payload.course_id) eff.course_id = String(payload.course_id);
            if (payload.powerband_id) eff.powerband_id = String(payload.powerband_id);
            if (payload.method) eff.method = newMethod;
            if (payload.wind) eff.wind = newWind;
            eff.note = String(payload.note || "");
            ["course_id", "powerband_id", "power_value", "score", "pang", "method", "wind", "screenshot_url", "video_url", "note"].forEach(k => { if (col(k) > 0) sh.getRange(oi + 1, col(k)).setValue(eff[k]); });
            sh.deleteRow(i + 1);
            _recalcBest(oldCourse, oldBand, oldMethod, oldWind);
            _recalcBest(ocat[0], ocat[1], ocat[2], ocat[3]);
            _recalcBest(String(payload.course_id || oldCourse), String(payload.powerband_id || oldBand), newMethod, newWind);
            return _out({ status: "ok", merged: true });
          } else if (col("edit_of") > 0) {
            sh.getRange(i + 1, col("edit_of")).setValue(""); // original sumiu: vira record normal
          }
        }
        _recalcBest(oldCourse, oldBand, oldMethod, oldWind);
        _recalcBest(String(payload.course_id || oldCourse), String(payload.powerband_id || oldBand), newMethod, newWind);
        return _out({ status: "ok" });
      }
    }
    return _out({ erro: "Record não encontrado" });
  }

  if (action === "updateRecord") {
    // Dono edita o próprio record (volta p/ pending); admin edita qualquer um (mantém status).
    const u = _authUser(e, payload);
    if (!u) return _out({ erro: "Faça login" });
    const isAdmin = u.role === "admin";
    const data = payload.data || {};
    const sh = _sheet("Records");
    const vals = sh.getDataRange().getValues();
    const head = vals[0];
    const col = n => head.indexOf(n) + 1;
    const ri = vals.findIndex((r, i) => i > 0 && String(r[head.indexOf("id")]) === String(payload.id));
    if (ri < 0) return _out({ erro: "Record não encontrado" });
    const rec = _toObj(head, vals[ri]);
    const isOwner = String(rec.user_id) === String(u.id);
    if (!isOwner && !isAdmin) return _out({ erro: "Só o dono pode editar" });
    // valida TUDO antes de escrever: erro nunca deixa escrita parcial
    if (data.method !== undefined && !METHODS.includes(data.method)) return _out({ erro: "método inválido" });
    if (data.wind !== undefined && !WINDS.includes(data.wind)) return _out({ erro: "vento inválido" });
    if (data.score !== undefined && !Number.isFinite(Number(data.score))) return _out({ erro: "Score inválido" });
    if (data.power_value !== undefined && !Number.isFinite(Number(data.power_value))) return _out({ erro: "Força inválida" });
    if (data.screenshot_url !== undefined && !_urlOk(data.screenshot_url)) return _out({ erro: "URL do print inválida (use http/https)" });
    if (data.video_url !== undefined && !_urlOk(data.video_url)) return _out({ erro: "URL do vídeo inválida (use http/https)" });
    // Gerenciar manda direct:true (só vale p/ admin): edita direto qualquer um, inclusive o próprio.
    // Pelo Meus records todo mundo (inclusive admin) segue a regra comum: live vira proposta.
    const direct = isAdmin && payload.direct === true;
    if (isOwner && !direct && _isLiveRow(head, vals[ri])) {
      // Dono melhorando o próprio record live (mesmo sendo admin): vira proposta,
      // original segue valendo. Só admin editando record DE TERCEIROS altera direto.
      if (data.power_value !== undefined && data.powerband_id === undefined) {
        const band = _bandForPower(Number(data.power_value));
        if (!band) return _out({ erro: "Faixa de força não encontrada p/ power_value=" + data.power_value });
        data.powerband_id = String(band.id);
      }
      if (String(data.method || rec.method || "com_ajuda") === "sem_ajuda") {
        const v = data.video_url !== undefined ? String(data.video_url) : String(rec.video_url || "");
        if (!v.trim()) return _out({ erro: "Sem ajuda exige vídeo de prova" });
      }
      const id = _makeProposal(sh, head, col, ri, vals, u, data);
      return _out({ status: "ok", id, proposal: true });
    }
    const FIELDS = ["course_id", "power_value", "score", "pang", "screenshot_url", "video_url"];
    FIELDS.forEach(k => { if (data[k] !== undefined) sh.getRange(ri + 1, col(k)).setValue(data[k]); });
    if (data.wind !== undefined && col("wind") > 0) sh.getRange(ri + 1, col("wind")).setValue(String(data.wind));
    if (data.method !== undefined && col("method") > 0) sh.getRange(ri + 1, col("method")).setValue(String(data.method));
    if (!isAdmin) {
      const effMethod = String(data.method || rec.method || "com_ajuda");
      const effVideo = data.video_url !== undefined ? String(data.video_url) : String(rec.video_url || "");
      if (effMethod === "sem_ajuda" && !effVideo.trim()) return _out({ erro: "Sem ajuda exige vídeo de prova" });
    }
    if (isAdmin && data.note !== undefined) sh.getRange(ri + 1, col("note")).setValue(String(data.note));
    let newBandId = String(rec.powerband_id);
    if (data.powerband_id) {
      newBandId = String(data.powerband_id);
      sh.getRange(ri + 1, col("powerband_id")).setValue(newBandId);
    } else if (data.power_value !== undefined) {
      const band = _bandForPower(Number(data.power_value));
      if (!band) return _out({ erro: "Faixa de força não encontrada p/ power_value=" + data.power_value });
      newBandId = String(band.id);
      sh.getRange(ri + 1, col("powerband_id")).setValue(newBandId);
    }
    if (isOwner && !direct) {
      // Dono reenvia p/ fila (mesmo sendo admin); só Gerenciar (direct) mantém direto.
      sh.getRange(ri + 1, col("status")).setValue("pending");
      sh.getRange(ri + 1, col("validated_by")).setValue("");
      sh.getRange(ri + 1, col("validated_at")).setValue("");
      if (col("is_best") > 0) sh.getRange(ri + 1, col("is_best")).setValue("");
      if (Number(rec.community || 0) !== 0) {
        // Dado mudou depois do voto: os votos valiam p/ outra versão — zera tudo e volta
        // p/ não votado. O admin revisa e a comunidade vota de novo no dado atual.
        // (Apelação sem editar não cai aqui: appealVote não altera dado.)
        if (col("community") > 0) sh.getRange(ri + 1, col("community")).setValue("0");
        const vs = _sheet("Votes");
        const vv = vs.getDataRange().getValues();
        const vhi = n => vv[0].indexOf(n);
        for (let i = vv.length - 1; i > 0; i--) {
          if (String(vv[i][vhi("record_id")]) === String(rec.id)) vs.deleteRow(i + 1);
        }
      }
    }
    if (col("edited") > 0) sh.getRange(ri + 1, col("edited")).setValue("TRUE"); // reenviado após edição
    // categoria nova a partir da memória (rec + data): sem releitura da planilha
    const newCourse = String(data.course_id !== undefined ? data.course_id : rec.course_id);
    const newMethod = String(data.method !== undefined ? data.method : (rec.method || "com_ajuda"));
    const newWind = String(data.wind !== undefined ? data.wind : (rec.wind || "normal"));
    _recalcBest(String(rec.course_id), String(rec.powerband_id), String(rec.method || "com_ajuda"), String(rec.wind || "normal"));
    _recalcBest(newCourse, newBandId, newMethod, newWind);
    return _out({ status: "ok" });
  }

  if (action === "setUserStatus") {
    // admin libera (active) ou bloqueia (blocked) conta p/ envio de records
    const u = _authUser(e, payload);
    if (!u || u.role !== "admin") return _out({ erro: "Só admin" });
    if (!["active", "blocked"].includes(payload.status)) return _out({ erro: "status inválido" });
    if (String(payload.id) === String(u.id)) return _out({ erro: "Não altere a própria conta" });
    const sh = _sheet("Users");
    const vals = sh.getDataRange().getValues();
    const head = vals[0];
    for (let i = 1; i < vals.length; i++) {
      if (String(vals[i][0]) === String(payload.id)) {
        sh.getRange(i + 1, head.indexOf("status") + 1).setValue(payload.status);
        return _out({ status: "ok" });
      }
    }
    return _out({ erro: "Usuário não encontrado" });
  }

  if (action === "vote") {
    const u = _authUser(e, payload);
    if (!u) return _out({ erro: "Faça login" });
    if ((u.status || "active") !== "active") return _out({ erro: "Conta bloqueada" });
    if (!["approve", "reject"].includes(payload.vote)) return _out({ erro: "voto inválido" });
    const rh = _rows("Records");
    const rec = rh.rows.map(r => _toObj(rh.header, r)).find(x => String(x.id) === String(payload.id));
    if (!rec) return _out({ erro: "Record não encontrado" });
    if (String(rec.status) !== "approved" || Number(rec.community || 0) !== 0) return _out({ erro: "Fora de votação" });
    if (String(rec.user_id) === String(u.id)) return _out({ erro: "Não vote no próprio record" });
    const w = _effPoints(u);
    if (w < 10) return _out({ erro: "Sem pontos suficientes (mínimo 10)" });
    // 1 voto por usuário/record (revotar atualiza), peso = pontos atuais
    const vsh = _sheet("Votes");
    const vv = vsh.getDataRange().getValues();
    const vh = vv[0];
    let found = false;
    for (let i = 1; i < vv.length; i++) {
      if (String(vv[i][vh.indexOf("record_id")]) === String(payload.id) && String(vv[i][vh.indexOf("user_id")]) === String(u.id)) {
        vsh.getRange(i + 1, vh.indexOf("vote") + 1).setValue(payload.vote);
        vsh.getRange(i + 1, vh.indexOf("weight") + 1).setValue(w);
        found = true;
        break;
      }
    }
    if (!found) {
      _append("Votes", { id: Utilities.getUuid(), record_id: String(payload.id), user_id: u.id, vote: payload.vote, weight: w, created_at: new Date().toISOString() }, vh); // vh já lido acima
    }
    const t = _tally(payload.id);
    let decided = null;
    if (t.approve >= VOTE_QUORUM && t.voters >= VOTE_MIN_VOTERS && t.approve > 2 * t.reject) decided = "approved";
    else if (t.reject >= VOTE_QUORUM && t.voters >= VOTE_MIN_VOTERS && t.reject > 2 * t.approve) decided = "rejected";
    if (decided) {
      const sh = _sheet("Records");
      const vals = sh.getDataRange().getValues();
      const head = vals[0];
      const col = n => head.indexOf(n) + 1;
      const ri = vals.findIndex((r, i) => i > 0 && String(r[head.indexOf("id")]) === String(payload.id));
      if (decided === "approved") {
        sh.getRange(ri + 1, col("status")).setValue("pending"); // volta p/ fila final do admin
        sh.getRange(ri + 1, col("validated_by")).setValue("");
        sh.getRange(ri + 1, col("validated_at")).setValue("");
        if (col("community") > 0) sh.getRange(ri + 1, col("community")).setValue("1");
        if (col("pts_com") > 0 && String(vals[ri][head.indexOf("pts_com")]) !== "TRUE") {
          sh.getRange(ri + 1, col("pts_com")).setValue("TRUE");
          const isProp = String(vals[ri][head.indexOf("edit_of")] || "") !== "";
          _addPoints(String(vals[ri][head.indexOf("user_id")]), isProp ? PTS_IMPROVE_COM : PTS_COM_OK);
        }
      } else {
        // Rejeitado pela comunidade: volta p/ fila do admin como pedido (pending + -1),
        // igual ao aprovado — palavra final é do admin (confirma, força ok ou reabre).
        sh.getRange(ri + 1, col("status")).setValue("pending");
        sh.getRange(ri + 1, col("validated_by")).setValue("");
        sh.getRange(ri + 1, col("validated_at")).setValue("");
        if (col("community") > 0) sh.getRange(ri + 1, col("community")).setValue("-1");
      }
      _recalcBest(String(vals[ri][head.indexOf("course_id")]), String(vals[ri][head.indexOf("powerband_id")]), String(vals[ri][head.indexOf("method")] || "com_ajuda"), String(vals[ri][head.indexOf("wind")] || "normal"));
    }
    return _out({ status: "ok", vote: payload.vote, tally: t, decided });
  }

  if (action === "appealVote") {
    // Dono pede reavaliação de rejeição confirmada (approved/-1) sem precisar editar nada:
    // volta p/ pending (fila do admin), comunidade segue -1, marca edited. Só sai do
    // pending pelo admin (confirma, força ok ou reabre). Sem spam: já na fila não apela.
    const u = _authUser(e, payload);
    if (!u) return _out({ erro: "Faça login" });
    const sh = _sheet("Records");
    const vals = sh.getDataRange().getValues();
    const head = vals[0];
    const col = n => head.indexOf(n) + 1;
    const ri = vals.findIndex((r, i) => i > 0 && String(r[head.indexOf("id")]) === String(payload.id));
    if (ri < 0) return _out({ erro: "Record não encontrado" });
    const rec = _toObj(head, vals[ri]);
    if (String(rec.user_id) !== String(u.id)) return _out({ erro: "Só o dono pode pedir" });
    if (String(rec.status) !== "approved" || Number(rec.community || 0) !== -1) return _out({ erro: "Só rejeição confirmada" });
    sh.getRange(ri + 1, col("status")).setValue("pending");
    if (col("edited") > 0) sh.getRange(ri + 1, col("edited")).setValue("TRUE");
    return _out({ status: "ok" });
  }

  if (action === "reopenVote") {
    // Admin reabre votação: rejeitado confirmado (-1, approved|pending) ou final pendente (1,
    // pending) voltam p/ approved/0 (fila da Comunidade) e os votos são apagados.
    // Record já publicado no index (approved/1) não reabre por aqui (usar o Gerenciar).
    // Rejeição/aprovação não pagam pontos aqui, então nada a estornar (pts_com só paga 1x).
    const u = _authUser(e, payload);
    if (!u || u.role !== "admin") return _out({ erro: "Só admin" });
    const sh = _sheet("Records");
    const vals = sh.getDataRange().getValues();
    const head = vals[0];
    const col = n => head.indexOf(n) + 1;
    const ri = vals.findIndex((r, i) => i > 0 && String(r[head.indexOf("id")]) === String(payload.id));
    if (ri < 0) return _out({ erro: "Record não encontrado" });
    const st = String(vals[ri][head.indexOf("status")]);
    const com = Number(vals[ri][head.indexOf("community")] || 0);
    const ok = (com === -1 && (st === "approved" || st === "pending")) || (com === 1 && st === "pending");
    if (!ok) return _out({ erro: "Só pedido pendente votado ou rejeitado confirmado" });
    sh.getRange(ri + 1, col("status")).setValue("approved");
    sh.getRange(ri + 1, col("community")).setValue("0");
    const vs = _sheet("Votes");
    const vv = vs.getDataRange().getValues();
    const vhi = n => vv[0].indexOf(n);
    for (let i = vv.length - 1; i > 0; i--) {
      if (String(vv[i][vhi("record_id")]) === String(payload.id)) vs.deleteRow(i + 1);
    }
    return _out({ status: "ok" });
  }

  if (action === "upsertBand" || action === "upsertCourse") {
    const u = _authUser(e, payload);
    if (!u || u.role !== "admin") return _out({ erro: "Só admin" });
    const sheetName = action === "upsertBand" ? "PowerBands" : "Courses";
    const nameKey = action === "upsertBand" ? "label" : "name";
    const norm = (s) => String(s == null ? "" : s).trim().toLowerCase();
    const sh = _sheet(sheetName);
    const vals = sh.getDataRange().getValues();
    const head = vals[0];
    const nameCol = head.indexOf(nameKey);
    if (payload.data && payload.data[nameKey] != null) payload.data[nameKey] = String(payload.data[nameKey]).trim();
    for (let i = 1; i < vals.length; i++) {
      if (String(vals[i][0]) === String(payload.id)) {
        // EDIT por id: não deixa renomear p/ nome de OUTRO
        const newName = payload.data && payload.data[nameKey] != null ? norm(payload.data[nameKey]) : "";
        if (newName) {
          for (let j = 1; j < vals.length; j++) {
            if (j !== i && norm(vals[j][nameCol]) === newName) return _out({ erro: "Nome já existe" });
          }
        }
        Object.keys(payload.data || {}).forEach(k => {
          const c = head.indexOf(k);
          if (c >= 0) sh.getRange(i + 1, c + 1).setValue(payload.data[k]);
        });
        return _out({ status: "ok", updated: true });
      }
    }
    // ADD idempotente por nome: duplo clique / retry / lentidão não duplica
    if (payload.data && payload.data[nameKey] != null) {
      const nn = norm(payload.data[nameKey]);
      for (let i = 1; i < vals.length; i++) {
        if (nn && norm(vals[i][nameCol]) === nn) return _out({ status: "ok", id: String(vals[i][0]), deduped: true });
      }
    }
    const row = Object.assign({ id: payload.id || Utilities.getUuid() }, payload.data);
    _append(sheetName, row, head); // head já lido acima: sem releitura
    return _out({ status: "ok", id: row.id });
  }

  if (action === "deleteBand" || action === "deleteCourse") {
    const u = _authUser(e, payload);
    if (!u || u.role !== "admin") return _out({ erro: "Só admin" });
    if (action === "deleteCourse") {
      const rh = _rows("Records");
      if (rh.rows.some(r => String(_toObj(rh.header, r).course_id) === String(payload.id))) {
        return _out({ erro: "Em uso por records — desative em vez de excluir" });
      }
    } else {
      // deleteBand: records da faixa são realocados p/ outra faixa ativa que englobe a força
      const bh = _rows("PowerBands");
      const bands = bh.rows.map(r => _toObj(bh.header, r));
      const sh = _sheet("Records");
      const vals = sh.getDataRange().getValues();
      const head = vals[0];
      const moves = [];
      for (let i = 1; i < vals.length; i++) {
        if (String(vals[i][head.indexOf("powerband_id")]) !== String(payload.id)) continue;
        const pv = Number(vals[i][head.indexOf("power_value")]);
        const other = bands.find(b => String(b.id) !== String(payload.id) && String(b.active).toUpperCase() === "TRUE" && pv >= Number(b.min) && pv <= Number(b.max));
        if (!other) return _out({ erro: "Força " + pv + " não cabe em outra faixa ativa — crie uma que englobe antes" });
        moves.push({ row: i + 1, band: String(other.id) });
      }
      moves.forEach(m => sh.getRange(m.row, head.indexOf("powerband_id") + 1).setValue(m.band));
      const cats = {};
      moves.forEach(m => {
        const r = _toObj(head, vals[m.row - 1]); // vals já em memória: sem releitura por move
        const mt = String(r.method || "com_ajuda"), wd = String(r.wind || "normal");
        cats[String(r.course_id) + "|" + String(payload.id) + "|" + mt + "|" + wd] = [String(r.course_id), String(payload.id), mt, wd];
        cats[String(r.course_id) + "|" + m.band + "|" + mt + "|" + wd] = [String(r.course_id), m.band, mt, wd];
      });
      Object.values(cats).forEach(([c, b, mt, wd]) => _recalcBest(c, b, mt, wd));
      const bsh = _sheet("PowerBands");
      const bvals = bsh.getDataRange().getValues();
      for (let i = 1; i < bvals.length; i++) {
        if (String(bvals[i][0]) === String(payload.id)) { bsh.deleteRow(i + 1); return _out({ status: "ok", realocados: moves.length }); }
      }
      return _out({ erro: "Não encontrado" });
    }
    const sh = _sheet("Courses");
    const vals = sh.getDataRange().getValues();
    for (let i = 1; i < vals.length; i++) {
      if (String(vals[i][0]) === String(payload.id)) { sh.deleteRow(i + 1); return _out({ status: "ok" }); }
    }
    return _out({ erro: "Não encontrado" });
  }

  return _out({ erro: "action desconhecida: " + action });
}
