<script setup>
import { useToastStore } from "../stores/toast";

const toast = useToastStore();

const styles = {
  success: "border-l-emerald-500",
  error: "border-l-red-500",
  info: "border-l-sky-500",
};
</script>

<template>
  <div class="pointer-events-none fixed top-3 right-3 left-3 z-50 grid justify-items-end gap-2 sm:left-auto sm:max-w-sm">
    <TransitionGroup name="toast">
      <div
        v-for="t in toast.items"
        :key="t.id"
        class="pointer-events-auto flex w-full items-start gap-2 rounded-lg border border-slate-800 border-l-4 bg-slate-900 px-3 py-2.5 text-sm shadow-lg shadow-black/30"
        :class="styles[t.type] || styles.info"
      >
        <span class="flex-1 text-slate-100">{{ t.text }}</span>
        <button class="cursor-pointer text-slate-500 hover:text-slate-300" aria-label="Fechar" @click="toast.dismiss(t.id)">×</button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.2s ease;
}
.toast-enter-from {
  opacity: 0;
  transform: translateY(-8px);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(16px);
}
</style>
