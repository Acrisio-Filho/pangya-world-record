// Application service: all outgoing dependencies are injected by the composition root.
function createCatalogModule(ports) {
  const { ids, _append, _authUser, _isAdmin, _recalcBest, _rows, _table, _toObj } = ports;
  const respond = value => value;
  return function execute(action, e, payload = {}) {
  if (action === "listCourses") {
    const { header, rows } = _rows("Courses");
    const all = rows.map(r => _toObj(header, r));
    if (e.parameter.include_inactive === "1" && _isAdmin(e)) return respond(all);
    return respond(all.filter(c => String(c.active).toUpperCase() === "TRUE"));
  }
  if (action === "listBands") {
    const { header, rows } = _rows("PowerBands");
    const all = rows.map(r => _toObj(header, r));
    all.sort((a, b) => Number(a.min) - Number(b.min));
    if (e.parameter.include_inactive === "1" && _isAdmin(e)) return respond(all);
    return respond(all.filter(b => String(b.active).toUpperCase() === "TRUE"));
  }
  if (action === "upsertBand" || action === "upsertCourse") {
    const u = _authUser(e, payload);
    if (!u || u.role !== "admin") return respond({ erro: "Só admin" });
    const sheetName = action === "upsertBand" ? "PowerBands" : "Courses";
    const nameKey = action === "upsertBand" ? "label" : "name";
    const norm = (s) => String(s == null ? "" : s).trim().toLowerCase();
    const sh = _table(sheetName);
    const vals = sh.read();
    const head = vals[0];
    const nameCol = head.indexOf(nameKey);
    if (payload.data && payload.data[nameKey] != null) payload.data[nameKey] = String(payload.data[nameKey]).trim();
    for (let i = 1; i < vals.length; i++) {
      if (String(vals[i][0]) === String(payload.id)) {
        // EDIT por id: não deixa renomear p/ nome de OUTRO
        const newName = payload.data && payload.data[nameKey] != null ? norm(payload.data[nameKey]) : "";
        if (newName) {
          for (let j = 1; j < vals.length; j++) {
            if (j !== i && norm(vals[j][nameCol]) === newName) return respond({ erro: "Nome já existe" });
          }
        }
        Object.keys(payload.data || {}).forEach(k => {
          const c = head.indexOf(k);
          if (c >= 0) sh.range(i + 1, c + 1).write(payload.data[k]);
        });
        return respond({ status: "ok", updated: true });
      }
    }
    // ADD idempotente por nome: duplo clique / retry / lentidão não duplica
    if (payload.data && payload.data[nameKey] != null) {
      const nn = norm(payload.data[nameKey]);
      for (let i = 1; i < vals.length; i++) {
        if (nn && norm(vals[i][nameCol]) === nn) return respond({ status: "ok", id: String(vals[i][0]), deduped: true });
      }
    }
    const row = Object.assign({ id: payload.id || ids.next() }, payload.data);
    _append(sheetName, row, head); // head já lido acima: sem releitura
    return respond({ status: "ok", id: row.id });
  }
  if (action === "deleteBand" || action === "deleteCourse") {
    const u = _authUser(e, payload);
    if (!u || u.role !== "admin") return respond({ erro: "Só admin" });
    if (action === "deleteCourse") {
      const rh = _rows("Records");
      if (rh.rows.some(r => String(_toObj(rh.header, r).course_id) === String(payload.id))) {
        return respond({ erro: "Em uso por records — desative em vez de excluir" });
      }
    } else {
      // deleteBand: records da faixa são realocados p/ outra faixa ativa que englobe a força
      const bh = _rows("PowerBands");
      const bands = bh.rows.map(r => _toObj(bh.header, r));
      const sh = _table("Records");
      const vals = sh.read();
      const head = vals[0];
      const moves = [];
      for (let i = 1; i < vals.length; i++) {
        if (String(vals[i][head.indexOf("powerband_id")]) !== String(payload.id)) continue;
        const pv = Number(vals[i][head.indexOf("power_value")]);
        const other = bands.find(b => String(b.id) !== String(payload.id) && String(b.active).toUpperCase() === "TRUE" && pv >= Number(b.min) && pv <= Number(b.max));
        if (!other) return respond({ erro: "Força " + pv + " não cabe em outra faixa ativa — crie uma que englobe antes" });
        moves.push({ row: i + 1, band: String(other.id) });
      }
      moves.forEach(m => sh.range(m.row, head.indexOf("powerband_id") + 1).write(m.band));
      const cats = {};
      moves.forEach(m => {
        const r = _toObj(head, vals[m.row - 1]); // vals já em memória: sem releitura por move
        const mt = String(r.method || "com_ajuda"), wd = String(r.wind || "normal");
        cats[String(r.course_id) + "|" + String(payload.id) + "|" + mt + "|" + wd] = [String(r.course_id), String(payload.id), mt, wd];
        cats[String(r.course_id) + "|" + m.band + "|" + mt + "|" + wd] = [String(r.course_id), m.band, mt, wd];
      });
      Object.values(cats).forEach(([c, b, mt, wd]) => _recalcBest(c, b, mt, wd));
      const bsh = _table("PowerBands");
      const bvals = bsh.read();
      for (let i = 1; i < bvals.length; i++) {
        if (String(bvals[i][0]) === String(payload.id)) { bsh.remove(i + 1); return respond({ status: "ok", realocados: moves.length }); }
      }
      return respond({ erro: "Não encontrado" });
    }
    const sh = _table("Courses");
    const vals = sh.read();
    for (let i = 1; i < vals.length; i++) {
      if (String(vals[i][0]) === String(payload.id)) { sh.remove(i + 1); return respond({ status: "ok" }); }
    }
    return respond({ erro: "Não encontrado" });
  }
    throw new Error("Unsupported catalog action: " + action);
  };
}
