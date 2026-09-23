<script setup>
import { ref } from "vue";

defineOptions({ inheritAttrs: false });
defineProps({ modelValue: { type: String, default: "" } });
const emit = defineEmits(["update:modelValue"]);
const visible = ref(false);
</script>

<template>
  <div class="password-input">
    <input v-bind="$attrs" :type="visible ? 'text' : 'password'" :value="modelValue" @input="emit('update:modelValue', $event.target.value)" />
    <button type="button" class="password-toggle" :aria-label="visible ? 'Ocultar senha' : 'Mostrar senha'" :aria-pressed="visible" @click="visible = !visible">
      <svg v-if="visible" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 3l18 18M10.6 10.7a2 2 0 0 0 2.7 2.7M9.9 5.1A10.8 10.8 0 0 1 12 4.9c5.2 0 8.5 4.2 9.4 6.1a1.8 1.8 0 0 1 0 1.7 14.5 14.5 0 0 1-3.1 3.9M6.2 6.2A14.3 14.3 0 0 0 2.6 11a1.8 1.8 0 0 0 0 1.7c.9 1.9 4.2 6.1 9.4 6.1 1.1 0 2.1-.2 3-.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" /></svg>
      <svg v-else viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M2.6 12c.9-1.9 4.2-6.1 9.4-6.1s8.5 4.2 9.4 6.1a1.8 1.8 0 0 1 0 1.7c-.9 1.9-4.2 6.1-9.4 6.1s-8.5-4.2-9.4-6.1a1.8 1.8 0 0 1 0-1.7Z" stroke="currentColor" stroke-width="1.7" /><circle cx="12" cy="12" r="2.8" stroke="currentColor" stroke-width="1.7" /></svg>
    </button>
  </div>
</template>
