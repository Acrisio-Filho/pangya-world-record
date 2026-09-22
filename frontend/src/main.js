import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import { router } from "./router";
import { useToastStore } from "./stores/toast";
import { useAuthStore } from "./stores/auth";
import "./style.css";
import { installNavigationRecovery } from "./lib/navigation";

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);
installNavigationRecovery(router);
app.use(router);

// Falha de rede/API (lançada pelo lib/api.js) sempre vira toast, nunca fica silenciosa.
window.addEventListener("unhandledrejection", (e) => {
  useToastStore(pinia).error("Erro na API: " + ((e.reason && e.reason.message) || "falha inesperada"));
});

app.mount("#app");

// Revalida a sessão salva assim que o app sobe (nickname/role/pontos podem ter mudado).
useAuthStore(pinia).fetchMe();
