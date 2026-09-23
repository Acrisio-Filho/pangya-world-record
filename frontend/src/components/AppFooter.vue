<script setup>
import BrandLogo from "./BrandLogo.vue";
</script>

<template>
  <footer class="site-footer">
    <div class="footer-inner">
      <div class="footer-main">
        <div class="footer-identity">
          <RouterLink to="/" aria-label="Pangya World Record — início" class="footer-brand"><BrandLogo /></RouterLink>
          <p>Cada conquista faz parte da nossa história.</p>
        </div>
        <nav class="footer-nav" aria-label="Navegação do rodapé">
          <RouterLink to="/">Ranking</RouterLink>
          <RouterLink to="/community">Comunidade</RouterLink>
          <a href="https://github.com/Acrisio-Filho/pangya-world-record" target="_blank" rel="noopener noreferrer">Projeto no GitHub <span aria-hidden="true">↗</span><span class="sr-only"> (abre em nova aba)</span></a>
        </nav>
      </div>
      <div class="footer-bottom">
        <p>Feito pela comunidade, para quem joga <span aria-hidden="true" class="footer-spark">✦</span></p>
        <div class="footer-meta">
          <span>Projeto original de <a href="https://github.com/Acrisio-Filho" target="_blank" rel="noopener noreferrer">Acrisio Filho<span class="sr-only"> (abre em nova aba)</span></a></span>
          <a href="https://github.com/Acrisio-Filho/pangya-world-record/blob/main/LICENSE" target="_blank" rel="noopener noreferrer">Licença MIT<span class="sr-only"> (abre em nova aba)</span></a>
          <RouterLink to="/privacy">Privacidade</RouterLink>
          <RouterLink to="/terms">Termos de uso</RouterLink>
        </div>
      </div>
    </div>
  </footer>
</template>
