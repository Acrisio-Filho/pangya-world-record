<script setup>
import { onMounted, reactive, ref } from "vue";
import { apiGet, apiPage, apiPost } from "../../../lib/api";
import { useAuthStore } from "../../../stores/auth";
import { useToastStore } from "../../../stores/toast";
import { useLookupsStore } from "../../../stores/lookups";
import { mlabel, wlabel } from "../../../lib/format";
import ProofLinks from "../../../components/ProofLinks.vue";
import Pager from "../../../components/Pager.vue";

const auth = useAuthStore();
const toast = useToastStore();
const lookups = useLookupsStore();

const page = ref(1);
const total = ref(0);
const cands = ref([]);
const tallies = reactive({});
const myVotes = ref({});
const loaded = ref(false);
const error = ref("");
const loading = ref(false);
const voting = ref("");
const sessionWarning = ref("");
const nickname = ref("");

async function reload(p = 1) {
  if (loading.value) return;
  loading.value = true;
  error.value = "";
  try {
    const [_, result] = await Promise.all([
      lookups.ensure(),
      apiPage("listRecords", { status: "approved", community: "0", ...(nickname.value.trim() ? { nickname: nickname.value.trim() } : {}) }, p),
    ]);
    if (result.erro) throw new Error(result.erro);
    const { rows, total: t } = result;
    const summary = rows.length ? await apiGet("tallies", { ids: rows.map(record => record.id).join(",") }) : {};
    if (!summary || summary.erro) throw new Error(summary?.erro || "Não foi possível carregar os votos.");
    cands.value = rows;
    total.value = t;
    page.value = p;
    Object.keys(tallies).forEach(key => delete tallies[key]);
    Object.assign(tallies, summary);
    loaded.value = true;
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
  // Public voting records remain accessible even if session verification fails.
  sessionWarning.value = "";
  myVotes.value = {};
  if (auth.isLoggedIn) {
    try {
      await auth.fetchMe();
      if (auth.isLoggedIn) {
        const votes = await apiGet("myVotes");
        if (votes?.erro) throw new Error(votes.erro);
        myVotes.value = votes || {};
      }
    } catch {
      sessionWarning.value = "Não foi possível verificar sua sessão. Os records continuam disponíveis para consulta.";
    }
  }
}

async function vote(id, v) {
  if (voting.value) return;
  voting.value = id;
  try {
  const r = await apiPost("vote", { id, vote: v });
  if (r.erro) return toast.error(r.erro);
  toast.success(r.decided === "approved" ? "Aprovado pela comunidade! Voltou p/ fila do admin." : r.decided === "rejected" ? "Rejeitado pela comunidade." : "Voto registrado.");
  await reload(page.value);
  } catch (err) { toast.error(err.message); } finally { voting.value = ""; }
}

onMounted(() => reload(1));
</script>

<template>
  <div class="community-page">
    <section class="community-hero">
      <p class="eyebrow"><span class="live-dot"></span> VALIDAÇÃO COLETIVA</p>
      <h1>Comunidade</h1>
      <p>Analise provas, vote com responsabilidade e ajude a manter o World Record confiável.</p>
      <div class="community-hero-meta">
        <span><b>3+</b> votantes</span><span><b>50+</b> pontos para decisão</span><span><b>2×</b> maioria necessária</span>
      </div>
    </section>

    <details class="community-rules">
      <summary class="cursor-pointer font-medium text-slate-300">Regras da votação</summary>
      <p class="mt-2 leading-relaxed">
        Votam usuários liberados (inclusive admin) com 10+ pontos, fora o próprio record. Pontos: +5/mês de conta (teto 60), +10 por record aceito pelo admin, +25 por record aceito pela comunidade.
        Peso do voto = pontos. Dá p/ votar de novo e trocar o voto — vale o último, com seu peso atual. Aprova com peso 50+, 3+ votantes e mais que o dobro de rejeitar (vale o contrário p/ rejeitar).
        Rejeição não é final: o record volta p/ a fila do admin — confirmar tira do index, devolver manda de volta p/ votar (zera os votos). Se o dono editar o record depois do voto, os votos antigos são apagados e vocês votam a versão nova.
      </p>
    </details>
    <div class="community-session">
      <span v-if="auth.isLoggedIn">Seu peso de voto: <b>{{ auth.user?.points ?? 0 }}</b> pontos.</span>
      <RouterLink v-else to="/login" class="link">Faça login para votar.</RouterLink>
    </div>

    <form class="community-search" novalidate @submit.prevent="reload(1)">
      <label for="community-nickname">Buscar jogador</label>
      <input id="community-nickname" v-model="nickname" type="search" class="field" placeholder="Nickname…" />
      <button class="btn-primary" :disabled="loading">Buscar</button>
      <button v-if="nickname" type="button" class="btn-secondary" :disabled="loading" @click="nickname = ''; reload(1)">Limpar</button>
    </form>

    <p v-if="sessionWarning" class="mb-4 text-sm text-amber-200" role="status">{{ sessionWarning }}</p>
    <div v-if="error" class="state-panel" role="alert"><p>{{ error }}</p><button class="btn-secondary" @click="reload(page)">Tentar novamente</button></div>
    <div v-else-if="loading" class="state-panel" role="status">Carregando votações…</div>
    <div v-else-if="loaded && !cands.length" class="card py-10 text-center text-sm text-slate-500">Sem candidatos no momento.</div>

    <div v-if="!loading && !error" class="community-candidates">
      <article v-for="r in cands" :key="r.id" class="community-candidate">
        <div class="community-candidate-main">
          <div class="community-score"><b>{{ r.score }}</b><span>{{ r.pang ?? "—" }} pang</span></div>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2"><RouterLink :to="{ path: '/profile', query: { id: r.user_id } }" class="link font-semibold">{{ r.nickname || r.user_id }}</RouterLink><span class="badge-neutral">{{ mlabel(r.method) }}</span><span class="community-wind">{{ wlabel(r.wind) }}</span></div>
            <p class="community-course">{{ lookups.cname(r.course_id) }} · {{ lookups.bname(r.powerband_id) }} · força {{ r.power_value }}</p>
          </div>
        </div>

        <div class="community-proof"><ProofLinks :video="r.video_url" :screenshot="r.screenshot_url" :by="r.nickname || r.user_id" /></div>

        <div class="community-candidate-footer">
          <div class="community-tally" aria-label="Resultado parcial da votação">
            <span>👍 <b>{{ (tallies[r.id] || {}).approve ?? 0 }}</b></span>
            <span>👎 <b>{{ (tallies[r.id] || {}).reject ?? 0 }}</b></span>
            <span>{{ (tallies[r.id] || {}).voters ?? 0 }} votantes</span>
            <span v-if="myVotes[r.id]" class="community-my-vote">Seu voto: <b>{{ myVotes[r.id] }}</b></span>
          </div>
          <div v-if="!sessionWarning && auth.isLoggedIn && auth.user?.id !== r.user_id && auth.user?.status === 'active' && Number(auth.user?.points) >= 10" class="community-vote-actions">
            <button class="btn-primary !bg-emerald-600 !shadow-emerald-600/30 hover:!bg-emerald-500" :disabled="!!voting" @click="vote(r.id, 'approve')">{{ voting === r.id ? "Registrando…" : "Aprovar" }}</button>
            <button class="btn-danger" :disabled="!!voting" @click="vote(r.id, 'reject')">Rejeitar</button>
          </div>
          <i v-else class="community-vote-note">{{ !auth.isLoggedIn ? "Entre para votar" : auth.user?.id === r.user_id ? "Você não vota no próprio record" : "Votação disponível para contas ativas com 10+ pontos" }}</i>
        </div>
      </article>
    </div>

    <Pager :page="page" :total="total" @change="reload" />
  </div>
</template>
