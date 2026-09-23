// Application service: all outgoing dependencies are injected by the composition root.
function createRecordsModule(ports) {
  const { METHODS, PTS_ADMIN_OK, PTS_IMPROVE_ADMIN, RecordPolicy, RecordDraft, ids, WINDS, _addPoints, _append, _authUser, _bandForPower, _isLiveRow, _makeProposal, _page, _recalcBest, _rows, _table, _toObj, _urlOk } = ports;
  const respond = value => value;
  return function execute(action, e, payload = {}) {
  if (action === "listRecords") {
    // filtros públicos: course_id, powerband_id, nickname, status default=approved
    // resposta inclui `nickname` do dono p/ linkar o perfil
    // não-approved (pending/rejected/all) só dono ou admin
    const p = e.parameter;
    const status = p.status || "approved";
    if (status !== "approved") {
      const me = _authUser(e, null);
      const mine = p.user_id && me && String(me.id) === String(p.user_id);
      if (!mine && !(me && me.role === "admin")) return respond({ erro: "Só dono ou admin" });
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
    recs.sort(RecordPolicy.compare);
    const mapped = recs.map(x => Object.assign({}, x, { nickname: String((users[String(x.user_id)] || {}).nickname || "") }));
    return respond(_page(mapped, p));
  }
  if (action === "listPending") {
    const u = _authUser(e, null);
    if (!u || u.role !== "admin") return respond({ erro: "Só admin" });
    const { header, rows } = _rows("Records");
    const uh = _rows("Users");
    const names = {};
    uh.rows.forEach(r => { const x = _toObj(uh.header, r); names[String(x.id)] = String(x.nickname || ""); });
    return respond(_page(rows.map(r => _toObj(header, r)).filter(x => String(x.status) === "pending")
      .map(x => Object.assign({}, x, { nickname: names[String(x.user_id)] || "" })), e.parameter));
  }
  if (action === "submitRecord") {
    const u = _authUser(e, payload);
    if (!u) return respond({ erro: "Faça login" });
    if ((u.status || "active") !== "active") return respond({ erro: "Conta bloqueada — aguarde liberação do admin" });
    let draft;
    try { draft = RecordDraft(payload); } catch (error) { return respond({ erro: error.message }); }
    const { method, wind } = draft;
    const power = draft.power_value;
    const courseId = draft.course_id;
    const courses = _rows("Courses");
    if (!courses.rows.some(row => { const course = _toObj(courses.header, row); return String(course.id) === courseId && String(course.active).toUpperCase() === "TRUE"; })) return respond({ erro: "Campo não encontrado ou desativado" });
    const band = payload.powerband_id
      ? (() => { const { header, rows } = _rows("PowerBands"); for (const r of rows) { const b = _toObj(header, r); if (String(b.id) === String(payload.powerband_id)) return b; } return null; })()
      : _bandForPower(power);
    if (!band) return respond({ erro: "Faixa de força não encontrada p/ power_value=" + power });
    if (String(band.active).toUpperCase() !== "TRUE") return respond({ erro: "Faixa desativada" });
    const sh = _table("Records");
    const vals = sh.read();
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
      FIELDS.forEach(k => sh.range(idx + 1, col(k)).write(data[k]));
      sh.range(idx + 1, col("status")).write("pending");
      sh.range(idx + 1, col("validated_by")).write("");
      sh.range(idx + 1, col("validated_at")).write("");
      if (col("is_best") > 0) sh.range(idx + 1, col("is_best")).write("");
      if (col("edited") > 0) sh.range(idx + 1, col("edited")).write("TRUE");
      if (col("community") > 0) sh.range(idx + 1, col("community")).write("0");
      const votes = _table("Votes");
      const previous = votes.read();
      for (let i = previous.length - 1; i > 0; i--) {
        if (String(previous[i][previous[0].indexOf("record_id")]) === String(vals[idx][hi("id")])) votes.remove(i + 1);
      }
    };
    if (pendProp !== undefined) {
      clearPending(pendProp);
      _recalcBest(courseId, String(band.id), method, wind);
      return respond({ status: "ok", id: String(vals[pendProp][hi("id")]), updated: true });
    }
    if (same.some(i => _isLiveRow(head, vals[i]))) {
      const liveIdx = same.find(i => _isLiveRow(head, vals[i]));
      const id = _makeProposal(sh, head, col, liveIdx, vals, u, data);
      return respond({ status: "ok", id, proposal: true });
    }
    const dup = same[0];
    if (dup !== undefined) {
      clearPending(dup);
      _recalcBest(courseId, String(band.id), method, wind);
      return respond({ status: "ok", id: String(vals[dup][hi("id")]), updated: true });
    }
    const rec = Object.assign({ id: ids.next(), user_id: u.id, status: "pending", submitted_at: new Date().toISOString(), validated_by: "", validated_at: "", note: "" }, data);
    _append("Records", rec, head); // head já lido acima: sem releitura
    return respond({ status: "ok", id: rec.id });
  }
  if (action === "validateRecord") {
    // admin aprova/rejeita e pode REALOCAR course_id / powerband_id
    const u = _authUser(e, payload);
    if (!u || u.role !== "admin") return respond({ erro: "Só admin" });
    if (!["approved", "rejected"].includes(payload.status)) return respond({ erro: "status inválido" });
    const sh = _table("Records");
    const vals = sh.read();
    const head = vals[0];
    const col = n => head.indexOf(n) + 1;
    for (let i = 1; i < vals.length; i++) {
      if (String(vals[i][head.indexOf("id")]) === String(payload.id)) {
        const oldCourse = String(vals[i][head.indexOf("course_id")]);
        const oldBand = String(vals[i][head.indexOf("powerband_id")]);
        const oldMethod = String(vals[i][head.indexOf("method")] || "com_ajuda");
        const oldWind = String(vals[i][head.indexOf("wind")] || "normal");
        const origEditOf = String(vals[i][head.indexOf("edit_of")] || "");
        if (payload.method && !METHODS.includes(payload.method)) return respond({ erro: "método inválido" });
        if (payload.wind && !WINDS.includes(payload.wind)) return respond({ erro: "vento inválido" });
        const newMethod = String(payload.method || oldMethod);
        const newWind = String(payload.wind || oldWind);
        const requestedCommunity = ["-1", "0", "1"].includes(String(payload.community ?? "")) ? String(payload.community) : null;
        // "Approved by community" is a final publication state. Keeping a
        // pending/rejected status here made the row invisible to BEST despite
        // the admin explicitly publishing it through the manual form.
        const finalStatus = requestedCommunity === "1" ? "approved" : payload.status;
        sh.range(i + 1, col("status")).write(finalStatus); // approved|rejected
        if (col("is_best") > 0) sh.range(i + 1, col("is_best")).write(""); // recalc abaixo re-marca se for best
        if (payload.course_id) sh.range(i + 1, col("course_id")).write(String(payload.course_id));
        if (payload.powerband_id) sh.range(i + 1, col("powerband_id")).write(String(payload.powerband_id));
        if (payload.method && col("method") > 0) sh.range(i + 1, col("method")).write(newMethod);
        if (payload.wind && col("wind") > 0) sh.range(i + 1, col("wind")).write(newWind);
        if (payload.community_ok === true && col("community") > 0) sh.range(i + 1, col("community")).write("1"); // admin força ok da comunidade
        if (requestedCommunity && col("community") > 0) sh.range(i + 1, col("community")).write(requestedCommunity); // admin define: reprovado / não votado / aprovado
        sh.range(i + 1, col("validated_by")).write(u.nickname);
        sh.range(i + 1, col("validated_at")).write(new Date().toISOString());
        sh.range(i + 1, col("note")).write(String(payload.note || ""));
        if (finalStatus === "approved" && col("pts_admin") > 0 && String(vals[i][head.indexOf("pts_admin")]) !== "TRUE") {
          sh.range(i + 1, col("pts_admin")).write("TRUE");
          _addPoints(String(vals[i][head.indexOf("user_id")]), origEditOf ? PTS_IMPROVE_ADMIN : PTS_ADMIN_OK);
        }
        if (finalStatus === "approved" && origEditOf) {
          // Aprovação FINAL da proposta (voltou da comunidade): aplica no original e apaga.
          // Na primeira aprovação vai p/ votação da comunidade como record normal.
          const postCom = payload.community_ok === true || requestedCommunity === "1" ? "1" : String(vals[i][head.indexOf("community")] || "0");
          if (postCom !== "1") {
            _recalcBest(oldCourse, oldBand, oldMethod, oldWind);
            _recalcBest(String(payload.course_id || oldCourse), String(payload.powerband_id || oldBand), newMethod, newWind);
            return respond({ status: "ok" });
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
            ["course_id", "powerband_id", "power_value", "score", "pang", "method", "wind", "screenshot_url", "video_url", "note"].forEach(k => { if (col(k) > 0) sh.range(oi + 1, col(k)).write(eff[k]); });
            sh.remove(i + 1);
            _recalcBest(oldCourse, oldBand, oldMethod, oldWind);
            _recalcBest(ocat[0], ocat[1], ocat[2], ocat[3]);
            _recalcBest(String(payload.course_id || oldCourse), String(payload.powerband_id || oldBand), newMethod, newWind);
            return respond({ status: "ok", merged: true });
          } else if (col("edit_of") > 0) {
            sh.range(i + 1, col("edit_of")).write(""); // original sumiu: vira record normal
          }
        }
        _recalcBest(oldCourse, oldBand, oldMethod, oldWind);
        _recalcBest(String(payload.course_id || oldCourse), String(payload.powerband_id || oldBand), newMethod, newWind);
        return respond({ status: "ok" });
      }
    }
    return respond({ erro: "Record não encontrado" });
  }
  if (action === "updateRecord") {
    // Dono edita o próprio record (volta p/ pending); admin edita qualquer um (mantém status).
    const u = _authUser(e, payload);
    if (!u) return respond({ erro: "Faça login" });
    const isAdmin = u.role === "admin";
    const data = payload.data || {};
    const sh = _table("Records");
    const vals = sh.read();
    const head = vals[0];
    const col = n => head.indexOf(n) + 1;
    const ri = vals.findIndex((r, i) => i > 0 && String(r[head.indexOf("id")]) === String(payload.id));
    if (ri < 0) return respond({ erro: "Record não encontrado" });
    const rec = _toObj(head, vals[ri]);
    const isOwner = String(rec.user_id) === String(u.id);
    if (!isOwner && !isAdmin) return respond({ erro: "Só o dono pode editar" });
    if ((u.status || "active") !== "active") return respond({ erro: "Conta bloqueada — aguarde liberação do admin" });
    // Validate the complete proposed version before any persistence operation.
    try { RecordDraft(Object.assign({}, rec, data)); } catch (error) { return respond({ erro: error.message }); }
    if (data.course_id !== undefined) {
      const courses = _rows("Courses");
      if (!courses.rows.some(row => { const course = _toObj(courses.header, row); return String(course.id) === String(data.course_id) && String(course.active).toUpperCase() === "TRUE"; })) return respond({ erro: "Campo não encontrado ou desativado" });
    }
    let resolvedBand = null;
    if (data.powerband_id) {
      const bands = _rows("PowerBands");
      resolvedBand = bands.rows.map(row => _toObj(bands.header, row)).find(band => String(band.id) === String(data.powerband_id));
    } else if (data.power_value !== undefined) resolvedBand = _bandForPower(Number(data.power_value));
    if ((data.powerband_id || data.power_value !== undefined) && !resolvedBand) return respond({ erro: "Faixa de força não encontrada p/ power_value=" + data.power_value });
    if (resolvedBand && String(resolvedBand.active).toUpperCase() !== "TRUE") return respond({ erro: "Faixa desativada" });
    // Gerenciar manda direct:true (só vale p/ admin): edita direto qualquer um, inclusive o próprio.
    // Pelo Meus records todo mundo (inclusive admin) segue a regra comum: live vira proposta.
    const direct = isAdmin && payload.direct === true;
    if (isOwner && !direct && _isLiveRow(head, vals[ri])) {
      // Dono melhorando o próprio record live (mesmo sendo admin): vira proposta,
      // original segue valendo. Só admin editando record DE TERCEIROS altera direto.
      if (data.power_value !== undefined && data.powerband_id === undefined) {
        const band = _bandForPower(Number(data.power_value));
        if (!band) return respond({ erro: "Faixa de força não encontrada p/ power_value=" + data.power_value });
        data.powerband_id = String(band.id);
      }
      if (String(data.method || rec.method || "com_ajuda") === "sem_ajuda") {
        const v = data.video_url !== undefined ? String(data.video_url) : String(rec.video_url || "");
        if (!v.trim()) return respond({ erro: "Sem ajuda exige vídeo de prova" });
      }
      const id = _makeProposal(sh, head, col, ri, vals, u, data);
      return respond({ status: "ok", id, proposal: true });
    }
    const FIELDS = ["course_id", "power_value", "score", "pang", "screenshot_url", "video_url"];
    FIELDS.forEach(k => { if (data[k] !== undefined) sh.range(ri + 1, col(k)).write(data[k]); });
    if (data.wind !== undefined && col("wind") > 0) sh.range(ri + 1, col("wind")).write(String(data.wind));
    if (data.method !== undefined && col("method") > 0) sh.range(ri + 1, col("method")).write(String(data.method));
    if (!isAdmin) {
      const effMethod = String(data.method || rec.method || "com_ajuda");
      const effVideo = data.video_url !== undefined ? String(data.video_url) : String(rec.video_url || "");
      if (effMethod === "sem_ajuda" && !effVideo.trim()) return respond({ erro: "Sem ajuda exige vídeo de prova" });
    }
    if (isAdmin && data.note !== undefined) sh.range(ri + 1, col("note")).write(String(data.note));
    let newBandId = String(rec.powerband_id);
    if (data.powerband_id) {
      newBandId = String(data.powerband_id);
      sh.range(ri + 1, col("powerband_id")).write(newBandId);
    } else if (data.power_value !== undefined) {
      const band = _bandForPower(Number(data.power_value));
      if (!band) return respond({ erro: "Faixa de força não encontrada p/ power_value=" + data.power_value });
      newBandId = String(band.id);
      sh.range(ri + 1, col("powerband_id")).write(newBandId);
    }
    if (isOwner && !direct) {
      // Dono reenvia p/ fila (mesmo sendo admin); só Gerenciar (direct) mantém direto.
      sh.range(ri + 1, col("status")).write("pending");
      sh.range(ri + 1, col("validated_by")).write("");
      sh.range(ri + 1, col("validated_at")).write("");
      if (col("is_best") > 0) sh.range(ri + 1, col("is_best")).write("");
      { // Invalidate votes even while community is still undecided (0).
        // Dado mudou depois do voto: os votos valiam p/ outra versão — zera tudo e volta
        // p/ não votado. O admin revisa e a comunidade vota de novo no dado atual.
        // (Apelação sem editar não cai aqui: appealVote não altera dado.)
        if (col("community") > 0) sh.range(ri + 1, col("community")).write("0");
        const vs = _table("Votes");
        const vv = vs.read();
        const vhi = n => vv[0].indexOf(n);
        for (let i = vv.length - 1; i > 0; i--) {
          if (String(vv[i][vhi("record_id")]) === String(rec.id)) vs.remove(i + 1);
        }
      }
    }
    if (col("edited") > 0) sh.range(ri + 1, col("edited")).write("TRUE"); // reenviado após edição
    // categoria nova a partir da memória (rec + data): sem releitura da planilha
    const newCourse = String(data.course_id !== undefined ? data.course_id : rec.course_id);
    const newMethod = String(data.method !== undefined ? data.method : (rec.method || "com_ajuda"));
    const newWind = String(data.wind !== undefined ? data.wind : (rec.wind || "normal"));
    _recalcBest(String(rec.course_id), String(rec.powerband_id), String(rec.method || "com_ajuda"), String(rec.wind || "normal"));
    _recalcBest(newCourse, newBandId, newMethod, newWind);
    return respond({ status: "ok" });
  }
    throw new Error("Unsupported records action: " + action);
  };
}
