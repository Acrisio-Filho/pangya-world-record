<script setup>
import { router } from "./router";
import { navigationFailure, reloadRoute } from "./lib/navigation";
const isDemo = window.PWR_CONFIG?.DATA_MODE === "demo";
import AppHeader from "./components/AppHeader.vue";
import AppFooter from "./components/AppFooter.vue";
import ToastStack from "./components/ToastStack.vue";
import LoadingBar from "./components/LoadingBar.vue";
import ConfirmModal from "./components/ConfirmModal.vue";
import { onBeforeUnmount, onMounted } from "vue";
import { useConfirmStore } from "./stores/confirm";
import { useToastStore } from "./stores/toast";
const confirm = useConfirmStore();
const toast = useToastStore();
function redirectExpiredSession() {
  toast.info("Sua sessão foi encerrada após 30 minutos sem atividade.");
  router.push({ name: "login", query: { reason: "idle" } });
}
onMounted(() => window.addEventListener("pwr:session-expired", redirectExpiredSession));
onBeforeUnmount(() => window.removeEventListener("pwr:session-expired", redirectExpiredSession));
</script>

<template>
  <LoadingBar />
  <ToastStack />
  <ConfirmModal :request="confirm.request" @answer="confirm.answer" />
  <a class="skip-link" href="#main">Pular para o conteúdo</a>
  <AppHeader />
  <div v-if="isDemo" class="demo-strip"><span aria-hidden="true">◈</span> Ambiente local · dados de teste</div>
  <main id="main" class="app-main mx-auto w-full max-w-6xl px-4 py-6">
    <section v-if="navigationFailure" class="state-panel" role="alert">
      <h1>Não foi possível abrir esta página</h1>
      <p>Os arquivos podem ter sido atualizados ou a conexão foi interrompida. Recarregue para tentar novamente.</p>
      <button class="btn-primary" @click="reloadRoute(router, navigationFailure.target)">Recarregar página</button>
    </section>
    <RouterView v-else v-slot="{ Component, route }">
      <Transition name="fade" mode="out-in">
        <component :is="Component" :key="route.fullPath" />
      </Transition>
    </RouterView>
  </main>
  <AppFooter />
</template>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
