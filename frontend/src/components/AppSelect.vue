<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useAttrs, useId, watch } from "vue";

defineOptions({ inheritAttrs: false });
const props = defineProps({ modelValue: { type: [String, Number], default: "" }, disabled: Boolean, required: Boolean, name: String });
const emit = defineEmits(["update:modelValue", "change"]);
const attrs = useAttrs();
const id = useId();
const native = ref(null);
const trigger = ref(null);
const popup = ref(null);
const open = ref(false);
const invalid = ref(false);
const options = ref([]);
const active = ref(-1);
const position = ref({});
let observer;
let search = "";
let searchTimer;
const value = computed({ get: () => props.modelValue, set: value => emit("update:modelValue", value) });
const selected = computed(() => options.value.find(option => option.value === String(props.modelValue)));
const nativeId = computed(() => attrs.id || `${id}-native`);
const rootClasses = computed(() => String(attrs.class || "").split(/\s+/).filter(name => /^(?:!?w-|max-w-|m[btxy]?-|col-span-|sm:col-span-)/.test(name)).join(" "));

function syncOptions() {
  const next = Array.from(native.value?.options || []).map(option => ({ value: option.value, label: option.label, disabled: option.disabled || option.parentElement?.disabled === true }));
  if (JSON.stringify(next) !== JSON.stringify(options.value)) options.value = next;
}
function place() {
  if (!open.value || !trigger.value) return;
  const rect = trigger.value.getBoundingClientRect();
  const below = innerHeight - rect.bottom - 12;
  const above = rect.top - 12;
  const upward = below < Math.min(260, options.value.length * 42 + 12) && above > below;
  position.value = {
    left: `${Math.max(8, Math.min(rect.left, innerWidth - rect.width - 8))}px`,
    width: `${Math.min(rect.width, innerWidth - 16)}px`,
    maxHeight: `${Math.max(80, Math.min(288, upward ? above : below))}px`,
    ...(upward ? { bottom: `${innerHeight - rect.top + 6}px` } : { top: `${rect.bottom + 6}px` }),
  };
}
function reveal() {
  nextTick(() => popup.value?.querySelector(`[data-index="${active.value}"]`)?.scrollIntoView({ block: "nearest" }));
}
function expand(direction = 1) {
  if (props.disabled || open.value) return;
  syncOptions();
  open.value = true;
  active.value = options.value.findIndex(option => option.value === String(props.modelValue) && !option.disabled);
  if (active.value < 0) active.value = direction < 0 ? options.value.findLastIndex(option => !option.disabled) : options.value.findIndex(option => !option.disabled);
  place();
  reveal();
}
function close() { open.value = false; search = ""; clearTimeout(searchTimer); }
function choose(index) {
  const option = options.value[index];
  if (!option || option.disabled || props.disabled) return;
  invalid.value = false;
  // Preserve native form values and the existing change handlers at call sites.
  native.value.value = option.value;
  native.value.dispatchEvent(new Event("change", { bubbles: true }));
  close();
  trigger.value?.focus({ preventScroll: true });
}
function move(direction) {
  let index = active.value;
  for (let i = 0; i < options.value.length; i++) {
    index = (index + direction + options.value.length) % options.value.length;
    if (!options.value[index].disabled) { active.value = index; reveal(); return; }
  }
}
function onKey(event) {
  if (props.disabled) return;
  if (event.key === "Tab") { close(); return; }
  if (event.key === "Escape") { if (open.value) { event.preventDefault(); event.stopPropagation(); close(); } return; }
  if (["ArrowDown", "ArrowUp"].includes(event.key)) {
    event.preventDefault();
    const direction = event.key === "ArrowDown" ? 1 : -1;
    if (!open.value) expand(direction); else move(direction);
    return;
  }
  if (["Enter", " "].includes(event.key)) {
    event.preventDefault();
    if (open.value) choose(active.value); else expand();
    return;
  }
  if (open.value && ["Home", "End"].includes(event.key)) {
    event.preventDefault();
    active.value = event.key === "Home" ? options.value.findIndex(option => !option.disabled) : options.value.findLastIndex(option => !option.disabled);
    reveal();
    return;
  }
  if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault();
    if (!open.value) expand();
    search += event.key.toLocaleLowerCase();
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { search = ""; }, 650);
    const index = options.value.findIndex(option => !option.disabled && option.label.toLocaleLowerCase().startsWith(search));
    if (index >= 0) { active.value = index; reveal(); }
  }
}
function outside(event) {
  if (!trigger.value?.contains(event.target) && !popup.value?.contains(event.target) && event.target !== native.value) close();
}
function onScroll(event) {
  if (popup.value?.contains(event.target)) return;
  place();
}
function onInvalid() { invalid.value = true; trigger.value?.focus(); }
watch(() => props.modelValue, () => { invalid.value = false; });
watch(() => props.disabled, disabled => { if (disabled) close(); });
onMounted(() => {
  syncOptions();
  observer = new MutationObserver(syncOptions);
  observer.observe(native.value, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["value", "label", "disabled"] });
  document.addEventListener("pointerdown", outside);
  document.addEventListener("focusin", outside);
  window.addEventListener("resize", place);
  window.addEventListener("scroll", onScroll, true);
});
onBeforeUnmount(() => {
  observer?.disconnect();
  clearTimeout(searchTimer);
  document.removeEventListener("pointerdown", outside);
  document.removeEventListener("focusin", outside);
  window.removeEventListener("resize", place);
  window.removeEventListener("scroll", onScroll, true);
});
</script>

<template>
  <div class="select-control" :class="rootClasses" :style="attrs.style">
    <select :id="nativeId" ref="native" v-model="value" class="select-native" tabindex="-1" aria-hidden="true" :name="name" :required="required" :disabled="disabled" @change="emit('change', $event)" @invalid.prevent="onInvalid" @focus="trigger?.focus()"><slot /></select>
    <button :id="`${id}-trigger`" ref="trigger" type="button" role="combobox" class="field select-trigger" :class="{ 'is-open': open, 'is-invalid': invalid }" :disabled="disabled" aria-haspopup="listbox" :aria-label="attrs['aria-label']" :aria-labelledby="attrs['aria-labelledby']" :aria-describedby="invalid ? `${id}-error` : attrs['aria-describedby']" :aria-expanded="open" :aria-controls="`${id}-listbox`" :aria-activedescendant="open && active >= 0 ? `${id}-option-${active}` : undefined" :aria-required="required || undefined" :aria-invalid="invalid || undefined" @click="open ? close() : expand()" @keydown="onKey">
      <span class="select-value">{{ selected?.label || 'Selecione uma opção' }}</span>
      <svg class="select-chevron" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m6 8 4 4 4-4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /></svg>
    </button>
    <span v-if="invalid" :id="`${id}-error`" class="select-error">Selecione uma opção.</span>
    <Teleport to="body">
      <div v-if="open" :id="`${id}-listbox`" ref="popup" role="listbox" :aria-label="attrs['aria-label'] || 'Opções'" class="select-popup" :style="position" @pointerdown.prevent>
        <div v-for="(option, index) in options" :id="`${id}-option-${index}`" :key="`${option.value}-${index}`" :data-index="index" role="option" :aria-selected="option.value === String(modelValue)" :aria-disabled="option.disabled || undefined" class="select-option" :class="{ 'is-active': index === active, 'is-selected': option.value === String(modelValue), 'is-disabled': option.disabled }" @pointermove="!option.disabled && (active = index)" @click="choose(index)">
          <span>{{ option.label }}</span><svg v-if="option.value === String(modelValue)" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m4 10 4 4 8-8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /></svg>
        </div>
        <div v-if="!options.length" class="select-no-options">Nenhuma opção disponível.</div>
      </div>
    </Teleport>
  </div>
</template>
