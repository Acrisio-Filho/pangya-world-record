<script setup>
import { onMounted, onUnmounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";
import { useToastStore } from "../stores/toast";

const auth = useAuthStore();
const toast = useToastStore();
const router = useRouter();
const route = useRoute();
const googleReady = ref(false);
let timer;
let googleClient;
const CFG = window.PWR_CONFIG || {};

onUnmounted(() => clearTimeout(timer));

async function finishLogin(r) {
  if (r.erro) return toast.error(r.erro);
  toast[r.user.status === "blocked" ? "info" : "success"](
    r.user.status === "blocked" ? "Conta criada bloqueada — um admin vai liberar para envio de records." : `Bem-vindo, ${r.user.nickname}!`
  );
  const target = route.query.redirect;
  router.push(typeof target === "string" && target.startsWith("/") && !target.startsWith("//") ? target : "/");
}

async function onGoogleCode(response) {
  if (!response?.code) return toast.error(response?.error_description || "Não foi possível concluir o login pelo Google.");
  await finishLogin(await auth.loginGoogleCode(response.code, window.location.origin));
}

function initializeGoogle() {
  if (!window.google?.accounts?.oauth2) return false;
  googleClient = window.google.accounts.oauth2.initCodeClient({
    client_id: CFG.GOOGLE_CLIENT_ID,
    scope: "openid email profile",
    ux_mode: "popup",
    callback: onGoogleCode,
    error_callback: error => toast.error(error?.type === "popup_closed" ? "Login do Google cancelado." : "Não foi possível abrir a janela do Google."),
  });
  googleReady.value = true;
  return true;
}

function openGoogle() {
  if (!googleClient) return toast.error("O login do Google ainda está carregando. Tente novamente em instantes.");
  googleClient.requestCode();
}

onMounted(() => {
  if (!CFG.GOOGLE_CLIENT_ID || CFG.GOOGLE_CLIENT_ID.indexOf("TROQUE_ISSO") === 0) return;
  let tries = 0;
  const tick = () => {
    if (!initializeGoogle() && ++tries < 50) timer = setTimeout(tick, 200);
  };
  tick();
});
</script>

<template>
  <div class="google-auth-wrap">
    <div class="google-button">
      <button class="google-button-visual" type="button" :disabled="!googleReady" @click="openGoogle">
        <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true"><path fill="#4285f4" d="M21.4 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.3a4.5 4.5 0 0 1-2 3v2.5h3.2c1.9-1.7 2.9-4.2 2.9-7.3Z"/><path fill="#34a853" d="M12 21.7c2.6 0 4.8-.9 6.4-2.3L15.2 17a5.8 5.8 0 0 1-8.7-3v2.6H3.2a9.7 9.7 0 0 0 8.8 5.1Z"/><path fill="#fbbc05" d="M6.5 14a5.8 5.8 0 0 1 0-3.9V7.5H3.2a9.7 9.7 0 0 0 0 8.9L6.5 14Z"/><path fill="#ea4335" d="M12 5.9c1.5 0 2.9.5 4 1.6l3-3A9.8 9.8 0 0 0 3.2 7.5l3.3 2.6a5.8 5.8 0 0 1 5.5-4.2Z"/></svg>
        <span>Continuar com o Google</span>
      </button>
    </div>
    <p>Entraremos somente com os dados básicos da sua conta Google.</p>
  </div>
</template>
