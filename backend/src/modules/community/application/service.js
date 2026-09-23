// Application service: all outgoing dependencies are injected by the composition root.
function createCommunityModule(ports) {
  const { PTS_COM_OK, PTS_IMPROVE_COM, ids, VotingPolicy, _addPoints, _append, _authUser, _effPoints, _recalcBest, _rows, _table, _tally, _toObj } = ports;
  const respond = value => value;
  return function execute(action, e, payload = {}) {
  if (action === "tally") {
    return respond(_tally(e.parameter.id || ""));
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
    return respond(out);
  }
  if (action === "myVotes") {
    const u = _authUser(e, null);
    if (!u) return respond({ erro: "Faça login" });
    const { header, rows } = _rows("Votes");
    const mine = {};
    rows.forEach(r => { const v = _toObj(header, r); if (String(v.user_id) === String(u.id)) mine[String(v.record_id)] = v.vote; });
    return respond(mine);
  }
  if (action === "vote") {
    const u = _authUser(e, payload);
    if (!u) return respond({ erro: "Faça login" });
    if ((u.status || "active") !== "active") return respond({ erro: "Conta bloqueada" });
    if (!["approve", "reject"].includes(payload.vote)) return respond({ erro: "voto inválido" });
    const rh = _rows("Records");
    const rec = rh.rows.map(r => _toObj(rh.header, r)).find(x => String(x.id) === String(payload.id));
    if (!rec) return respond({ erro: "Record não encontrado" });
    if (String(rec.status) !== "approved" || Number(rec.community || 0) !== 0) return respond({ erro: "Fora de votação" });
    if (String(rec.user_id) === String(u.id)) return respond({ erro: "Não vote no próprio record" });
    const w = _effPoints(u);
    if (w < 10) return respond({ erro: "Sem pontos suficientes (mínimo 10)" });
    // 1 voto por usuário/record (revotar atualiza), peso = pontos atuais
    const vsh = _table("Votes");
    const vv = vsh.read();
    const vh = vv[0];
    let found = false;
    for (let i = 1; i < vv.length; i++) {
      if (String(vv[i][vh.indexOf("record_id")]) === String(payload.id) && String(vv[i][vh.indexOf("user_id")]) === String(u.id)) {
        vsh.range(i + 1, vh.indexOf("vote") + 1).write(payload.vote);
        vsh.range(i + 1, vh.indexOf("weight") + 1).write(w);
        found = true;
        break;
      }
    }
    if (!found) {
      _append("Votes", { id: ids.next(), record_id: String(payload.id), user_id: u.id, vote: payload.vote, weight: w, created_at: new Date().toISOString() }, vh); // vh já lido acima
    }
    const t = _tally(payload.id);
    const decided = VotingPolicy.decide(t);
    if (decided) {
      const sh = _table("Records");
      const vals = sh.read();
      const head = vals[0];
      const col = n => head.indexOf(n) + 1;
      const ri = vals.findIndex((r, i) => i > 0 && String(r[head.indexOf("id")]) === String(payload.id));
      if (decided === "approved") {
        sh.range(ri + 1, col("status")).write("pending"); // volta p/ fila final do admin
        sh.range(ri + 1, col("validated_by")).write("");
        sh.range(ri + 1, col("validated_at")).write("");
        if (col("community") > 0) sh.range(ri + 1, col("community")).write("1");
        if (col("pts_com") > 0 && String(vals[ri][head.indexOf("pts_com")]) !== "TRUE") {
          sh.range(ri + 1, col("pts_com")).write("TRUE");
          const isProp = String(vals[ri][head.indexOf("edit_of")] || "") !== "";
          _addPoints(String(vals[ri][head.indexOf("user_id")]), isProp ? PTS_IMPROVE_COM : PTS_COM_OK);
        }
      } else {
        // Rejeitado pela comunidade: volta p/ fila do admin como pedido (pending + -1),
        // igual ao aprovado — palavra final é do admin (confirma, força ok ou reabre).
        sh.range(ri + 1, col("status")).write("pending");
        sh.range(ri + 1, col("validated_by")).write("");
        sh.range(ri + 1, col("validated_at")).write("");
        if (col("community") > 0) sh.range(ri + 1, col("community")).write("-1");
      }
      _recalcBest(String(vals[ri][head.indexOf("course_id")]), String(vals[ri][head.indexOf("powerband_id")]), String(vals[ri][head.indexOf("method")] || "com_ajuda"), String(vals[ri][head.indexOf("wind")] || "normal"));
    }
    return respond({ status: "ok", vote: payload.vote, tally: t, decided });
  }
  if (action === "appealVote") {
    // Dono pede reavaliação de rejeição confirmada (approved/-1) sem precisar editar nada:
    // volta p/ pending (fila do admin), comunidade segue -1, marca edited. Só sai do
    // pending pelo admin (confirma, força ok ou reabre). Sem spam: já na fila não apela.
    const u = _authUser(e, payload);
    if (!u) return respond({ erro: "Faça login" });
    const sh = _table("Records");
    const vals = sh.read();
    const head = vals[0];
    const col = n => head.indexOf(n) + 1;
    const ri = vals.findIndex((r, i) => i > 0 && String(r[head.indexOf("id")]) === String(payload.id));
    if (ri < 0) return respond({ erro: "Record não encontrado" });
    const rec = _toObj(head, vals[ri]);
    if (String(rec.user_id) !== String(u.id)) return respond({ erro: "Só o dono pode pedir" });
    if (String(rec.status) !== "approved" || Number(rec.community || 0) !== -1) return respond({ erro: "Só rejeição confirmada" });
    sh.range(ri + 1, col("status")).write("pending");
    if (col("edited") > 0) sh.range(ri + 1, col("edited")).write("TRUE");
    return respond({ status: "ok" });
  }
  if (action === "reopenVote") {
    // Admin reabre votação: rejeitado confirmado (-1, approved|pending) ou final pendente (1,
    // pending) voltam p/ approved/0 (fila da Comunidade) e os votos são apagados.
    // Record já publicado no index (approved/1) não reabre por aqui (usar o Gerenciar).
    // Rejeição/aprovação não pagam pontos aqui, então nada a estornar (pts_com só paga 1x).
    const u = _authUser(e, payload);
    if (!u || u.role !== "admin") return respond({ erro: "Só admin" });
    const sh = _table("Records");
    const vals = sh.read();
    const head = vals[0];
    const col = n => head.indexOf(n) + 1;
    const ri = vals.findIndex((r, i) => i > 0 && String(r[head.indexOf("id")]) === String(payload.id));
    if (ri < 0) return respond({ erro: "Record não encontrado" });
    const st = String(vals[ri][head.indexOf("status")]);
    const com = Number(vals[ri][head.indexOf("community")] || 0);
    const ok = (com === -1 && (st === "approved" || st === "pending")) || (com === 1 && st === "pending");
    if (!ok) return respond({ erro: "Só pedido pendente votado ou rejeitado confirmado" });
    sh.range(ri + 1, col("status")).write("approved");
    sh.range(ri + 1, col("community")).write("0");
    const vs = _table("Votes");
    const vv = vs.read();
    const vhi = n => vv[0].indexOf(n);
    for (let i = vv.length - 1; i > 0; i--) {
      if (String(vv[i][vhi("record_id")]) === String(payload.id)) vs.remove(i + 1);
    }
    return respond({ status: "ok" });
  }
    throw new Error("Unsupported community action: " + action);
  };
}
