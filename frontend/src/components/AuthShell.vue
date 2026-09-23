<script setup>
defineProps({ title: String, subtitle: String });
const base = import.meta.env.BASE_URL;
</script>
<template>
  <section class="auth-shell">
    <aside class="auth-art" :style="{ backgroundImage: `linear-gradient(0deg, #0b262bed, #0b262b15), url(${base}images/pangya-hero.png)` }">
      <div><span class="eyebrow">SEU PRÓXIMO DESAFIO COMEÇA AQUI</span><h2>Jogue junto.<br>Vá mais longe.</h2><p>Compartilhe suas conquistas e faça parte da história de Pangya.</p></div>
    </aside>
    <div class="auth-content"><span class="eyebrow">PANGYA WORLD RECORD</span><h1>{{ title }}</h1><p class="auth-subtitle">{{ subtitle }}</p><slot /></div>
  </section>
</template>
