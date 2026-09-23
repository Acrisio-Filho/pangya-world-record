<script setup>
import { nextTick, onMounted, onUnmounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";
import { useToastStore } from "../stores/toast";

const el = ref(null);
const auth = useAuthStore();
const toast = useToastStore();
const router = useRouter();
const route = useRoute();
let timer;
let frame;
onUnmounted(() => {
  clearTimeout(timer);
  cancelAnimationFrame(frame);
});

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

onMounted(async () => {
  if (!CFG.GOOGLE_CLIENT_ID || CFG.GOOGLE_CLIENT_ID.indexOf("TROQUE_ISSO") === 0) return;
  await nextTick();
  // GIS carrega async: tenta até 10s antes de desistir.
  let tries = 0;
  const tick = () => {
    if (!el.value) return;
    if (window.google && window.google.accounts) {
      // Em produção o script do Google pode estar disponível antes do layout do
      // formulário terminar. Renderizar com largura zero cria um iframe que não
      // se ajusta depois e deixa apenas o bloco branco do ícone visível.
      const availableWidth = Math.floor(el.value.clientWidth);
      if (!availableWidth) {
        frame = requestAnimationFrame(tick);
        return;
      }
      window.google.accounts.id.initialize({ client_id: CFG.GOOGLE_CLIENT_ID, callback: onCredential });
      // O GIS não atualiza um botão já renderizado. Limpar o mount também evita
      // botões duplicados quando o componente é remontado durante a navegação.
      el.value.replaceChildren();
      // Abaixo de 250 px o GIS pode trocar o rótulo pelo modo somente-ícone.
      // O formulário tem espaço para essa largura inclusive em telas móveis.
      const width = Math.max(250, Math.min(400, availableWidth));
      window.google.accounts.id.renderButton(el.value, { theme: "filled_black", shape: "rectangular", size: "large", text: "continue_with", locale: "pt-BR", width });
    } else if (++tries < 50) {
      timer = setTimeout(tick, 200);
    }
  };
  tick();
});
</script>

<template>
  <div class="google-auth-wrap">
    <div class="google-button">
      <div class="google-button-visual" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false"><path fill="#4285f4" d="M21.4 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.3a4.5 4.5 0 0 1-2 3v2.5h3.2c1.9-1.7 2.9-4.2 2.9-7.3Z"/><path fill="#34a853" d="M12 21.7c2.6 0 4.8-.9 6.4-2.3L15.2 17a5.8 5.8 0 0 1-8.7-3v2.6H3.2a9.7 9.7 0 0 0 8.8 5.1Z"/><path fill="#fbbc05" d="M6.5 14a5.8 5.8 0 0 1 0-3.9V7.5H3.2a9.7 9.7 0 0 0 0 8.9L6.5 14Z"/><path fill="#ea4335" d="M12 5.9c1.5 0 2.9.5 4 1.6l3-3A9.8 9.8 0 0 0 3.2 7.5l3.3 2.6a5.8 5.8 0 0 1 5.5-4.2Z"/></svg>
        <span>Continuar com o Google</span>
      </div>
      <div ref="el" class="google-button-mount"></div>
    </div>
    <p>Entraremos somente com os dados básicos da sua conta Google.</p>
  </div>
</template>
