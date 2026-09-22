<script setup>
import AppSelect from "../../../components/AppSelect.vue";
import { onMounted, reactive, ref } from "vue";
import { apiPage } from "../../../lib/api";
import { useLookupsStore } from "../../../stores/lookups";
import RecordsTable from "../../../components/RecordsTable.vue";
import Pager from "../../../components/Pager.vue";

const base = import.meta.env.BASE_URL;
const lookups = useLookupsStore();
const rows = ref([]);
const total = ref(0);
const page = ref(1);
const loaded = ref(false);
const erro = ref("");

const f = reactive({ course_id: "", powerband_id: "", method: "", wind: "", nickname: "", best: false });

const loading = ref(false);
let request = 0;
async function search(p = 1) {
  const id = ++request;
  loading.value = true;
  erro.value = "";
  const params = { status: "approved", community: "1" };
  for (const key of ["course_id", "powerband_id", "method", "wind", "nickname"]) {
    if (String(f[key]).trim()) params[key] = String(f[key]).trim();
  }
  if (f.best) params.best = "1";
  try {
    await lookups.ensure();
    const r = await apiPage("listRecords", params, p);
    if (id !== request) return;
    if (r.erro) throw new Error(r.erro);
    rows.value = r.rows;
    total.value = r.total;
    page.value = p;
    loaded.value = true;
  } catch (error) {
    if (id === request) erro.value = error.message;
  } finally {
    if (id === request) loading.value = false;
  }
}
function reset() {
  Object.assign(f, { course_id: "", powerband_id: "", method: "", wind: "", nickname: "", best: false });
  search();
}
onMounted(() => search());
</script>

<template>
  <div class="home-page">
    <section class="hero" aria-labelledby="hero-title">
      <img class="hero-art" :src="`${base}images/pangya-hero.png`" alt="Dois golfistas e um mascote em um campo de golfe de fantasia com ilhas flutuantes" fetchpriority="high" width="1536" height="1024" />
      <div class="hero-shade"></div>
      <div class="hero-copy">
        <span class="eyebrow"><span class="live-dot"></span> FEITO POR QUEM JOGA</span>
        <h1 id="hero-title">Cada tacada.<br>Uma nova <em>lenda.</em></h1>
        <p>O próximo recorde de Pangya pode ser seu.<br>Explore os melhores scores e faça parte dessa história.</p>
        <div class="hero-actions"><a href="#ranking" class="btn-primary">Explorar ranking <span>↗</span></a><RouterLink to="/submit-record" class="hero-secondary">Enviar meu recorde →</RouterLink></div>
        <div class="hero-footnote"><span>✓</span> Records verificados pela comunidade</div>
      </div>
      <div class="hero-caption"><span>THE WORLD IS YOUR COURSE</span><strong>Seu jogo. Sua história.</strong></div>
    </section>

    <div class="trust-strip"><span><b>01</b> Jogue e registre sua partida</span><span><b>02</b> Envie seu score e suas provas</span><span><b>03</b> Conquiste seu lugar no ranking</span></div>

    <section id="ranking" class="ranking-section" aria-labelledby="ranking-title">
      <div class="section-heading"><div><span class="eyebrow">O TOPO COMEÇA AQUI</span><h2 id="ranking-title">World Records <span class="title-star">✦</span></h2><p>Grandes jogadas merecem um lugar na história.</p></div><RouterLink to="/community" class="text-action">Ajude a validar records ↗</RouterLink></div>
      <form class="filter-panel" novalidate @submit.prevent="search(1)">
        <div class="filter-title"><strong>Encontre sua categoria</strong><button type="button" class="text-action" @click="reset">Limpar filtros ↺</button></div>
        <div class="filter-grid">
          <label>Campo<AppSelect aria-label="Campo" v-model="f.course_id" class="field" @change="search(1)"><option value="">Todos os campos</option><option v-for="c in lookups.activeCourses" :key="c.id" :value="c.id">{{ c.name }}</option></AppSelect></label>
          <label>Força<AppSelect aria-label="Força" v-model="f.powerband_id" class="field" @change="search(1)"><option value="">Todas as faixas</option><option v-for="b in lookups.activeBands" :key="b.id" :value="b.id">{{ b.label }}</option></AppSelect></label>
          <label>Método<AppSelect aria-label="Método" v-model="f.method" class="field" @change="search(1)"><option value="">Todos os métodos</option><option value="sem_ajuda">Sem ajuda</option><option value="com_ajuda">Com ajuda</option></AppSelect></label>
          <label>Vento<AppSelect aria-label="Vento" v-model="f.wind" class="field" @change="search(1)"><option value="">Todos os ventos</option><option value="normal">Normal</option><option value="natural">Natural</option></AppSelect></label>
          <label>Jogador<input v-model="f.nickname" placeholder="Buscar nickname…" class="field" type="search" /></label>
          <button class="btn-primary search-button" :disabled="loading">{{ loading ? 'Buscando…' : 'Buscar ↗' }}</button>
        </div>
        <label class="best-toggle"><input v-model="f.best" type="checkbox" @change="search(1)" /> Apenas os melhores de cada categoria <span>★ BEST</span></label>
      </form>
      <div class="results-heading"><span><strong>{{ total }}</strong> records encontrados</span><span>Menor score · maior Pang no desempate</span></div>
      <div :aria-busy="loading" aria-live="polite">
        <div v-if="erro" class="state-panel" role="alert"><span class="state-icon">↻</span><h3>Não foi possível carregar o ranking</h3><p>{{ erro }}</p><button class="btn-secondary" @click="search(page)">Tentar novamente</button></div>
        <div v-else-if="loading" class="state-panel"><div class="loading-orbit"></div><p>Buscando grandes jogadas…</p></div>
        <template v-else-if="loaded && rows.length"><RecordsTable :records="rows" /><Pager :page="page" :total="total" @change="search" /></template>
        <div v-else-if="loaded" class="state-panel"><span class="state-icon">⚑</span><h3>O próximo recorde pode ser seu</h3><p>Nenhum recorde encontrado nesta seleção. Experimente outros filtros ou envie sua partida.</p><button class="btn-secondary" @click="reset">Ver todas as categorias</button><RouterLink to="/submit-record" class="text-action">Enviar recorde →</RouterLink></div>
      </div>
    </section>
    <section class="community-banner"><div class="community-symbol">✦</div><div><span class="eyebrow">JUNTOS, O JOGO VAI MAIS LONGE</span><h2>Uma comunidade. Muitas lendas.</h2><p>Confira as provas, participe das votações e valorize cada conquista.</p></div><RouterLink to="/community" class="btn-secondary">Conhecer a comunidade ↗</RouterLink></section>
  </div>
</template>
