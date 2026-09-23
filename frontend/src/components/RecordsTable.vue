<script setup>
import { useLookupsStore } from "../stores/lookups";
import { fmtDate, mlabel, wlabel, comlabel } from "../lib/format";
import ProofLinks from "./ProofLinks.vue";
import { computed, ref, useSlots } from "vue";

const props = defineProps({
  records: { type: Array, required: true },
  emptyText: { type: String, default: "Nenhum record." },
  showUser: { type: Boolean, default: true },
  showStatus: { type: Boolean, default: false },
  showCommunity: { type: Boolean, default: false },
  showNote: { type: Boolean, default: false },
  showType: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
});

const lookups = useLookupsStore();
const slots = useSlots();
const expanded = ref(new Set());
const columnCount = computed(() => 7 + (props.showUser ? 1 : 0) + (props.showStatus ? 1 : 0) + (slots.actions ? 1 : 0));
const isBest = value => String(value).toUpperCase() === "TRUE";

function typeLabel(r) {
  if (r.edit_of) return "proposta";
  if (r.edited === "TRUE") return "edição";
  return "novo";
}
function statusBadge(status) {
  if (status === "approved") return { text: "Aprovado", cls: "badge-best" };
  if (status === "pending") return { text: "Pendente", cls: "badge-warn" };
  if (status === "rejected") return { text: "Rejeitado", cls: "badge-danger" };
  return { text: String(status || "—"), cls: "badge-neutral" };
}
function isExpanded(id) { return expanded.value.has(id); }
function toggleDetails(id) {
  const next = new Set(expanded.value);
  next.has(id) ? next.delete(id) : next.add(id);
  expanded.value = next;
}
</script>

<template>
  <div v-if="loading" class="state-panel" role="status"><div class="loading-orbit"></div><p>Carregando records…</p></div>
  <div v-else-if="!records.length" class="card py-10 text-center text-sm text-slate-500">{{ emptyText }}</div>

  <template v-else>
    <!-- desktop: tabela -->
    <div class="thin-scroll hidden overflow-x-auto rounded-xl border border-slate-800 md:block">
      <table class="w-full min-w-[900px] border-collapse text-sm">
        <thead>
          <tr class="border-b border-slate-800 bg-slate-900/70 text-left text-xs tracking-wide text-slate-400 uppercase">
            <th class="px-3 py-2.5 font-medium">Score</th>
            <th class="px-3 py-2.5 font-medium">Pang</th>
            <th v-if="showUser" class="px-3 py-2.5 font-medium">Usuário</th>
            <th class="px-3 py-2.5 font-medium">Course / força</th>
            <th class="px-3 py-2.5 font-medium">Método</th>
            <th class="px-3 py-2.5 font-medium">Vento</th>
            <th class="px-3 py-2.5 font-medium">Provas</th>
            <th v-if="showStatus" class="px-3 py-2.5 font-medium">Status</th>
            <th class="px-3 py-2.5 font-medium"><span class="sr-only">Detalhes</span></th>
            <th v-if="$slots.actions" class="px-3 py-2.5 font-medium">Ações</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="r in records" :key="r.id">
          <tr class="border-b border-slate-800/60 hover:bg-slate-900/40">
            <td class="px-3 py-2.5 font-semibold text-slate-100 whitespace-nowrap">
              {{ r.score }}
              <span v-if="isBest(r.is_best)" class="badge-best ml-1">★ BEST</span>
            </td>
            <td class="px-3 py-2.5 text-slate-300">{{ r.pang ?? "—" }}</td>
            <td v-if="showUser" class="px-3 py-2.5">
              <RouterLink :to="{ path: '/profile', query: { id: r.user_id } }" class="link">{{ r.nickname || r.user_id }}</RouterLink>
            </td>
            <td class="px-3 py-2.5 text-slate-300"><b class="font-medium text-slate-200">{{ lookups.cname(r.course_id) }}</b><span class="text-slate-500"> · {{ lookups.bname(r.powerband_id) }} ({{ r.power_value ?? "—" }})</span></td>
            <td class="px-3 py-2.5"><span class="badge-neutral whitespace-nowrap">{{ mlabel(r.method) }}</span></td>
            <td class="px-3 py-2.5 text-slate-300 whitespace-nowrap">{{ wlabel(r.wind) }}</td>
            <td class="px-3 py-2.5"><ProofLinks :video="r.video_url" :screenshot="r.screenshot_url" :by="r.nickname || r.user_id" /></td>
            <td v-if="showStatus" class="px-3 py-2.5"><span :class="statusBadge(r.status).cls">{{ statusBadge(r.status).text }}</span></td>
            <td class="px-3 py-2.5"><button type="button" class="record-details-toggle" :aria-expanded="isExpanded(r.id)" :aria-controls="`record-details-${r.id}`" @click="toggleDetails(r.id)">{{ isExpanded(r.id) ? "Ocultar" : "Detalhes" }}</button></td>
            <td v-if="$slots.actions" class="px-3 py-2.5"><slot name="actions" :record="r" /></td>
          </tr>
          <tr v-if="isExpanded(r.id)" :id="`record-details-${r.id}`" class="record-details-row border-b border-slate-800/60 last:border-0">
            <td :colspan="columnCount" class="px-3 py-3">
              <dl class="record-details-grid">
                <div><dt>Enviado em</dt><dd>{{ fmtDate(r.submitted_at) }}</dd></div>
                <div v-if="showCommunity"><dt>Comunidade</dt><dd>{{ comlabel(r.community) }}</dd></div>
                <div v-if="showType"><dt>Tipo</dt><dd>{{ typeLabel(r) }}</dd></div>
                <div v-if="showNote && r.note" class="record-details-wide"><dt>Nota</dt><dd>{{ r.note }}</dd></div>
              </dl>
            </td>
          </tr>
          </template>
        </tbody>
      </table>
    </div>

    <!-- mobile: cards -->
    <div class="grid gap-3 md:hidden">
      <div v-for="r in records" :key="r.id" class="card">
        <div class="flex items-start justify-between gap-2">
          <div class="text-lg font-bold text-slate-100">
            {{ r.score }}
            <span v-if="isBest(r.is_best)" class="badge-best ml-1 align-middle">★ BEST</span>
          </div>
          <span class="badge-neutral">{{ mlabel(r.method) }}</span>
        </div>
        <dl class="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
          <template v-if="showUser">
            <dt class="text-slate-500">Usuário</dt>
            <dd><RouterLink :to="{ path: '/profile', query: { id: r.user_id } }" class="link">{{ r.nickname || r.user_id }}</RouterLink></dd>
          </template>
          <dt class="text-slate-500">Pang</dt>
          <dd class="text-slate-300">{{ r.pang ?? "—" }}</dd>
          <dt class="text-slate-500">Vídeo</dt>
          <dd><ProofLinks v-if="r.video_url" :video="r.video_url" :by="r.nickname || r.user_id" /><span v-else class="text-slate-600">—</span></dd>
          <dt class="text-slate-500">Vento</dt>
          <dd class="text-slate-300">{{ wlabel(r.wind) }}</dd>
          <dt class="text-slate-500">Course</dt>
          <dd class="text-slate-300">{{ lookups.cname(r.course_id) }}</dd>
          <dt class="text-slate-500">Faixa</dt>
          <dd class="text-slate-300">{{ lookups.bname(r.powerband_id) }} ({{ r.power_value ?? "—" }})</dd>
          <template v-if="showStatus">
            <dt class="text-slate-500">Status</dt>
            <dd><span :class="statusBadge(r.status).cls">{{ statusBadge(r.status).text }}</span></dd>
          </template>
          <template v-if="showCommunity">
            <dt class="text-slate-500">Comunidade</dt>
            <dd class="text-slate-300">{{ comlabel(r.community) }}</dd>
          </template>
          <template v-if="showType">
            <dt class="text-slate-500">Tipo</dt>
            <dd class="text-slate-300 italic">{{ typeLabel(r) }}</dd>
          </template>
          <template v-if="showNote && r.note">
            <dt class="text-slate-500">Nota</dt>
            <dd class="text-slate-300">{{ r.note }}</dd>
          </template>
          <dt class="text-slate-500">Enviado</dt>
          <dd class="text-slate-400">{{ fmtDate(r.submitted_at) }}</dd>
        </dl>
        <div class="mt-3 flex items-center justify-between gap-2">
          <ProofLinks :screenshot="r.screenshot_url" :by="r.nickname || r.user_id" />
          <div v-if="$slots.actions"><slot name="actions" :record="r" /></div>
        </div>
      </div>
    </div>
  </template>
</template>
