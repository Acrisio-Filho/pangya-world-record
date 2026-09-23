<script setup>
import AuthShell from "../../../components/AuthShell.vue";
import { reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "../../../stores/auth";
import { useToastStore } from "../../../stores/toast";
import GoogleButton from "../../../components/GoogleButton.vue";
import PasswordInput from "../../../components/PasswordInput.vue";

const email = ref("");
const hasGoogle = !!window.PWR_CONFIG?.GOOGLE_CLIENT_ID && !window.PWR_CONFIG.GOOGLE_CLIENT_ID.startsWith("TROQUE_");
const password = ref("");
const loading = ref(false);
const errors = reactive({ email: "", password: "" });
const auth = useAuthStore();
const toast = useToastStore();
const router = useRouter();
const route = useRoute();

async function onSubmit() {
  errors.email = /^\S+@\S+\.\S+$/.test(email.value.trim()) ? "" : "Informe um e-mail válido.";
  errors.password = password.value ? "" : "Informe sua senha para continuar.";
  if (errors.email || errors.password) return;
  loading.value = true;
  try {
    const r = await auth.login(email.value, password.value);
    if (r.erro) {
      toast.error(r.erro);
      return;
    }
    toast.success(`Bem-vindo, ${r.user.nickname}!`);
    const target = route.query.redirect;
    router.push(typeof target === "string" && target.startsWith("/") && !target.startsWith("//") ? target : "/");
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <AuthShell title="Bom te ver de novo." subtitle="Entre para registrar suas partidas e acompanhar suas conquistas.">
    <div class="card">
      <form class="grid gap-3" novalidate @submit.prevent="onSubmit">
        <div class="field-control"><input v-model="email" type="email" aria-label="Email" autocomplete="email" placeholder="Email" :aria-invalid="!!errors.email" class="field" @input="errors.email = ''" /><p v-if="errors.email" class="form-error">{{ errors.email }}</p></div>
        <div class="field-control"><PasswordInput v-model="password" aria-label="Senha" autocomplete="current-password" placeholder="Senha" :aria-invalid="!!errors.password" class="field" @input="errors.password = ''" /><p v-if="errors.password" class="form-error">{{ errors.password }}</p></div>
        <button class="btn-primary w-full" :disabled="loading">{{ loading ? "Entrando..." : "Entrar" }}</button>
      </form>
      <div v-if="hasGoogle" class="my-4 flex items-center gap-3 text-xs text-slate-500">
        <div class="h-px flex-1 bg-slate-800"></div>ou<div class="h-px flex-1 bg-slate-800"></div>
      </div>
      <GoogleButton v-if="hasGoogle" />
      <p class="mt-5 text-center text-sm text-slate-400">
        Não tem conta? <RouterLink to="/register" class="link">Cadastre-se</RouterLink>
      </p>
    </div>
  </AuthShell>
</template>
