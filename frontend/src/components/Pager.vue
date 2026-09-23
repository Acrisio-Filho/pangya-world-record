<script setup>
import { computed } from "vue";
import { PAGE_SIZE } from "../lib/api";

const props = defineProps({
  page: { type: Number, required: true },
  total: { type: Number, required: true },
});
const emit = defineEmits(["change"]);

const pages = computed(() => Math.max(1, Math.ceil(props.total / PAGE_SIZE)));
</script>

<template>
  <div v-if="pages > 1" class="mt-4 flex items-center justify-center gap-3 text-sm text-slate-400">
    <button class="btn-secondary !px-3 !py-1.5" :disabled="page <= 1" @click="emit('change', page - 1)">← Anterior</button>
    <span>Página {{ page }} de {{ pages }} ({{ total }})</span>
    <button class="btn-secondary !px-3 !py-1.5" :disabled="page >= pages" @click="emit('change', page + 1)">Próxima →</button>
  </div>
</template>
