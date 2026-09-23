<script setup>
import AuthShell from "../../../components/AuthShell.vue";
import { reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../../../stores/auth";
import { useToastStore } from "../../../stores/toast";
import GoogleButton from "../../../components/GoogleButton.vue";
import { isStrongPassword, passwordMessage } from "../../../lib/password";
import PasswordInput from "../../../components/PasswordInput.vue";

const nickname = ref("");
const email = ref("");
const hasGoogle = !!window.PWR_CONFIG?.GOOGLE_CLIENT_ID && !window.PWR_CONFIG.GOOGLE_CLIENT_ID.startsWith("TROQUE_");
const password = ref("");
const bio = ref("");
const youtube_url = ref("");
const loading = ref(false);
const errors = reactive({ nickname: "", email: "", password: "", youtube: "" });
const auth = useAuthStore();
const toast = useToastStore();
const router = useRouter();

async function onSubmit() {
  errors.nickname = !nickname.value.trim() ? "Escolha um nickname para aparecer no ranking." : [...nickname.value.trim()].length > 22 ? "Use até 22 caracteres no nickname." : "";
  errors.email = /^\S+@\S+\.\S+$/.test(email.value.trim()) ? "" : "Informe um e-mail válido.";
  errors.password = isStrongPassword(password.value) ? "" : passwordMessage;
  errors.youtube = youtube_url.value && !/^https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\//i.test(youtube_url.value.trim()) ? "Use um link do YouTube ou deixe este campo vazio." : "";
  if (Object.values(errors).some(Boolean)) return;
  loading.value = true;
  try {
    const r = await auth.register({ nickname: nickname.value, email: email.value, password: password.value, bio: bio.value, youtube_url: youtube_url.value });
    if (r.erro) {
      toast.error(r.erro);
      return;
    }
    const session = await auth.login(email.value, password.value);
    if (session.erro) {
      toast.success("Conta criada. Entre com seus dados para continuar.");
      return router.push("/login");
    }
    toast.success("Conta criada. Um admin liberará seus envios de records.");
    router.push({ path: "/profile", query: { me: "1" } });
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <AuthShell title="Entre para o jogo." subtitle="Crie sua conta. Um administrador liberará seus envios após o cadastro.">
    <div class="card">
      <form class="grid gap-3" novalidate @submit.prevent="onSubmit">
        <div class="field-control"><input v-model="nickname" aria-label="Nickname" autocomplete="nickname" placeholder="Nickname (máx 22)" :aria-invalid="!!errors.nickname" class="field" @input="errors.nickname = ''" /><p v-if="errors.nickname" class="form-error">{{ errors.nickname }}</p></div>
        <div class="field-control"><input v-model="email" type="email" aria-label="Email" autocomplete="email" placeholder="Email" :aria-invalid="!!errors.email" class="field" @input="errors.email = ''" /><p v-if="errors.email" class="form-error">{{ errors.email }}</p></div>
        <div class="password-field">
          <PasswordInput v-model="password" aria-label="Senha" aria-describedby="password-requirements" autocomplete="new-password" placeholder="Senha" :aria-invalid="!!errors.password" class="field" @input="errors.password = ''" />
          <p id="password-requirements" class="password-requirements"><b>Uma senha segura protege seus records.</b><span>Use 8 ou mais caracteres, incluindo uma letra maiúscula, um número e um símbolo.</span></p>
          <p v-if="errors.password" class="form-error">{{ errors.password }}</p>
        </div>
        <input v-model="bio" aria-label="Sobre você" placeholder="Info sobre você (opcional)" class="field" />
        <div class="field-control"><input v-model="youtube_url" aria-label="Canal do YouTube" type="url" placeholder="Canal do YouTube (opcional)" :aria-invalid="!!errors.youtube" class="field" @input="errors.youtube = ''" /><p v-if="errors.youtube" class="form-error">{{ errors.youtube }}</p></div>
        <button class="btn-primary w-full" :disabled="loading">{{ loading ? "Criando..." : "Criar conta" }}</button>
      </form>
      <div v-if="hasGoogle" class="my-4 flex items-center gap-3 text-xs text-slate-500">
        <div class="h-px flex-1 bg-slate-800"></div>ou<div class="h-px flex-1 bg-slate-800"></div>
      </div>
      <GoogleButton v-if="hasGoogle" />
      <p class="mt-5 text-center text-sm text-slate-400">
        Já tem conta? <RouterLink to="/login" class="link">Entrar</RouterLink>
      </p>
    </div>
  </AuthShell>
</template>
