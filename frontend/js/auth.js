// Sessão: token opaco no localStorage (aba Sessions, 30d).
function getToken() { return localStorage.getItem("pwr_token"); }
function getUser() { try { return JSON.parse(localStorage.getItem("pwr_user")); } catch { return null; } }
function saveSession(token, user) {
  localStorage.setItem("pwr_token", token);
  localStorage.setItem("pwr_user", JSON.stringify(user));
}
function clearSession() {
  localStorage.removeItem("pwr_token");
  localStorage.removeItem("pwr_user");
}
async function fetchMe() {
  if (!getToken()) return null;
  const me = await apiGet("getMe");
  if (me && !me.erro) { localStorage.setItem("pwr_user", JSON.stringify(me)); return me; }
  clearSession();
  return null;
}
async function logout() {
  try { await apiPost("logout"); } catch {}
  clearSession();
  location.href = "index.html";
}
// Login Google (GIS): botão renderizado onde houver #google-btn; sem Client ID real não renderiza.
async function onGoogle(resp) {
  const r = await apiPost("loginGoogle", { id_token: resp.credential });
  if (r.erro) { toast(r.erro, "error"); return; }
  saveSession(r.token, r.user);
  toast(r.user.status === "blocked" ? "Conta criada bloqueada — um admin vai liberar para envio de records." : `Bem-vindo, ${r.user.nickname}!`, r.user.status === "blocked" ? "info" : "success");
  setTimeout(() => location.href = "index.html", 800);
}
function initGoogleButton() {
  const el = document.getElementById("google-btn");
  if (!el) return;
  if (typeof GOOGLE_CLIENT_ID === "undefined" || GOOGLE_CLIENT_ID.indexOf("TROQUE_ISSO") === 0) return;
  // GIS carrega async: tenta até 10s antes de desistir
  let tries = 0;
  const tick = () => {
    if (typeof google !== "undefined" && google.accounts) {
      google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: onGoogle });
      google.accounts.id.renderButton(el, { theme: "filled_blue", text: "signin_with" });
    } else if (++tries < 50) {
      setTimeout(tick, 200);
    }
  };
  tick();
}
function requireLogin() {
  if (!getToken()) { location.href = "login.html"; return false; }
  return true;
}
async function requireAdmin() {
  const me = await fetchMe();
  if (!me || me.role !== "admin") { location.href = "index.html"; return null; }
  return me;
}
function renderNav() {
  const nav = document.getElementById("nav-user");
  if (!nav) return;
  const u = getUser();
  const com = `<a href="community.html">Comunidade</a> | `;
  nav.innerHTML = com + (u
    ? `<a href="profile.html?me=1">${esc(u.nickname)}</a> | <a href="submit-record.html">Meus records</a> | ${u.role === "admin" ? `<a href="admin.html">Gerenciar</a> | ` : ""}<a href="#" id="logout">Sair</a>`
    : `<a href="login.html">Login</a> | <a href="register.html">Cadastrar</a>`);
  const btn = document.getElementById("logout");
  if (btn) btn.onclick = (e) => { e.preventDefault(); logout(); };
}
document.addEventListener("DOMContentLoaded", () => { renderNav(); initGoogleButton(); });
