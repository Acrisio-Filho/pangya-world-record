<script setup>
import BrandLogo from "./BrandLogo.vue";
import { ref, computed, onBeforeUnmount, onMounted } from "vue";
import { RouterLink, useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";
import { useToastStore } from "../stores/toast";

const auth = useAuthStore();
const toast = useToastStore();
const router = useRouter();
const open = ref(false);
const userMenu = ref(false);
const userMenuRef = ref(null);
const avatarInitial = computed(() => String(auth.user?.nickname || "P").trim().slice(0, 1).toUpperCase());
const avatarUrl = computed(() => /^https:\/\/[^\s<>"'`]+$/i.test(String(auth.user?.avatar_url || "")) ? auth.user.avatar_url : "");

const links = computed(() => {
  const base = [{ to: "/", label: "Ranking" }, { to: "/community", label: "Comunidade" }];
  if (auth.isLoggedIn) {
    base.push({ to: "/submit-record", label: "Meus records" });
    if (auth.isAdmin) base.push({ to: "/admin", label: "Gerenciar" });
  }
  return base;
});

async function doLogout() {
  await auth.logout();
  toast.success("Sessão encerrada.");
  open.value = false;
  userMenu.value = false;
  router.push("/");
}

function closeUserMenuOnOutsideClick(event) {
  if (userMenuRef.value && !userMenuRef.value.contains(event.target)) userMenu.value = false;
}
onMounted(() => document.addEventListener("pointerdown", closeUserMenuOnOutsideClick));
onBeforeUnmount(() => document.removeEventListener("pointerdown", closeUserMenuOnOutsideClick));
</script>

<template>
  <header class="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/85 backdrop-blur">
    <div class="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
      <RouterLink to="/" class="flex items-center gap-2 text-base font-bold tracking-tight text-slate-50" @click="open = false">
        <BrandLogo />
      </RouterLink>

      <nav class="hidden items-center gap-1 md:flex">
        <RouterLink v-for="l in links" :key="l.to" :to="l.to" class="rounded-md px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800/70 hover:text-white" active-class="!text-sky-400 !bg-sky-500/10">
          {{ l.label }}
        </RouterLink>
        <template v-if="auth.isLoggedIn">
          <div ref="userMenuRef" class="user-menu">
            <button type="button" class="user-menu-trigger" :aria-expanded="userMenu" aria-haspopup="menu" @click="userMenu = !userMenu">
              <span class="user-avatar" aria-hidden="true">
                <img v-if="avatarUrl" :src="avatarUrl" alt="" referrerpolicy="no-referrer" />
                <template v-else>{{ avatarInitial }}</template>
              </span>
              <span class="max-w-28 truncate">{{ auth.user?.nickname }}</span>
              <svg class="user-menu-chevron" :class="{ 'is-open': userMenu }" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m6 8 4 4 4-4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /></svg>
            </button>
            <div v-if="userMenu" class="user-dropdown" role="menu">
              <RouterLink :to="{ path: '/profile', query: { me: 1 } }" role="menuitem" @click="userMenu = false">
                <svg class="user-menu-item-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="6.5" r="3" stroke="currentColor" stroke-width="1.6" /><path d="M4.5 17c.55-3.05 2.44-4.6 5.5-4.6s4.95 1.55 5.5 4.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" /></svg>
                <span>Perfil</span>
              </RouterLink>
              <button type="button" role="menuitem" @click="doLogout">
                <span aria-hidden="true">↪</span><span>Sair</span>
              </button>
            </div>
          </div>
        </template>
        <template v-else>
          <RouterLink to="/login" class="rounded-md px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800/70 hover:text-white">Login</RouterLink>
          <RouterLink to="/register" class="btn-primary !px-3 !py-1.5 text-sm">Criar conta ↗</RouterLink>
        </template>
      </nav>

      <button class="grid h-9 w-9 place-items-center rounded-lg text-slate-300 hover:bg-slate-800 md:hidden" @click="open = !open" aria-label="Menu" :aria-expanded="open">
        <svg v-if="!open" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
        <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </div>

    <div v-if="open" class="border-t border-slate-800 bg-slate-950 px-4 py-3 md:hidden">
      <div class="flex flex-col gap-1">
        <RouterLink v-for="l in links" :key="l.to" :to="l.to" class="rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-slate-800" active-class="!text-sky-400 !bg-sky-500/10" @click="open = false">
          {{ l.label }}
        </RouterLink>
        <template v-if="auth.isLoggedIn">
          <RouterLink :to="{ path: '/profile', query: { me: 1 } }" class="rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-slate-800" @click="open = false">
            {{ auth.user?.nickname }}
          </RouterLink>
          <button class="rounded-md px-3 py-2 text-left text-sm text-red-400 hover:bg-slate-800" @click="doLogout">Sair</button>
        </template>
        <template v-else>
          <RouterLink to="/login" class="rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-slate-800" @click="open = false">Login</RouterLink>
          <RouterLink to="/register" class="rounded-md px-3 py-2 text-sm text-sky-400 hover:bg-slate-800" @click="open = false">Criar conta ↗</RouterLink>
        </template>
      </div>
    </div>
  </header>
</template>
