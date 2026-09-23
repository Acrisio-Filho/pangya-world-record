// Driving adapter: protocol and serialization stay outside use cases.
function doGet(e) {
  const action = String(e.parameter.action || "").trim();
  const actions = createApplication().get;
  const handler = actions[action];
  return _out(Object.prototype.hasOwnProperty.call(actions, action) ? handler(action, e) : { erro: "action desconhecida: " + action });
}
function doPost(e) {
  const lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch (err) { return _out({ erro: "Muita gente escrevendo junto — tente de novo" }); }
  try {
    let payload;
    try { payload = JSON.parse((e.postData && e.postData.contents) || "{}"); }
    catch (err) { return _out({ erro: "Requisição inválida" }); }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return _out({ erro: "Requisição inválida" });
    const actions = createApplication().post;
    const action = String(payload.action || "");
    return _out(Object.prototype.hasOwnProperty.call(actions, action) ? actions[action](action, e, payload) : { erro: "action desconhecida: " + action });
  } finally { lock.releaseLock(); }
}
