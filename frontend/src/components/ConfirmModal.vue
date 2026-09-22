<script setup>
defineProps({ request: { type: Object, default: null } });
const emit = defineEmits(["answer"]);
</script>

<template>
  <div v-if="request" class="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 p-4 backdrop-blur-sm" @click.self="emit('answer', false)">
    <section class="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title">
      <p class="eyebrow">CONFIRMAR AÇÃO</p>
      <h2 id="confirm-modal-title" class="mt-2 text-xl font-bold text-slate-50">{{ request.title }}</h2>
      <p class="mt-3 text-sm leading-relaxed text-slate-300">{{ request.message }}</p>
      <div class="mt-6 flex flex-wrap justify-end gap-2">
        <button type="button" class="btn-secondary" @click="emit('answer', false)">Cancelar</button>
        <button type="button" :class="request.tone === 'danger' ? 'btn-danger' : 'btn-primary'" @click="emit('answer', true)">{{ request.confirmLabel }}</button>
      </div>
    </section>
  </div>
</template>
