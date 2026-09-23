<script setup>
import AppSelect from "../../../components/AppSelect.vue";
import { nextTick, onMounted, reactive, ref } from "vue";
import { apiGet, apiPage, apiPost } from "../../../lib/api";
import { useAuthStore } from "../../../stores/auth";
import { useToastStore } from "../../../stores/toast";
import { useConfirmStore } from "../../../stores/confirm";
import { useLookupsStore } from "../../../stores/lookups";
import { fmtDate, mlabel, safeUrl, trustedVideoUrl, wlabel } from "../../../lib/format";
import RecordsTable from "../../../components/RecordsTable.vue";
import Pager from "../../../components/Pager.vue";
import PasswordInput from "../../../components/PasswordInput.vue";
import { isStrongPassword, passwordMessage } from "../../../lib/password";

const auth = useAuthStore();
const toast = useToastStore();
const confirm = useConfirmStore();
const lookups = useLookupsStore();

const courses = ref([]);
const bands = ref([]);
const activeTab = ref("pending");
const tabLoaded = reactive({ pending: false, records: false, users: false, catalog: false });
const tabLoading = reactive({ pending: false, records: false, users: false, catalog: false });
const adminTabs = [
  { id: "pending", label: "Revisar pedidos", hint: "Validação" },
  { id: "records", label: "Records", hint: "Index e edição" },
  { id: "users", label: "Usuários", hint: "Acessos" },
  { id: "catalog", label: "Catálogo", hint: "Courses e faixas" },
];

// ---- pendentes ----
const pend = ref([]);
const pendTotal = ref(0);
const pendPage = ref(1);
const pendingUsers = ref([]);
const pendRealloc = reactive({}); // id -> { course_id, powerband_id, note }

async function renderPending(page = 1) {
  tabLoading.pending = true;
  pendPage.value = page;
  try {
    const [{ rows, total }, users] = await Promise.all([
      apiPage("listPending", {}, page),
      apiGet("listPendingUsers"),
    ]);
    pend.value = rows;
    pendTotal.value = total;
    pendingUsers.value = Array.isArray(users) ? users : [];
    rows.forEach((r) => {
      if (!pendRealloc[r.id]) pendRealloc[r.id] = { course_id: r.course_id, powerband_id: r.powerband_id, note: "" };
    });
    tabLoaded.pending = true;
  } finally { tabLoading.pending = false; }
}

function pendBadge(r) {
  const com = Number(r.community || 0);
  if (com === 1) return { text: "✓ comunidade — decisão final", cls: "badge-best" };
  if (com === -1) return { text: r.edited === "TRUE" ? "✗ comunidade — revisão pedida" : "✗ comunidade — revisar", cls: "badge-danger" };
  if (r.edit_of) return { text: "proposta de melhoria", cls: "badge-info" };
  if (r.edited === "TRUE") return { text: "edição (reenviado)", cls: "badge-warn" };
  return { text: "novo pedido", cls: "badge-neutral" };
}
function okLabel(r) {
  const com = Number(r.community || 0);
  return com === -1 ? "Confirmar rejeição" : com === 1 ? "Aprovar (final)" : "Aprovar";
}
function noLabel(r) {
  const com = Number(r.community || 0);
  return com === -1 ? "Reabrir votação" : com === 1 ? "Devolver p/ votação" : "Rejeitar";
}

async function validate(r, status) {
  const com = Number(r.community || 0);
  if (com !== 0 && status === "rejected") {
    const reopens = com === -1;
    if (!await confirm.ask({ title: reopens ? "Reabrir votação?" : "Devolver para votação?", message: reopens ? "A rejeição será desfeita e a comunidade poderá votar novamente." : "O record voltará para votação da comunidade e os votos atuais serão apagados.", confirmLabel: reopens ? "Reabrir votação" : "Devolver para votação" })) return;
    const ro = await apiPost("reopenVote", { id: r.id });
    if (ro.erro) return toast.error(ro.erro);
    toast.success("Voltou p/ votação da comunidade.");
    renderPending(pendPage.value);
    reloadAllRecords(allPage.value);
    return;
  }
  const realloc = pendRealloc[r.id] || {};
  const res = await apiPost("validateRecord", { id: r.id, status, course_id: realloc.course_id, powerband_id: realloc.powerband_id, note: realloc.note });
  if (res.erro) return toast.error(res.erro);
  toast.success(com === -1 ? "Rejeição confirmada (fora do index)." : com === 1 ? "Aprovado (final)." : "Validado.");
  renderPending(pendPage.value);
  reloadAllRecords(allPage.value);
}

// ---- todos os records ----
const ALL_FILTERS = {
  all: { status: "all" },
  pending: { status: "pending" },
  approved: { status: "approved" },
  rejected: { status: "rejected" },
  comm_ok: { status: "all", community: "1" },
  comm_rejected: { status: "all", community: "-1" },
  final: { status: "pending", community: "1" },
  best: { status: "all", best: "1" },
  proposal: { status: "all", proposal: "1" },
  edited: { status: "all", edited: "1" },
};
const allFilter = ref("all");
const allRows = ref([]);
const allTotal = ref(0);
const allPage = ref(1);

async function reloadAllRecords(page = 1) {
  tabLoading.records = true;
  allPage.value = page;
  try {
    const { rows, total, erro } = await apiPage("listRecords", ALL_FILTERS[allFilter.value] || ALL_FILTERS.all, page);
    allRows.value = erro ? [] : rows;
    allTotal.value = total;
    tabLoaded.records = true;
  } finally { tabLoading.records = false; }
}

// ---- editar record (form) ----
const rEdit = reactive({ id: "", score: "", pang: "", method: "com_ajuda", wind: "normal", course_id: "", powerband_id: "", power_value: "", screenshot_url: "", video_url: "", status: "pending", note: "", community: "0" });
let rOrigStatus = "";
let rOrigCommunity = "0";

async function editRecord(r) {
  Object.assign(rEdit, {
    id: r.id,
    score: r.score,
    pang: r.pang ?? "",
    method: r.method || "com_ajuda",
    wind: r.wind || "normal",
    course_id: r.course_id,
    powerband_id: r.powerband_id,
    power_value: r.power_value,
    screenshot_url: r.screenshot_url || "",
    video_url: r.video_url || "",
    status: r.status,
    note: r.note || "",
    community: String(Number(r.community || 0)),
  });
  rOrigStatus = r.status;
  rOrigCommunity = String(Number(r.community || 0));
  activeTab.value = "records";
  await nextTick();
  document.getElementById("f-record")?.scrollIntoView({ behavior: "smooth", block: "start" });
}
function resetRecordForm() {
  Object.assign(rEdit, { id: "", score: "", pang: "", method: "com_ajuda", wind: "normal", course_id: "", powerband_id: "", power_value: "", screenshot_url: "", video_url: "", status: "pending", note: "", community: "0" });
}
function onCommunityChange() {
  // Publishing a manual community decision always makes the record eligible
  // for the public ranking and BEST calculation.
  if (rEdit.community === "1") rEdit.status = "approved";
}
async function reopen(id) {
  if (!await confirm.ask({ title: "Reabrir votação?", message: "Os votos antigos serão apagados e o record voltará para a comunidade.", confirmLabel: "Reabrir votação" })) return;
  const r = await apiPost("reopenVote", { id });
  if (r.erro) return toast.error(r.erro);
  toast.success("Votação reaberta.");
  reloadAllRecords(allPage.value);
}
async function validateFromRecords(r, status) {
  const approving = status === "approved";
  if (!await confirm.ask({
    title: approving ? "Aprovar este record?" : "Reprovar este record?",
    message: approving ? `${r.nickname || "Jogador"} · score ${r.score}. O BEST da categoria será recalculado.` : `${r.nickname || "Jogador"} · score ${r.score}. O record sairá da listagem pública.`,
    confirmLabel: approving ? "Confirmar aprovação" : "Confirmar reprovação",
    tone: approving ? "primary" : "danger",
  })) return;
  try {
    const result = await apiPost("validateRecord", {
      id: r.id,
      status,
      course_id: r.course_id,
      powerband_id: r.powerband_id,
      method: r.method,
      wind: r.wind,
      note: r.note || "",
    });
    if (result.erro) return toast.error(result.erro);
    toast.success(status === "approved" ? "Record aprovado." : "Record reprovado.");
    reloadAllRecords(allPage.value);
    renderPending(pendPage.value);
  } catch (error) {
    toast.error(error.message || "Não foi possível atualizar o record.");
  }
}
async function saveRecord() {
  if (!rEdit.id) return toast.error("Escolha um record (Editar) primeiro.");
  const data = {
    score: Number(rEdit.score),
    pang: Number(rEdit.pang || 0),
    method: rEdit.method,
    wind: rEdit.wind,
    course_id: rEdit.course_id,
    powerband_id: rEdit.powerband_id,
    power_value: Number(rEdit.power_value),
    screenshot_url: rEdit.screenshot_url.trim(),
    video_url: rEdit.video_url.trim(),
    note: rEdit.note,
  };
  if (data.screenshot_url && safeUrl(data.screenshot_url) === "#") return toast.error("URL do print inválida (use http/https).");
  if (data.video_url && !trustedVideoUrl(data.video_url)) return toast.error("Use vídeo do YouTube, Twitch, Vimeo, TikTok, Kick, Facebook ou Instagram.");

  let r = await apiPost("updateRecord", { id: rEdit.id, direct: true, data });
  if (!r.erro && !r.proposal && (rEdit.status !== rOrigStatus || rEdit.community !== rOrigCommunity)) {
    r = await apiPost("validateRecord", { id: rEdit.id, status: rEdit.status, course_id: data.course_id, powerband_id: data.powerband_id, note: rEdit.note, community: rEdit.community });
  }
  if (!r.erro && !r.proposal && rOrigCommunity === "-1" && rEdit.community === "0") {
    const ro = await apiPost("reopenVote", { id: rEdit.id });
    if (ro.erro) return toast.error(ro.erro);
  }
  if (r.erro) return toast.error(r.erro);
  toast.success(r.proposal ? "Proposta enviada — original segue valendo até aprovação total." : "Record salvo.");
  resetRecordForm();
  reloadAllRecords(allPage.value);
  renderPending(pendPage.value);
}

// ---- usuários ----
const users = ref([]);
const usersTotal = ref(0);
const usersPage = ref(1);
const shownEmails = reactive({});
const passwordResetTarget = ref(null);
const resetPassword = ref("");
const resetPasswordError = ref("");
const resettingPassword = ref(false);
function activeBadge(value) {
  const active = String(value).toLowerCase() === "active" || String(value).toUpperCase() === "TRUE" || value === true;
  return active ? { text: "Ativo", cls: "badge-best" } : { text: "Inativo", cls: "badge-neutral" };
}
function userStatusBadge(status) {
  return String(status).toLowerCase() === "active" ? { text: "Ativo", cls: "badge-best" } : { text: "Bloqueado", cls: "badge-danger" };
}

async function reloadUsers(page = 1) {
  tabLoading.users = true;
  usersPage.value = page;
  try {
    const { rows, total } = await apiPage("listUsers", {}, page);
    users.value = rows;
    usersTotal.value = total;
    tabLoaded.users = true;
  } finally { tabLoading.users = false; }
}
async function toggleUserStatus(u) {
  const to = u.status === "active" ? "blocked" : "active";
  const blocking = to === "blocked";
  if (!await confirm.ask({
    title: blocking ? "Bloquear esta conta?" : "Liberar esta conta?",
    message: blocking ? `${u.nickname} não poderá enviar records nem participar das votações até ser liberado novamente.` : `${u.nickname} poderá enviar records e participar das votações novamente.`,
    confirmLabel: blocking ? "Bloquear conta" : "Liberar conta",
    tone: blocking ? "danger" : "primary",
  })) return;
  const r = await apiPost("setUserStatus", { id: u.id, status: to });
  if (r.erro) return toast.error(r.erro);
  toast.success("Conta atualizada.");
  if (tabLoaded.pending) renderPending(pendPage.value);
  if (tabLoaded.users) reloadUsers(usersPage.value);
}
async function approvePendingUser(u) {
  if (!await confirm.ask({
    title: "Liberar esta conta?",
    message: `${u.nickname} poderá enviar records e votar quando alcançar os pontos necessários.`,
    confirmLabel: "Liberar conta",
  })) return;
  const r = await apiPost("setUserStatus", { id: u.id, status: "active" });
  if (r.erro) return toast.error(r.erro);
  toast.success(`${u.nickname} recebeu acesso.`);
  renderPending(pendPage.value);
  if (tabLoaded.users) reloadUsers(usersPage.value);
}
function openPasswordReset(u) {
  passwordResetTarget.value = u;
  resetPassword.value = "";
  resetPasswordError.value = "";
}
function closePasswordReset() {
  passwordResetTarget.value = null;
  resetPassword.value = "";
  resetPasswordError.value = "";
}
async function resetUserPassword() {
  resetPasswordError.value = "";
  if (!isStrongPassword(resetPassword.value)) return resetPasswordError.value = passwordMessage;
  resettingPassword.value = true;
  try {
    const r = await apiPost("adminResetPassword", { id: passwordResetTarget.value?.id, new_password: resetPassword.value });
    if (r.erro) return resetPasswordError.value = r.erro;
    toast.success(`Senha de ${passwordResetTarget.value.nickname} redefinida. As sessões dessa conta foram encerradas.`);
    closePasswordReset();
  } finally { resettingPassword.value = false; }
}

// ---- courses / faixas ----
async function reloadTables() {
  tabLoading.catalog = true;
  try {
    const [c, b] = await Promise.all([apiGet("listCourses", { include_inactive: "1" }), apiGet("listBands", { include_inactive: "1" })]);
    courses.value = c;
    bands.value = b;
    tabLoaded.catalog = true;
  } finally { tabLoading.catalog = false; }
}

async function selectTab(id) {
  activeTab.value = id;
  if (tabLoaded[id] || tabLoading[id]) return;
  if (id === "pending") await renderPending(1);
  else if (id === "records") await reloadAllRecords(1);
  else if (id === "users") await reloadUsers(1);
  else if (id === "catalog") await reloadTables();
}

const courseForm = reactive({ id: "", name: "", active: true });
function resetCourseForm() {
  Object.assign(courseForm, { id: "", name: "", active: true });
}
function editCourse(c) {
  Object.assign(courseForm, { id: c.id, name: c.name, active: String(c.active).toUpperCase() === "TRUE" });
}
async function saveCourse() {
  const r = await apiPost("upsertCourse", { id: courseForm.id || undefined, data: { name: courseForm.name, active: courseForm.active ? "TRUE" : "FALSE" } });
  if (r.erro) return toast.error(r.erro);
  toast.success("Course salvo.");
  resetCourseForm();
  reloadTables();
}
async function deleteCourse(c) {
  if (!await confirm.ask({ title: "Excluir course?", message: `O course “${c.name}” será removido permanentemente.`, confirmLabel: "Excluir course", tone: "danger" })) return;
  const r = await apiPost("deleteCourse", { id: c.id });
  if (r.erro) return toast.error(r.erro);
  toast.success("Course excluído.");
  reloadTables();
}

const bandForm = reactive({ id: "", label: "", min: "", max: "", active: true });
function resetBandForm() {
  Object.assign(bandForm, { id: "", label: "", min: "", max: "", active: true });
}
function editBand(b) {
  Object.assign(bandForm, { id: b.id, label: b.label, min: b.min, max: b.max, active: String(b.active).toUpperCase() === "TRUE" });
}
async function saveBand() {
  const r = await apiPost("upsertBand", { id: bandForm.id || undefined, data: { label: bandForm.label, min: Number(bandForm.min), max: Number(bandForm.max), active: bandForm.active ? "TRUE" : "FALSE" } });
  if (r.erro) return toast.error(r.erro);
  toast.success("Faixa salva.");
  resetBandForm();
  reloadTables();
}
async function deleteBand(b) {
  if (!await confirm.ask({ title: "Excluir faixa?", message: `A faixa “${b.label}” será removida. Records compatíveis serão realocados quando possível.`, confirmLabel: "Excluir faixa", tone: "danger" })) return;
  const r = await apiPost("deleteBand", { id: b.id });
  if (r.erro) return toast.error(r.erro);
  toast.success(`Faixa excluída (${r.realocados ?? 0} records realocados).`);
  reloadTables();
}

onMounted(async () => {
  await Promise.all([lookups.ensure(), selectTab("pending")]);
});
</script>

<template>
  <div class="grid gap-6">
    <h1 class="text-2xl font-bold text-slate-50">Gerenciar</h1>

    <div class="admin-layout">
      <nav class="admin-tabs" aria-label="Seções de gerenciamento" role="tablist">
        <p class="admin-tabs-title">Painel administrativo</p>
        <button v-for="tab in adminTabs" :key="tab.id" type="button" class="admin-tab" :class="{ 'is-active': activeTab === tab.id }" :aria-selected="activeTab === tab.id" :aria-controls="`admin-${tab.id}`" role="tab" @click="selectTab(tab.id)">
          <span>{{ tab.label }}</span>
          <small>{{ tab.hint }}</small>
        </button>
      </nav>

      <div class="admin-content">
    <!-- pendentes -->
    <section v-show="activeTab === 'pending'" id="admin-pending" role="tabpanel">
      <h2 class="section-title mb-3">Records pendentes</h2>
      <div v-if="tabLoading.pending" class="state-panel" role="status"><div class="loading-orbit"></div><p>Carregando pedidos…</p></div>
      <template v-else>
      <section v-if="pendingUsers.length" class="mb-6" aria-label="Novos usuários aguardando liberação">
        <div class="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div><p class="eyebrow">ACESSO</p><h3 class="section-title mt-1">Novos usuários</h3></div>
          <span class="badge-warn">{{ pendingUsers.length }} aguardando</span>
        </div>
        <div class="grid gap-3 sm:grid-cols-2">
          <article v-for="u in pendingUsers" :key="u.id" class="card admin-mobile-card">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0"><b class="block truncate text-slate-100">{{ u.nickname }}</b><span class="mt-1 block truncate text-xs text-slate-400">{{ u.email }}</span></div>
              <span class="badge-neutral shrink-0">{{ u.login_google ? "Google" : "Senha" }}</span>
            </div>
            <div class="mt-3 flex items-center justify-between gap-3 border-t border-slate-800 pt-3">
              <span class="text-xs text-slate-500">{{ fmtDate(u.created_at) }}</span>
              <button class="btn-primary !px-2.5 !py-1 text-xs" @click="approvePendingUser(u)">Liberar acesso</button>
            </div>
          </article>
        </div>
      </section>
      <div v-if="!pend.length" class="card py-8 text-center text-sm text-slate-500">Nenhum record pendente.</div>
      <div class="grid gap-3">
        <div v-for="r in pend" :key="r.id" class="card">
          <div class="flex flex-wrap items-center gap-2 text-sm">
            <b class="text-base text-slate-100">{{ r.score }}</b>
            <span class="text-slate-400">({{ r.pang ?? "" }} pang)</span>
            <span class="badge-neutral">{{ mlabel(r.method) }}</span>
            <span class="text-slate-400">{{ wlabel(r.wind) }}</span>
            <RouterLink :to="{ path: '/profile', query: { id: r.user_id } }" class="link">{{ r.nickname || r.user_id }}</RouterLink>
            <span class="text-slate-500">— {{ lookups.cname(r.course_id) }}/{{ lookups.bname(r.powerband_id) }} ({{ r.power_value }})</span>
            <span class="text-slate-500">· enviado em {{ fmtDate(r.submitted_at) }}</span>
            <span :class="pendBadge(r).cls">{{ pendBadge(r).text }}</span>
          </div>
          <div class="mt-2 flex gap-3 text-sm">
            <a v-if="r.screenshot_url" :href="safeUrl(r.screenshot_url)" target="_blank" rel="noopener" class="link">print</a>
            <a v-if="r.video_url" :href="safeUrl(r.video_url)" target="_blank" rel="noopener" class="link">vídeo</a>
          </div>
          <div v-if="pendRealloc[r.id]" class="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-4">
            <AppSelect aria-label="Realocar campo" v-model="pendRealloc[r.id].course_id" class="field !py-1.5 text-sm">
              <option v-for="c in courses" :key="c.id" :value="c.id">{{ c.name }}</option>
            </AppSelect>
            <AppSelect aria-label="Realocar faixa" v-model="pendRealloc[r.id].powerband_id" class="field !py-1.5 text-sm">
              <option v-for="b in bands" :key="b.id" :value="b.id">{{ b.label }}</option>
            </AppSelect>
            <input v-model="pendRealloc[r.id].note" placeholder="nota p/ realocação" class="field !py-1.5 text-sm sm:col-span-2" />
          </div>
          <div class="mt-3 flex gap-2">
            <button class="btn-primary !bg-emerald-600 !shadow-emerald-600/30 hover:!bg-emerald-500" @click="validate(r, 'approved')">{{ okLabel(r) }}</button>
            <button class="btn-danger" @click="validate(r, 'rejected')">{{ noLabel(r) }}</button>
          </div>
        </div>
      </div>
      <Pager :page="pendPage" :total="pendTotal" @change="renderPending" />
      </template>
    </section>

    <!-- todos os records -->
    <section v-show="activeTab === 'records'" id="admin-records" role="tabpanel">
      <h2 class="section-title mb-3">Todos os records</h2>
      <AppSelect aria-label="Filtrar records" v-model="allFilter" class="field mb-3 max-w-xs" @change="reloadAllRecords(1)">
        <option value="all">Todos</option>
        <option value="pending">Pendentes</option>
        <option value="approved">Aprovados</option>
        <option value="rejected">Rejeitados</option>
        <option value="comm_ok">Aprovados pela comunidade</option>
        <option value="comm_rejected">Rejeitados pela comunidade</option>
        <option value="final">Fila final (comunidade)</option>
        <option value="best">⭐ Best</option>
        <option value="proposal">Propostas</option>
        <option value="edited">Edições</option>
      </AppSelect>
      <RecordsTable :records="allRows" :loading="tabLoading.records" :show-status="true" :show-community="true" :show-type="true" :show-note="true" empty-text="Nada aqui.">
        <template #actions="{ record: r }">
          <div class="flex flex-wrap gap-1.5">
            <button class="btn-secondary !px-2.5 !py-1 text-xs" @click="editRecord(r)">Editar</button>
            <button v-if="r.status !== 'approved'" class="btn-primary !px-2.5 !py-1 text-xs" @click="validateFromRecords(r, 'approved')">Aprovar</button>
            <button v-if="r.status !== 'rejected'" class="btn-danger !px-2.5 !py-1 text-xs" @click="validateFromRecords(r, 'rejected')">Reprovar</button>
            <button v-if="Number(r.community || 0) === -1" class="btn-secondary !px-2.5 !py-1 text-xs" @click="reopen(r.id)">Reabrir votação</button>
          </div>
        </template>
      </RecordsTable>
      <Pager :page="allPage" :total="allTotal" @change="reloadAllRecords" />

      <form id="f-record" class="card mt-5 grid gap-3 sm:grid-cols-2" novalidate @submit.prevent="saveRecord">
        <h3 class="section-title sm:col-span-2">Editar record</h3>
        <input v-model="rEdit.score" type="number" placeholder="Score" required class="field" />
        <input v-model="rEdit.pang" type="number" placeholder="Pang" class="field" />
        <AppSelect aria-label="Método" v-model="rEdit.method" class="field">
          <option value="sem_ajuda">Sem ajuda</option>
          <option value="com_ajuda">Com ajuda</option>
        </AppSelect>
        <AppSelect aria-label="Vento" v-model="rEdit.wind" class="field">
          <option value="normal">Normal</option>
          <option value="natural">Natural</option>
        </AppSelect>
        <AppSelect aria-label="Campo" v-model="rEdit.course_id" required class="field">
          <option v-for="c in courses" :key="c.id" :value="c.id">{{ c.name }}</option>
        </AppSelect>
        <AppSelect aria-label="Faixa de força" v-model="rEdit.powerband_id" required class="field">
          <option v-for="b in bands" :key="b.id" :value="b.id">{{ b.label }}</option>
        </AppSelect>
        <input v-model="rEdit.power_value" type="number" placeholder="Força" required class="field" />
        <input v-model="rEdit.screenshot_url" placeholder="URL do print" class="field" />
        <input v-model="rEdit.video_url" placeholder="URL do vídeo" class="field" />
        <AppSelect aria-label="Status" v-model="rEdit.status" class="field">
          <option value="pending">Pendente</option>
          <option value="approved">Aprovado</option>
          <option value="rejected">Rejeitado</option>
        </AppSelect>
        <input v-model="rEdit.note" placeholder="nota (opcional)" class="field" />
        <label class="flex items-center gap-2 text-sm text-slate-300 sm:col-span-2">
          Comunidade:
          <AppSelect aria-label="Situação na comunidade" v-model="rEdit.community" class="field !w-auto" @change="onCommunityChange">
            <option value="-1">reprovado</option>
            <option value="0">não votado</option>
            <option value="1">aprovado</option>
          </AppSelect>
          <span v-if="rEdit.community === '1'" class="text-xs text-emerald-300">O status será aprovado e o BEST recalculado.</span>
        </label>
        <div class="flex gap-2 sm:col-span-2">
          <button class="btn-primary">Salvar record</button>
          <button type="button" class="btn-secondary" @click="resetRecordForm">Limpar</button>
        </div>
      </form>
    </section>

    <!-- usuários -->
    <section v-show="activeTab === 'users'" id="admin-users" role="tabpanel">
      <h2 class="section-title mb-3">Usuários</h2>
      <section v-if="passwordResetTarget" class="card mb-4 border-amber-400/30 bg-amber-400/5">
        <p class="eyebrow">REDEFINIR ACESSO</p>
        <h3 class="mt-2 text-base font-bold text-slate-100">Nova senha para {{ passwordResetTarget.nickname }}</h3>
        <p class="mt-1 text-sm text-slate-400">A pessoa será desconectada de todos os dispositivos e deverá entrar com esta nova senha.</p>
        <form class="mt-4 grid max-w-md gap-3" novalidate @submit.prevent="resetUserPassword">
          <PasswordInput v-model="resetPassword" autocomplete="new-password" placeholder="Nova senha" class="field" @input="resetPasswordError = ''" />
          <p v-if="resetPasswordError" class="form-error">{{ resetPasswordError }}</p>
          <div class="flex flex-wrap gap-2">
            <button class="btn-primary" :disabled="resettingPassword">{{ resettingPassword ? "Redefinindo…" : "Redefinir senha" }}</button>
            <button type="button" class="btn-secondary" :disabled="resettingPassword" @click="closePasswordReset">Cancelar</button>
          </div>
        </form>
      </section>
      <div v-if="tabLoading.users" class="state-panel" role="status"><div class="loading-orbit"></div><p>Carregando usuários…</p></div>
      <template v-else><div class="thin-scroll hidden overflow-x-auto rounded-xl border border-slate-800 md:block">
        <table class="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr class="border-b border-slate-800 bg-slate-900/70 text-left text-xs tracking-wide text-slate-400 uppercase">
              <th class="px-3 py-2.5 font-medium">Nickname</th>
              <th class="px-3 py-2.5 font-medium">Email</th>
              <th class="px-3 py-2.5 font-medium">Role</th>
              <th class="px-3 py-2.5 font-medium">Status</th>
              <th class="px-3 py-2.5 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in users" :key="u.id" class="border-b border-slate-800/60 last:border-0 hover:bg-slate-900/40">
              <td class="px-3 py-2.5"><RouterLink :to="{ path: '/profile', query: { id: u.id } }" class="link">{{ u.nickname }}</RouterLink></td>
              <td class="px-3 py-2.5 text-slate-300">
                <span>{{ shownEmails[u.id] ? u.email : "••••••" }}</span>
                <button class="ml-1.5 text-slate-500 hover:text-slate-300" title="mostrar/ocultar" @click="shownEmails[u.id] = !shownEmails[u.id]">{{ shownEmails[u.id] ? "🙈" : "👁️" }}</button>
              </td>
              <td class="px-3 py-2.5 text-slate-300">{{ u.role }}</td>
              <td class="px-3 py-2.5"><span :class="userStatusBadge(u.status).cls">{{ userStatusBadge(u.status).text }}</span></td>
              <td class="px-3 py-2.5">
                <span v-if="u.id === auth.user?.id" class="text-slate-500">(você)</span>
                <div v-else class="flex flex-wrap gap-1.5">
                  <button :class="u.status === 'active' ? 'btn-danger !px-2.5 !py-1 text-xs' : 'btn-secondary !px-2.5 !py-1 text-xs'" @click="toggleUserStatus(u)">{{ u.status === "active" ? "Bloquear" : "Liberar" }}</button>
                  <button class="btn-secondary !px-2.5 !py-1 text-xs" @click="openPasswordReset(u)">Senha</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="grid gap-3 md:hidden">
        <article v-for="u in users" :key="u.id" class="card admin-mobile-card">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <RouterLink :to="{ path: '/profile', query: { id: u.id } }" class="link block truncate font-semibold">{{ u.nickname }}</RouterLink>
              <p class="mt-1 text-xs text-slate-400">{{ u.role }} · <span :class="userStatusBadge(u.status).cls">{{ userStatusBadge(u.status).text }}</span></p>
            </div>
            <span v-if="u.id === auth.user?.id" class="text-xs text-slate-500">você</span>
            <div v-else class="flex shrink-0 flex-wrap justify-end gap-1.5">
              <button :class="u.status === 'active' ? 'btn-danger !px-2.5 !py-1 text-xs' : 'btn-secondary !px-2.5 !py-1 text-xs'" @click="toggleUserStatus(u)">{{ u.status === "active" ? "Bloquear" : "Liberar" }}</button>
              <button class="btn-secondary !px-2.5 !py-1 text-xs" @click="openPasswordReset(u)">Senha</button>
            </div>
          </div>
          <div class="mt-3 flex items-center justify-between gap-3 border-t border-slate-800 pt-3 text-xs text-slate-400">
            <span class="truncate">{{ shownEmails[u.id] ? u.email : "••••••" }}</span>
            <button class="shrink-0 text-slate-300 hover:text-lime-200" :aria-label="shownEmails[u.id] ? 'Ocultar email' : 'Mostrar email'" :aria-expanded="!!shownEmails[u.id]" @click="shownEmails[u.id] = !shownEmails[u.id]">{{ shownEmails[u.id] ? "Ocultar e-mail" : "Mostrar e-mail" }}</button>
          </div>
        </article>
      </div>
      <Pager :page="usersPage" :total="usersTotal" @change="reloadUsers" /></template>
    </section>

    <!-- courses -->
    <div v-show="activeTab === 'catalog'" id="admin-catalog" role="tabpanel">
    <div v-if="tabLoading.catalog" class="state-panel" role="status"><div class="loading-orbit"></div><p>Carregando catálogo…</p></div>
    <template v-else>
    <section>
      <h2 class="section-title mb-3">Courses</h2>
      <div class="thin-scroll hidden overflow-x-auto rounded-xl border border-slate-800 md:block">
        <table class="w-full min-w-[420px] border-collapse text-sm">
          <thead>
            <tr class="border-b border-slate-800 bg-slate-900/70 text-left text-xs tracking-wide text-slate-400 uppercase">
              <th class="px-3 py-2.5 font-medium">ID</th>
              <th class="px-3 py-2.5 font-medium">Nome</th>
              <th class="px-3 py-2.5 font-medium">Ativo</th>
              <th class="px-3 py-2.5 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in courses" :key="c.id" class="border-b border-slate-800/60 last:border-0 hover:bg-slate-900/40">
              <td class="px-3 py-2.5 font-mono text-xs text-slate-500">{{ c.id }}</td>
              <td class="px-3 py-2.5 text-slate-200">{{ c.name }}</td>
              <td class="px-3 py-2.5"><span :class="activeBadge(c.active).cls">{{ activeBadge(c.active).text }}</span></td>
              <td class="px-3 py-2.5">
                <div class="flex gap-1.5">
                  <button class="btn-secondary !px-2.5 !py-1 text-xs" @click="editCourse(c)">Editar</button>
                  <button class="btn-danger !px-2.5 !py-1 text-xs" @click="deleteCourse(c)">Excluir</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="grid gap-3 md:hidden">
        <article v-for="c in courses" :key="c.id" class="card admin-mobile-card">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0"><b class="block truncate text-slate-100">{{ c.name }}</b><span class="mt-1 block font-mono text-[10px] text-slate-500">{{ c.id }}</span></div>
            <span :class="activeBadge(c.active).cls">{{ activeBadge(c.active).text }}</span>
          </div>
          <div class="mt-3 flex gap-2 border-t border-slate-800 pt-3"><button class="btn-secondary !px-2.5 !py-1 text-xs" @click="editCourse(c)">Editar</button><button class="btn-danger !px-2.5 !py-1 text-xs" @click="deleteCourse(c)">Excluir</button></div>
        </article>
      </div>
      <form class="card mt-4 grid max-w-md gap-3" novalidate @submit.prevent="saveCourse">
        <h3 class="section-title">{{ courseForm.id ? `Editar course (${courseForm.id})` : "Adicionar course" }}</h3>
        <input v-model="courseForm.name" placeholder="Nome do course" required class="field" />
        <label class="flex items-center gap-2 text-sm text-slate-300"><input v-model="courseForm.active" type="checkbox" class="accent-lime-300" /> ativo</label>
        <div class="flex gap-2">
          <button class="btn-primary">Salvar</button>
          <button type="button" class="btn-secondary" @click="resetCourseForm">Limpar</button>
        </div>
      </form>
    </section>

    <!-- faixas -->
    <section class="mt-8" aria-label="Faixas de força">
      <h2 class="section-title mb-3">Faixas de força</h2>
      <div class="thin-scroll hidden overflow-x-auto rounded-xl border border-slate-800 md:block">
        <table class="w-full min-w-[520px] border-collapse text-sm">
          <thead>
            <tr class="border-b border-slate-800 bg-slate-900/70 text-left text-xs tracking-wide text-slate-400 uppercase">
              <th class="px-3 py-2.5 font-medium">ID</th>
              <th class="px-3 py-2.5 font-medium">Faixa</th>
              <th class="px-3 py-2.5 font-medium">Min</th>
              <th class="px-3 py-2.5 font-medium">Max</th>
              <th class="px-3 py-2.5 font-medium">Ativo</th>
              <th class="px-3 py-2.5 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="b in bands" :key="b.id" class="border-b border-slate-800/60 last:border-0 hover:bg-slate-900/40">
              <td class="px-3 py-2.5 font-mono text-xs text-slate-500">{{ b.id }}</td>
              <td class="px-3 py-2.5 text-slate-200">{{ b.label }}</td>
              <td class="px-3 py-2.5 text-slate-300">{{ b.min }}</td>
              <td class="px-3 py-2.5 text-slate-300">{{ b.max }}</td>
              <td class="px-3 py-2.5"><span :class="activeBadge(b.active).cls">{{ activeBadge(b.active).text }}</span></td>
              <td class="px-3 py-2.5">
                <div class="flex gap-1.5">
                  <button class="btn-secondary !px-2.5 !py-1 text-xs" @click="editBand(b)">Editar</button>
                  <button class="btn-danger !px-2.5 !py-1 text-xs" @click="deleteBand(b)">Excluir</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="grid gap-3 md:hidden">
        <article v-for="b in bands" :key="b.id" class="card admin-mobile-card">
          <div class="flex items-start justify-between gap-3">
            <div><b class="text-slate-100">{{ b.label }}</b><span class="ml-2 text-xs text-slate-400">{{ b.min }}–{{ b.max }}</span><span class="mt-1 block font-mono text-[10px] text-slate-500">{{ b.id }}</span></div>
            <span :class="activeBadge(b.active).cls">{{ activeBadge(b.active).text }}</span>
          </div>
          <div class="mt-3 flex gap-2 border-t border-slate-800 pt-3"><button class="btn-secondary !px-2.5 !py-1 text-xs" @click="editBand(b)">Editar</button><button class="btn-danger !px-2.5 !py-1 text-xs" @click="deleteBand(b)">Excluir</button></div>
        </article>
      </div>
      <form class="card mt-4 grid max-w-md gap-3" novalidate @submit.prevent="saveBand">
        <h3 class="section-title">{{ bandForm.id ? `Editar faixa (${bandForm.id})` : "Adicionar faixa" }}</h3>
        <input v-model="bandForm.label" placeholder="Label (ex: 230-240)" required class="field" />
        <input v-model="bandForm.min" type="number" placeholder="min" required class="field" />
        <input v-model="bandForm.max" type="number" placeholder="max" required class="field" />
        <label class="flex items-center gap-2 text-sm text-slate-300"><input v-model="bandForm.active" type="checkbox" class="accent-lime-300" /> ativo</label>
        <div class="flex gap-2">
          <button class="btn-primary">Salvar</button>
          <button type="button" class="btn-secondary" @click="resetBandForm">Limpar</button>
        </div>
      </form>
    </section>
    </template>
    </div>
      </div>
    </div>
  </div>
</template>
