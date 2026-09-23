import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "./stores/auth";
import { useToastStore } from "./stores/toast";

// Local usa a raiz; Pages usa o nome do repositório como base. O 404.html
// público restaura deep-links do GitHub Pages antes de o Vue iniciar.
const isLocalHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
const routerBase = isLocalHost ? "/" : import.meta.env.BASE_URL;
const routes = [
  { path: "/", name: "home", component: () => import("./modules/records/presentation/HomeView.vue") },
  { path: "/login", name: "login", component: () => import("./modules/identity/presentation/LoginView.vue") },
  { path: "/register", name: "register", component: () => import("./modules/identity/presentation/RegisterView.vue") },
  { path: "/submit-record", name: "submit-record", component: () => import("./modules/records/presentation/SubmitRecordView.vue"), meta: { requiresAuth: true } },
  { path: "/profile", name: "profile", component: () => import("./modules/identity/presentation/ProfileView.vue") },
  { path: "/community", name: "community", component: () => import("./modules/community/presentation/CommunityView.vue") },
  { path: "/admin", name: "admin", component: () => import("./modules/administration/presentation/AdminView.vue"), meta: { requiresAdmin: true } },
  { path: "/privacy", name: "privacy", component: () => import("./modules/identity/presentation/PrivacyView.vue") },
  { path: "/terms", name: "terms", component: () => import("./modules/identity/presentation/TermsView.vue") },
  { path: "/:pathMatch(.*)*", name: "not-found", component: () => import("./components/NotFoundView.vue") },
];

export const router = createRouter({
  history: createWebHistory(routerBase),
  routes,
  scrollBehavior() {
    return { top: 0 };
  },
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (to.meta.requiresAuth && !auth.isLoggedIn) {
    return { name: "login", query: { redirect: to.fullPath } };
  }
  if (to.meta.requiresAdmin) {
    if (!auth.isLoggedIn) return { name: "login", query: { redirect: to.fullPath } };
    const me = await auth.ensureMe();
    if (!me || me.role !== "admin") {
      useToastStore().error("Só admin.");
      return { name: "home" };
    }
  }
  return true;
});
