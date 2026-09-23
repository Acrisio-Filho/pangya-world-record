<script setup>
import { onMounted, onUnmounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";
import { useToastStore } from "../stores/toast";

const el = ref(null);
const auth = useAuthStore();
const toast = useToastStore();
const router = useRouter();
const route = useRoute();
let timer;
onUnmounted(() => clearTimeout(timer));

const CFG = window.PWR_CONFIG || {};

async function onCredential(resp) {
  const r = await auth.loginGoogle(resp.credential);
  if (r.erro) {
    toast.error(r.erro);
    return;
  }
  toast[r.user.status === "blocked" ? "info" : "success"](
    r.user.status === "blocked" ? "Conta criada bloqueada — um admin vai liberar para envio de records." : `Bem-vindo, ${r.user.nickname}!`
  );
  const target = route.query.redirect;
  router.push(typeof target === "string" && target.startsWith("/") && !target.startsWith("//") ? target : "/");
}

onMounted(() => {
  if (!CFG.GOOGLE_CLIENT_ID || CFG.GOOGLE_CLIENT_ID.indexOf("TROQUE_ISSO") === 0) return;
  // GIS carrega async: tenta até 10s antes de desistir.
  let tries = 0;
  const tick = () => {
    if (!el.value) return;
    if (window.google && window.google.accounts) {
      window.google.accounts.id.initialize({ client_id: CFG.GOOGLE_CLIENT_ID, callback: onCredential });
      const width = Math.max(240, Math.min(360, Math.floor(el.value.getBoundingClientRect().width)));
      window.google.accounts.id.renderButton(el.value, { theme: "filled_black", shape: "rect", size: "large", text: "continue_with", locale: "pt-BR", width });
    } else if (++tries < 50) {
      timer = setTimeout(tick, 200);
    }
  };
  tick();
});
</script>

<template>
  <div class="google-auth-wrap"><div ref="el" class="google-button"></div><p>Entraremos somente com os dados básicos da sua conta Google.</p></div>
</template>
