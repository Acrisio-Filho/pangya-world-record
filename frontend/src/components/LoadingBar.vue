<script setup>
import { pending } from "../lib/api";
</script>

<template>
  <div class="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5" v-if="pending > 0">
    <div class="h-full w-full origin-left animate-[loading-bar_1.1s_ease-in-out_infinite] bg-gradient-to-r from-sky-400 via-fuchsia-400 to-sky-400"></div>
  </div>
</template>

<style>
@keyframes loading-bar {
  0% { transform: scaleX(0); opacity: 0.6; }
  50% { transform: scaleX(0.6); opacity: 1; }
  100% { transform: scaleX(1); opacity: 0; }
}
</style>
