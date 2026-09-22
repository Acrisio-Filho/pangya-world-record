<script setup>
import { safeUrl, confirmOpen } from "../lib/format";

const props = defineProps({
  video: { type: String, default: "" },
  screenshot: { type: String, default: "" },
  by: { type: String, default: "" },
});
</script>

<template>
  <span class="inline-flex flex-wrap items-center gap-2">
    <a
      v-if="video"
      :href="safeUrl(video)"
      target="_blank"
      rel="noopener"
      class="badge-info hover:brightness-125"
      @click="(e) => confirmOpen(e, by)"
    >▶ vídeo</a>
    <a
      v-if="screenshot"
      :href="safeUrl(screenshot)"
      target="_blank"
      rel="noopener"
      class="badge-neutral hover:brightness-125"
      @click="(e) => confirmOpen(e, by)"
    >🖼 print</a>
    <span v-if="!video && !screenshot" class="text-xs text-slate-600">sem provas</span>
  </span>
</template>
