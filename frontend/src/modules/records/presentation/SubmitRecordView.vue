<script setup>
import AppSelect from "../../../components/AppSelect.vue";
import { computed, onMounted, reactive, ref } from "vue";
import { apiGet, apiPost } from "../../../lib/api";
import { useAuthStore } from "../../../stores/auth";
import { useToastStore } from "../../../stores/toast";
import { useConfirmStore } from "../../../stores/confirm";
import { useLookupsStore } from "../../../stores/lookups";
import { safeUrl, trustedVideoUrl } from "../../../lib/format";
import RecordsTable from "../../../components/RecordsTable.vue";

const auth = useAuthStore();
const toast = useToastStore();
const confirm = useConfirmStore();
const lookups = useLookupsStore();

const recs = ref([]);
const editId = ref("");
const saving = ref(false);
const errors = reactive({ course: "", power: "", method: "", wind: "", score: "", pang: "", screenshot: "", video: "" });

const form = reactive({
  course_id: "",
  power_value: "",
  powerband_id: "",
  method: "",
  wind: "",
  score: "",
  pang: "",
  screenshot_url: "",
  video_url: "",
});

const isEditing = computed(() => !!editId.value);
const showSemAjudaNotice = computed(() => form.method === "sem_ajuda");

async function reloadMine() {
  const result = await apiGet("listRecords", { user_id: auth.user.id, status: "all" });
  if (!Array.isArray(result)) throw new Error(result?.erro || "Falha ao carregar seus records");
  recs.value = result;
}

function resetForm() {
  Object.assign(form, { course_id: "", power_value: "", powerband_id: "", method: "", wind: "", score: "", pang: "", screenshot_url: "", video_url: "" });
  editId.value = "";
  Object.keys(errors).forEach(key => { errors[key] = ""; });
}

function startEdit(r) {
  editId.value = r.id;
  Object.assign(form, {
    course_id: r.course_id,
    power_value: r.power_value,
    powerband_id: r.powerband_id,
    score: r.score,
    pang: r.pang ?? "",
    method: r.method || "com_ajuda",
    wind: r.wind || "normal",
    screenshot_url: r.screenshot_url || "",
    video_url: r.video_url || "",
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function onSubmit() {
  if (saving.value) return;
  Object.keys(errors).forEach(key => { errors[key] = ""; });
  errors.course = form.course_id ? "" : "Escolha o course da partida.";
  errors.power = Number.isFinite(Number(form.power_value)) && String(form.power_value).trim() !== "" ? "" : "Informe a força usada na partida.";
  errors.method = form.method ? "" : "Escolha se o record foi com ou sem ajuda.";
  errors.wind = form.wind ? "" : "Escolha a condição de vento.";
  errors.score = Number.isFinite(Number(form.score)) && String(form.score).trim() !== "" ? "" : "Informe o score da partida.";
  errors.pang = form.pang === "" || (Number.isFinite(Number(form.pang)) && Number(form.pang) >= 0) ? "" : "Pang precisa ser um número igual ou maior que zero.";
  errors.screenshot = !form.screenshot_url || safeUrl(form.screenshot_url) !== "#" ? "" : "Use um link de print começando com http:// ou https://.";
  errors.video = !form.video_url || trustedVideoUrl(form.video_url) ? "" : "Use YouTube, Twitch, Vimeo, TikTok, Kick, Facebook ou Instagram.";
  if (showSemAjudaNotice.value && !form.video_url.trim()) errors.video = "Para records sem ajuda, envie o link do vídeo.";
  if (Object.values(errors).some(Boolean)) return;
  const base = {
    course_id: form.course_id,
    power_value: Number(form.power_value),
    score: Number(form.score),
    pang: Number(form.pang || 0),
    method: form.method,
    wind: form.wind,
    screenshot_url: form.screenshot_url.trim(),
    video_url: form.video_url.trim(),
    ...(form.powerband_id ? { powerband_id: form.powerband_id } : {}),
  };
  saving.value = true;
  try {
  const r = editId.value ? await apiPost("updateRecord", { id: editId.value, data: base }) : await apiPost("submitRecord", base);
  if (r.erro) return toast.error(r.erro);
  toast.success(
    r.proposal
      ? "Melhoria enviada como proposta — o original segue valendo até aprovação total."
      : editId.value
      ? "Salvo! Voltou para pendente."
      : r.updated
      ? "Course + força + método já existiam — record atualizado e voltou para pendente."
      : "Enviado! Aguarde validação do admin."
  );
  resetForm();
  await reloadMine();
  } finally { saving.value = false; }
}

async function appeal(id) {
  if (!await confirm.ask({ title: "Pedir reavaliação?", message: "O admin receberá um pedido para reavaliar os votos da comunidade.", confirmLabel: "Pedir reavaliação" })) return;
  const r = await apiPost("appealVote", { id });
  if (r.erro) return toast.error(r.erro);
  toast.success("Pedido enviado ao admin.");
  reloadMine();
}

onMounted(async () => {
  await lookups.ensure();
  await reloadMine();
});
</script>

<template>
  <div>
    <h1 class="mb-1 text-2xl font-bold text-slate-50">Meus records</h1>
    <p class="mb-5 text-sm text-slate-400">Edições e novos envios voltam para <i>pendente</i> até validação do admin.</p>

    <section class="card mb-8">
      <h2 class="section-title mb-3">{{ isEditing ? "Editar record" : "Enviar record" }}</h2>
      <div class="mb-4 rounded-lg border border-amber-800/40 bg-amber-950/30 px-3 py-2 text-sm text-amber-300">
        ⚠️ <b>Sem vídeo, dificilmente a comunidade aprova.</b> Envie o link do vídeo da partida — só print quase nunca passa na votação. E jogue com <b>Hole Cup Size x1 (normal)</b>.
      </div>
      <p v-if="auth.user?.status === 'blocked'" class="mb-4 text-amber-300 text-sm" role="status">Sua conta está aguardando liberação do administrador para enviar records.</p>
      <form class="grid gap-3 sm:grid-cols-2" novalidate @submit.prevent="onSubmit">
        <div class="field-control"><AppSelect aria-label="Campo" v-model="form.course_id" required class="field" @change="errors.course = ''">
          <option value="">Course...</option>
          <option v-for="c in lookups.activeCourses" :key="c.id" :value="c.id">{{ c.name }}</option>
        </AppSelect><p v-if="errors.course" class="form-error">{{ errors.course }}</p></div>
        <div class="field-control"><input aria-label="Força" v-model="form.power_value" type="number" placeholder="Força (ex: 245)" required class="field" @input="errors.power = ''" /><p v-if="errors.power" class="form-error">{{ errors.power }}</p></div>
        <AppSelect aria-label="Faixa de força" v-model="form.powerband_id" class="field">
          <option value="">Faixa auto (recomendado)</option>
          <option v-for="b in lookups.activeBands" :key="b.id" :value="b.id">{{ b.label }}</option>
        </AppSelect>
        <div class="field-control"><AppSelect aria-label="Método" v-model="form.method" required class="field" @change="errors.method = ''">
          <option value="">Método...</option>
          <option value="sem_ajuda">Sem ajuda — só o jogo aberto</option>
          <option value="com_ajuda">Com ajuda — com programas</option>
        </AppSelect><p v-if="errors.method" class="form-error">{{ errors.method }}</p></div>
        <div class="field-control"><AppSelect aria-label="Vento" v-model="form.wind" required class="field" @change="errors.wind = ''">
          <option value="">Vento...</option>
          <option value="normal">Normal</option>
          <option value="natural">Natural</option>
        </AppSelect><p v-if="errors.wind" class="form-error">{{ errors.wind }}</p></div>
        <div v-if="showSemAjudaNotice" class="rounded-lg border border-amber-800/40 bg-amber-950/30 px-3 py-2 text-sm text-amber-300 sm:col-span-2">
          🎥 <b>Sem ajuda</b> = só o jogo aberto, sem nada auxiliando. <b>O vídeo de prova é obrigatório</b> e precisa mostrar que foi assim — sem vídeo o record é recusado.
        </div>
        <div class="field-control"><input aria-label="Score" v-model="form.score" type="number" placeholder="Score (ex: -25)" required class="field" @input="errors.score = ''" /><p v-if="errors.score" class="form-error">{{ errors.score }}</p></div>
        <div class="field-control"><input aria-label="Pang" v-model="form.pang" type="number" placeholder="Pang (ex: 12500)" class="field" @input="errors.pang = ''" /><p v-if="errors.pang" class="form-error">{{ errors.pang }}</p></div>
        <div class="field-control"><input aria-label="URL do print" v-model="form.screenshot_url" type="url" placeholder="URL do print (opcional)" class="field" @input="errors.screenshot = ''" /><p v-if="errors.screenshot" class="form-error">{{ errors.screenshot }}</p></div>
        <div class="field-control"><input aria-label="URL do vídeo" v-model="form.video_url" :required="showSemAjudaNotice" type="url" :placeholder="showSemAjudaNotice ? 'Vídeo: YouTube, Twitch… (obrigatório)' : 'Vídeo: YouTube, Twitch… (opcional)'" class="field" @input="errors.video = ''" /><p v-if="errors.video" class="form-error">{{ errors.video }}</p></div>
        <div class="flex gap-2 sm:col-span-2">
          <button class="btn-primary" :disabled="saving || auth.user?.status === 'blocked'">{{ saving ? "Enviando…" : isEditing ? "Salvar (volta p/ pendente)" : "Enviar p/ validação" }}</button>
          <button type="button" class="btn-secondary" @click="resetForm">Limpar</button>
        </div>
      </form>
    </section>

    <section>
      <h2 class="section-title mb-3">Minha tabela</h2>
      <RecordsTable :records="recs" :show-status="true" :show-community="true" :show-type="true" :show-note="true" :show-user="false" empty-text="Sem records.">
        <template #actions="{ record: r }">
          <div class="flex flex-wrap gap-1.5">
            <button
              v-if="r.status === 'approved' && Number(r.community || 0) === -1"
              class="btn-secondary !px-2.5 !py-1 text-xs"
              @click="appeal(r.id)"
            >Pedir reavaliação</button>
            <button class="btn-secondary !px-2.5 !py-1 text-xs" @click="startEdit(r)">Editar</button>
          </div>
        </template>
      </RecordsTable>
    </section>
  </div>
</template>
