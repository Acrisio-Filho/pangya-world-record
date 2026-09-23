import { defineStore } from "pinia";
import { apiGet, apiPost } from "../lib/api";

const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
let idleTimer = null;
let idleStore = null;
let idleListenersInstalled = false;
let lastActivityAt = Date.now();

function scheduleIdleExpiry() {
  if (!idleStore?.token || typeof window === "undefined") return;
  clearTimeout(idleTimer);
  const remaining = IDLE_TIMEOUT_MS - (Date.now() - lastActivityAt);
  if (remaining <= 0) return idleStore.expireForInactivity();
  idleTimer = window.setTimeout(() => idleStore?.expireForInactivity(), remaining);
}
function registerActivity() {
  if (!idleStore?.token) return;
  if (Date.now() - lastActivityAt >= IDLE_TIMEOUT_MS) return idleStore.expireForInactivity();
  lastActivityAt = Date.now();
  scheduleIdleExpiry();
}
function installIdleListeners() {
  if (idleListenersInstalled || typeof window === "undefined") return;
  idleListenersInstalled = true;
  ["pointerdown", "keydown", "touchstart", "focus"].forEach(event => window.addEventListener(event, registerActivity, { passive: true }));
  document.addEventListener("visibilitychange", () => { if (!document.hidden) scheduleIdleExpiry(); });
}

function readUser() {
  try {
    return JSON.parse(localStorage.getItem("pwr_user"));
  } catch {
    return null;
  }
}

export const useAuthStore = defineStore("auth", {
  state: () => ({
    token: localStorage.getItem("pwr_token") || null,
    user: readUser(),
    meChecked: false,
  }),
  getters: {
    isLoggedIn: (s) => !!s.token,
    isAdmin: (s) => s.user?.role === "admin",
  },
  actions: {
    saveSession(token, user) {
      this.meChecked = false;
      this.token = token;
      this.user = user;
      localStorage.setItem("pwr_token", token);
      localStorage.setItem("pwr_user", JSON.stringify(user));
      this.startIdleWatch();
    },
    clearSession() {
      this.meChecked = false;
      this.token = null;
      this.user = null;
      localStorage.removeItem("pwr_token");
      localStorage.removeItem("pwr_user");
      if (!this.token) clearTimeout(idleTimer);
    },
    startIdleWatch() {
      idleStore = this;
      lastActivityAt = Date.now();
      installIdleListeners();
      scheduleIdleExpiry();
    },
    expireForInactivity() {
      if (!this.token) return;
      this.clearSession();
      window.dispatchEvent(new CustomEvent("pwr:session-expired"));
    },
    async login(email, password) {
      const r = await apiPost("login", { email, password });
      if (r.erro) return r;
      this.saveSession(r.token, r.user);
      return r;
    },
    async loginGoogle(idToken) {
      const r = await apiPost("loginGoogle", { id_token: idToken });
      if (r.erro) return r;
      this.saveSession(r.token, r.user);
      return r;
    },
    async register(data) {
      return apiPost("register", data);
    },
    async logout() {
      try {
        await apiPost("logout");
      } catch {
        /* sessão local já foi limpa abaixo mesmo se a API falhar */
      }
      this.clearSession();
    },
    // Revalida a sessão com o servidor (nickname/role/pontos podem ter mudado).
    async fetchMe() {
      if (!this.token) return null;
      const me = await apiGet("getMe");
      this.meChecked = true;
      if (me && !me.erro) {
        this.user = me;
        localStorage.setItem("pwr_user", JSON.stringify(me));
        this.startIdleWatch();
        return me;
      }
      this.clearSession();
      return null;
    },
    async ensureMe() {
      if (this.meChecked) return this.user;
      return this.fetchMe();
    },
    async updateMe(data) {
      const r = await apiPost("updateMe", data);
      if (!r.erro) await this.fetchMe();
      return r;
    },
  },
});
