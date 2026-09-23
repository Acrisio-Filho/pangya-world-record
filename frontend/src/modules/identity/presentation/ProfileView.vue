<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { apiGet, apiPost } from "../../../lib/api";
import { useAuthStore } from "../../../stores/auth";
import { useToastStore } from "../../../stores/toast";
import { useLookupsStore } from "../../../stores/lookups";
import { safeUrl, confirmOpen } from "../../../lib/format";
import { isStrongPassword, passwordMessage } from "../../../lib/password";
import RecordsTable from "../../../components/RecordsTable.vue";
import PasswordInput from "../../../components/PasswordInput.vue";

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const toast = useToastStore();
const lookups = useLookupsStore();

const profile = ref(null);
const erro = ref("");
const loading = ref(true);
const communityOk = ref([]);
const adminOk = ref([]);
const pending = ref(null);
const rejected = ref(null);

const editForm = ref({ nickname: "", bio: "", youtube_url: "" });
const savingProfile = ref(false);
const activeTab = ref("records");
const passwordForm = ref({ current: "", next: "", confirmation: "" });
const passwordError = ref("");
const changingPassword = ref(false);
const deleteForm = ref({ email: "", password: "" });
const deleteError = ref("");
const deleting = ref(false);
let loadRequest = 0;

const isOwner = computed(() => auth.user && profile.value && auth.user.id === profile.value.id);
const canSeeQueue = computed(() => auth.user && profile.value && (auth.user.id === profile.value.id || auth.isAdmin));
const hasPassword = computed(() => !!profile.value?.has_password);
const avatarUrl = computed(() => /^https:\/\/[^\s<>"'`]+$/i.test(String(profile.value?.avatar_url || "")) ? profile.value.avatar_url : "");

async function load() {
  const request = ++loadRequest;
  erro.value = "";
  profile.value = null;
  loading.value = true;
  try {
    let userId = route.query.id;
    if ("me" in route.query) {
      const me = await auth.fetchMe();
      if (!me) return router.replace("/login");
      userId = me.id;
    }
    if (!userId) throw new Error("Usuário não informado.");

    const u = await apiGet("getUser", { id: userId });
    if (u?.erro || !u) throw new Error(u?.erro || "Usuário não encontrado.");
    const [_, approved] = await Promise.all([
      lookups.ensure(),
      apiGet("listRecords", { user_id: userId, status: "approved" }),
    ]);
    if (!Array.isArray(approved)) throw new Error(approved?.erro || "Não foi possível carregar os records do perfil.");
    if (request !== loadRequest) return;

    profile.value = u;
    editForm.value = { nickname: u.nickname, bio: u.bio || "", youtube_url: u.youtube_url || "" };
    communityOk.value = approved.filter((record) => Number(record.community || 0) === 1);
    adminOk.value = approved.filter((record) => Number(record.community || 0) !== 1);

    if (auth.user && (auth.user.id === userId || auth.isAdmin)) {
      const [p, r] = await Promise.all([
        apiGet("listRecords", { user_id: userId, status: "pending" }),
        apiGet("listRecords", { user_id: userId, status: "rejected" }),
      ]);
      if (request !== loadRequest) return;
      pending.value = Array.isArray(p) ? p : null;
      rejected.value = Array.isArray(r) ? r : null;
    } else {
      pending.value = null;
      rejected.value = null;
    }
  } catch (error) {
    if (request === loadRequest) erro.value = error.message || "Não foi possível abrir este perfil.";
  } finally {
    if (request === loadRequest) loading.value = false;
  }
}

async function saveProfile() {
  if ([...editForm.value.nickname.trim()].length > 22) return toast.error("Nickname até 22 caracteres.");
  savingProfile.value = true;
  try {
    const r = await apiPost("updateMe", editForm.value);
    if (r.erro) return toast.error(r.erro);
    toast.success("Perfil salvo.");
    await load();
  } finally {
    savingProfile.value = false;
  }
}

async function changePassword() {
  passwordError.value = "";
  if (hasPassword.value && !passwordForm.value.current) return passwordError.value = "Informe sua senha atual.";
  if (!isStrongPassword(passwordForm.value.next)) return passwordError.value = passwordMessage;
  if (passwordForm.value.next !== passwordForm.value.confirmation) return passwordError.value = "A confirmação não é igual à nova senha.";
  changingPassword.value = true;
  try {
    const r = await apiPost("changePassword", { current_password: passwordForm.value.current, new_password: passwordForm.value.next });
    if (r.erro) return passwordError.value = r.erro;
    if (profile.value) profile.value.has_password = true;
    await auth.fetchMe();
    passwordForm.value = { current: "", next: "", confirmation: "" };
    toast.success("Senha atualizada com segurança.");
  } finally { changingPassword.value = false; }
}
async function deleteAccount() {
  deleteError.value = "";
  if (deleteForm.value.email.trim().toLowerCase() !== String(auth.user?.email || "").toLowerCase()) return deleteError.value = "Informe o e-mail desta conta para confirmar.";
  if (!deleteForm.value.password) return deleteError.value = "Informe sua senha para confirmar a exclusão.";
  deleting.value = true;
  try {
    const r = await apiPost("deleteMe", { email: deleteForm.value.email, password: deleteForm.value.password });
    if (r.erro) return deleteError.value = r.erro;
    auth.clearSession();
    toast.success("Sua conta e seus dados foram excluídos.");
    router.push("/");
  } finally { deleting.value = false; }
}

watch(() => route.fullPath, load);
onMounted(load);
</script>

<template>
  <div v-if="loading" class="state-panel" role="status"><div class="loading-orbit"></div><p>Carregando perfil…</p></div>

  <div v-else-if="erro" class="state-panel" role="alert">
    <h1>Não foi possível abrir o perfil</h1>
    <p>{{ erro }}</p>
    <button class="btn-secondary" @click="load">Tentar novamente</button>
  </div>

  <div v-else-if="profile" class="grid gap-8">
    <div class="card flex flex-wrap items-center gap-4">
      <div class="profile-avatar grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-sky-400 to-fuchsia-500 text-xl font-bold text-white">
        <img v-if="avatarUrl" :src="avatarUrl" alt="" referrerpolicy="no-referrer" />
        <template v-else>{{ (profile.nickname || "?").slice(0, 1).toUpperCase() }}</template>
      </div>
      <div class="min-w-0 flex-1">
        <h1 class="truncate text-2xl font-bold text-slate-50">{{ profile.nickname }}</h1>
        <p class="text-sm text-slate-400">{{ profile.points ?? 0 }} pontos · {{ profile.role === "admin" ? "admin" : "jogador" }}</p>
        <p v-if="profile.bio" class="mt-1 text-sm text-slate-300">{{ profile.bio }}</p>
        <a
          v-if="profile.youtube_url"
          :href="safeUrl(profile.youtube_url)"
          target="_blank"
          rel="noopener"
          class="link mt-1 inline-block text-sm"
          @click="(e) => confirmOpen(e, profile.nickname)"
        >Canal do YouTube ↗</a>
      </div>
    </div>

    <div class="profile-layout">
      <nav class="profile-tabs" aria-label="Seções do perfil" role="tablist">
        <p class="profile-tabs-title">Minha conta</p>
        <button type="button" :class="{ 'is-active': activeTab === 'records' }" role="tab" :aria-selected="activeTab === 'records'" @click="activeTab = 'records'"><span>Records</span><small>Histórico de jogo</small></button>
        <button v-if="isOwner" type="button" :class="{ 'is-active': activeTab === 'profile' }" role="tab" :aria-selected="activeTab === 'profile'" @click="activeTab = 'profile'"><span>Perfil</span><small>Dados públicos</small></button>
        <button v-if="isOwner" type="button" :class="{ 'is-active': activeTab === 'security' }" role="tab" :aria-selected="activeTab === 'security'" @click="activeTab = 'security'"><span>Segurança</span><small>Senha e conta</small></button>
      </nav>

      <div class="profile-content">
    <section v-if="isOwner && activeTab === 'profile'" class="card">
      <h2 class="section-title mb-3">Editar perfil</h2>
      <form class="grid gap-3 sm:max-w-md" novalidate @submit.prevent="saveProfile">
        <input v-model="editForm.nickname" aria-label="Nickname" autocomplete="nickname" placeholder="Nickname (máx 22)" class="field" />
        <input v-model="editForm.bio" aria-label="Informações sobre você" placeholder="Info sobre você" class="field" />
        <input v-model="editForm.youtube_url" aria-label="Canal do YouTube" type="url" placeholder="Canal do YouTube (só YouTube)" class="field" />
        <button class="btn-primary" :disabled="savingProfile">{{ savingProfile ? "Salvando..." : "Salvar perfil" }}</button>
      </form>
    </section>

    <div v-show="activeTab === 'records'" class="grid gap-8">
    <section>
      <h2 class="section-title mb-3">Aprovados pela comunidade</h2>
      <RecordsTable :records="communityOk" :show-user="false" empty-text="Nenhum." />
    </section>

    <section>
      <h2 class="section-title mb-3">Aprovados pelo admin</h2>
      <RecordsTable :records="adminOk" :show-user="false" :show-community="true" empty-text="Nenhum." />
    </section>

    <section v-if="canSeeQueue && pending">
      <h2 class="section-title mb-3">Aguardando validação</h2>
      <RecordsTable :records="pending" :show-user="false" :show-type="true" empty-text="Nada pendente." />
    </section>

    <section v-if="canSeeQueue && rejected">
      <h2 class="section-title mb-3">Rejeitados</h2>
      <RecordsTable :records="rejected" :show-user="false" :show-note="true" empty-text="Nada rejeitado." />
    </section>
    </div>

    <section v-if="isOwner && activeTab === 'security'" class="profile-security">
      <div class="card">
        <p class="eyebrow">ACESSO À CONTA</p>
        <h2 class="section-title mt-2">{{ hasPassword ? "Atualizar senha" : "Definir uma senha" }}</h2>
        <p class="mt-1 text-sm text-slate-400">{{ hasPassword ? "Confirme sua senha atual e escolha uma nova senha segura." : "Você acessa com Google. Defina uma senha se também quiser entrar com e-mail e senha." }}</p>
        <form class="mt-4 grid max-w-md gap-3" novalidate @submit.prevent="changePassword">
          <PasswordInput v-if="hasPassword" v-model="passwordForm.current" autocomplete="current-password" placeholder="Senha atual" class="field" />
          <PasswordInput v-model="passwordForm.next" autocomplete="new-password" placeholder="Nova senha" class="field" />
          <PasswordInput v-model="passwordForm.confirmation" autocomplete="new-password" placeholder="Confirmar nova senha" class="field" />
          <p v-if="passwordError" class="form-error">{{ passwordError }}</p>
          <button class="btn-primary w-fit" :disabled="changingPassword">{{ changingPassword ? "Atualizando…" : hasPassword ? "Atualizar senha" : "Definir senha" }}</button>
        </form>
      </div>
      <div class="danger-zone">
        <p class="eyebrow">AÇÃO IRREVERSÍVEL</p>
        <h2 class="section-title mt-2">Excluir minha conta</h2>
        <p>Seus dados de perfil, sessões, records e votos serão removidos permanentemente. Confirme com seu e-mail e senha.</p>
        <form class="mt-4 grid max-w-md gap-3" novalidate @submit.prevent="deleteAccount">
          <input v-model="deleteForm.email" type="email" autocomplete="email" placeholder="E-mail da conta" class="field" />
          <PasswordInput v-model="deleteForm.password" autocomplete="current-password" placeholder="Senha" class="field" />
          <p v-if="deleteError" class="form-error">{{ deleteError }}</p>
          <button class="btn-danger w-fit" :disabled="deleting">{{ deleting ? "Excluindo…" : "Excluir minha conta" }}</button>
        </form>
      </div>
    </section>
      </div>
    </div>
  </div>

  <div v-else class="state-panel">Perfil indisponível no momento.</div>
</template>
