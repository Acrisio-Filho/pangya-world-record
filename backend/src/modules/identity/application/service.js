// Application service: all outgoing dependencies are injected by the composition root.
function createIdentityModule(ports) {
  const { GOOGLE_CLIENT_ID, googleIdentity, ids, _append, _authUser, _effPoints, _findUserByEmail, _findUserById, _hash, _isAdmin, _newSession, _page, _publicUser, _recalcBest, _rows, _table, _toObj, _youtubeOk } = ports;
  const respond = value => value;
  const passwordOk = pass => pass.length >= 8 && /[A-Z]/.test(pass) && /[A-Za-z]/.test(pass) && /\d/.test(pass) && /[^A-Za-z0-9\s]/.test(pass);
  const nicknameTaken = (nickname, exceptId) => {
    const { header, rows } = _rows("Users");
    const target = String(nickname || "").toLowerCase();
    return rows.some(r => {
      const user = _toObj(header, r);
      return String(user.id) !== String(exceptId || "") && String(user.nickname || "").toLowerCase() === target;
    });
  };
  return function execute(action, e, payload = {}) {
  if (action === "getUser") {
    const u = _findUserById(e.parameter.id);
    if (!u) return respond({ erro: "Usuário não encontrado" });
    return respond(_publicUser(u));
  }
  if (action === "getMe") {
    const u = _authUser(e, null);
    if (!u) return respond({ erro: "Sessão inválida" });
    // E-mail só retorna ao titular autenticado: necessário para confirmar ações da conta.
    return respond({ ..._publicUser(u), email: u.email });
  }
  if (action === "listUsers") {
    if (!_isAdmin(e)) return respond({ erro: "Só admin" });
    const { header, rows } = _rows("Users");
    return respond(_page(rows.map(r => { const u = _toObj(header, r); return { id: u.id, nickname: u.nickname, email: u.email, role: u.role, status: u.status || "active", bio: u.bio || "", youtube_url: u.youtube_url || "", points: _effPoints(u), created_at: u.created_at }; }), e.parameter));
  }
  if (action === "register") {
    const nickname = String(payload.nickname || "").trim();
    const email = String(payload.email || "").toLowerCase().trim();
    const pass = String(payload.password || "");
    if (!nickname || !email) return respond({ erro: "Dados inválidos" });
    if (!passwordOk(pass)) return respond({ erro: "Para proteger sua conta, use 8+ caracteres com letra maiúscula, número e símbolo" });
    if ([...nickname].length > 22) return respond({ erro: "Nickname até 22 caracteres" });
    if (nicknameTaken(nickname)) return respond({ erro: "Este nickname já está em uso." });
    const bio = String(payload.bio || "").trim();
    const youtube = String(payload.youtube_url || "").trim();
    if (youtube && !_youtubeOk(youtube)) return respond({ erro: "Link do canal deve ser do YouTube" });
    if (_findUserByEmail(email)) return respond({ erro: "Email já cadastrado" });
    const { header } = _rows("Users");
    const user = { id: ids.next(), nickname, email, pass_hash: _hash(pass), role: "user", status: "blocked", bio, youtube_url: youtube, created_at: new Date().toISOString() };
    _append("Users", user, header);
    return respond({ status: "ok", user: _publicUser(user) });
  }
  if (action === "login") {
    const u = _findUserByEmail(payload.email || "");
    if (!u || u.pass_hash !== _hash(String(payload.password || ""))) return respond({ erro: "Login inválido" });
    const token = _newSession(u.id);
    return respond({ status: "ok", token, user: _publicUser(u) });
  }
  if (action === "loginGoogle") {
    // GIS no frontend entrega id_token; validado AQUI (nunca confie no JWT decodificado no browser).
    const idToken = String(payload.id_token || "");
    if (!idToken) return respond({ erro: "Token do Google ausente" });
    let info;
    try {
      info = googleIdentity.verify(idToken);
    } catch (err) {
      return respond({ erro: "Falha ao validar Google" });
    }
    if (!info || info.aud !== GOOGLE_CLIENT_ID) return respond({ erro: "Google inválido" });
    if (info.email_verified !== "true" && info.email_verified !== true) return respond({ erro: "Email do Google não verificado" });
    if (new Date((Number(info.exp) || 0) * 1000) < new Date()) return respond({ erro: "Login expirado" });
    const email = String(info.email || "").toLowerCase().trim();
    const sub = String(info.sub || "");
    if (!email || !sub) return respond({ erro: "Google inválido" });
    const uh = _rows("Users");
    let found = null;
    uh.rows.forEach(r => {
      const x = _toObj(uh.header, r);
      if (!found && (String(x.google_sub || "") === sub || String(x.email).toLowerCase() === email)) found = x;
    });
    // A imagem vem da resposta já validada pelo Google, nunca do navegador.
    const avatarUrl = /^https:\/\/[^\s<>"'`]+$/i.test(String(info.picture || "")) ? String(info.picture) : "";
    const sh = _table("Users");
    const vals = sh.read();
    const head = vals[0];
    const ci = head.indexOf("google_sub");
    const avatarCol = head.indexOf("avatar_url");
    if (found) {
      // vincula o sub (conta cadastrada antes do Google entra pelo email verificado)
      for (let i = 1; i < vals.length; i++) {
        if (String(vals[i][0]) === String(found.id)) {
          if (ci >= 0 && !String(vals[i][ci] || "")) sh.range(i + 1, ci + 1).write(sub);
          if (avatarCol >= 0 && avatarUrl) sh.range(i + 1, avatarCol + 1).write(avatarUrl);
          break;
        }
      }
      if (avatarUrl) found.avatar_url = avatarUrl;
      const token = _newSession(found.id);
      return respond({ status: "ok", token, user: _publicUser(found) });
    }
    // conta nova via Google: bloqueada até o admin liberar (mesmo fluxo do register)
    // Usa a parte local do e-mail (antes do último @) como nickname inicial.
    // O e-mail já foi validado pelo Google; ainda limitamos o nome à regra do produto.
    const at = email.lastIndexOf("@");
    const nicknameBase = (at > 0 ? email.slice(0, at) : email).slice(0, 22) || "player";
    const nicknames = {};
    uh.rows.forEach(r => { const x = _toObj(uh.header, r); nicknames[String(x.nickname || "").toLowerCase()] = true; });
    let nick = nicknameBase;
    if (nicknames[nick.toLowerCase()]) {
      const numbered = nicknameBase.match(/^(.*?)(\d+)$/);
      const stem = numbered ? numbered[1] : nicknameBase;
      let next = numbered ? Number(numbered[2]) + 1 : 2;
      let attempts = 0;
      do {
        const suffix = String(next++);
        nick = (stem.slice(0, Math.max(1, 22 - suffix.length)) + suffix).slice(0, 22);
        attempts++;
      } while (nicknames[nick.toLowerCase()] && attempts < 10000);
      // Uma planilha com todas as 10 mil variações ocupadas é improvável; o
      // e-mail verificado é uma alternativa estável e única para esse caso.
      if (nicknames[nick.toLowerCase()]) nick = email;
    }
    const user = { id: ids.next(), nickname: nick, email, pass_hash: "", role: "user", status: "blocked", bio: "", youtube_url: "", avatar_url: avatarUrl, google_sub: sub, created_at: new Date().toISOString() };
    _append("Users", user, head);
    const token = _newSession(user.id);
    return respond({ status: "ok", token, user: _publicUser(user) });
  }
  if (action === "logout") {
    const sh = _table("Sessions");
    const vals = sh.read();
    for (let i = vals.length - 1; i >= 1; i--) {
      if (String(vals[i][0]) === String(payload.token)) sh.remove(i + 1);
    }
    return respond({ status: "ok" });
  }
  if (action === "updateMe") {
    const u = _authUser(e, payload);
    if (!u) return respond({ erro: "Sessão inválida" });
    const sh = _table("Users");
    const vals = sh.read();
    const head = vals[0];
    const iNick = head.indexOf("nickname");
    for (let i = 1; i < vals.length; i++) {
      if (String(vals[i][0]) === String(u.id)) {
        if (payload.nickname) {
          const nick = String(payload.nickname).trim();
          if (!nick) return respond({ erro: "Nickname inválido" });
          if ([...nick].length > 22) return respond({ erro: "Nickname até 22 caracteres" });
          if (nicknameTaken(nick, u.id)) return respond({ erro: "Este nickname já está em uso." });
          sh.range(i + 1, iNick + 1).write(nick);
        }
        if (payload.bio !== undefined) sh.range(i + 1, head.indexOf("bio") + 1).write(String(payload.bio));
        if (payload.youtube_url !== undefined) {
          const yt = String(payload.youtube_url).trim();
          if (yt && !_youtubeOk(yt)) return respond({ erro: "Link do canal deve ser do YouTube" });
          sh.range(i + 1, head.indexOf("youtube_url") + 1).write(yt);
        }
        break;
      }
    }
    return respond({ status: "ok" });
  }
  if (action === "changePassword") {
    const u = _authUser(e, payload);
    if (!u) return respond({ erro: "Sessão inválida" });
    if (String(u.pass_hash || "") && u.pass_hash !== _hash(String(payload.current_password || ""))) return respond({ erro: "A senha atual não confere." });
    const next = String(payload.new_password || "");
    if (!passwordOk(next)) return respond({ erro: "Para proteger sua conta, use 8+ caracteres com letra maiúscula, número e símbolo" });
    const sh = _table("Users"), vals = sh.read(), head = vals[0], passCol = head.indexOf("pass_hash");
    for (let i = 1; i < vals.length; i++) if (String(vals[i][0]) === String(u.id)) sh.range(i + 1, passCol + 1).write(_hash(next));
    return respond({ status: "ok" });
  }
  if (action === "deleteMe") {
    const u = _authUser(e, payload);
    if (!u) return respond({ erro: "Sessão inválida" });
    if (String(payload.email || "").toLowerCase().trim() !== String(u.email || "").toLowerCase().trim()) return respond({ erro: "Informe o e-mail desta conta para confirmar." });
    if (!String(u.pass_hash || "")) return respond({ erro: "Defina uma senha antes de excluir uma conta vinculada ao Google." });
    if (u.pass_hash !== _hash(String(payload.password || ""))) return respond({ erro: "A senha não confere." });
    const records = _table("Records"), recordVals = records.read(), recordHead = recordVals[0] || [];
    const categories = {};
    const deletedRecordIds = {};
    for (let i = recordVals.length - 1; i >= 1; i--) {
      const row = recordVals[i];
      if (String(row[recordHead.indexOf("user_id")]) === String(u.id)) {
        deletedRecordIds[String(row[recordHead.indexOf("id")])] = true;
        const key = [row[recordHead.indexOf("course_id")], row[recordHead.indexOf("powerband_id")], row[recordHead.indexOf("method")] || "com_ajuda", row[recordHead.indexOf("wind")] || "normal"].map(String);
        categories[key.join("|")] = key;
        records.remove(i + 1);
      }
    }
    const votes = _table("Votes"), voteVals = votes.read(), voteHead = voteVals[0] || [];
    for (let i = voteVals.length - 1; i >= 1; i--) if (String(voteVals[i][voteHead.indexOf("user_id")]) === String(u.id) || deletedRecordIds[String(voteVals[i][voteHead.indexOf("record_id")])]) votes.remove(i + 1);
    const sessions = _table("Sessions"), sessionVals = sessions.read();
    for (let i = sessionVals.length - 1; i >= 1; i--) if (String(sessionVals[i][1]) === String(u.id)) sessions.remove(i + 1);
    const users = _table("Users"), userVals = users.read();
    for (let i = userVals.length - 1; i >= 1; i--) if (String(userVals[i][0]) === String(u.id)) users.remove(i + 1);
    Object.values(categories).forEach(c => _recalcBest(c[0], c[1], c[2], c[3]));
    return respond({ status: "ok" });
  }
  if (action === "setUserStatus") {
    // admin libera (active) ou bloqueia (blocked) conta p/ envio de records
    const u = _authUser(e, payload);
    if (!u || u.role !== "admin") return respond({ erro: "Só admin" });
    if (!["active", "blocked"].includes(payload.status)) return respond({ erro: "status inválido" });
    if (String(payload.id) === String(u.id)) return respond({ erro: "Não altere a própria conta" });
    const sh = _table("Users");
    const vals = sh.read();
    const head = vals[0];
    for (let i = 1; i < vals.length; i++) {
      if (String(vals[i][0]) === String(payload.id)) {
        sh.range(i + 1, head.indexOf("status") + 1).write(payload.status);
        return respond({ status: "ok" });
      }
    }
    return respond({ erro: "Usuário não encontrado" });
  }
  if (action === "adminResetPassword") {
    const admin = _authUser(e, payload);
    if (!admin || admin.role !== "admin") return respond({ erro: "Só admin" });
    const target = _findUserById(payload.id);
    if (!target) return respond({ erro: "Usuário não encontrado" });
    if (String(target.id) === String(admin.id)) return respond({ erro: "Use a aba Segurança para alterar sua própria senha." });
    const next = String(payload.new_password || "");
    if (!passwordOk(next)) return respond({ erro: "Para proteger a conta, use 8+ caracteres com letra maiúscula, número e símbolo" });
    const users = _table("Users"), userVals = users.read(), userHead = userVals[0] || [], passCol = userHead.indexOf("pass_hash");
    for (let i = 1; i < userVals.length; i++) if (String(userVals[i][0]) === String(target.id)) users.range(i + 1, passCol + 1).write(_hash(next));
    // A senha anterior deixa de valer imediatamente em todos os dispositivos.
    const sessions = _table("Sessions"), sessionVals = sessions.read();
    for (let i = sessionVals.length - 1; i >= 1; i--) if (String(sessionVals[i][1]) === String(target.id)) sessions.remove(i + 1);
    return respond({ status: "ok" });
  }
    throw new Error("Unsupported identity action: " + action);
  };
}
