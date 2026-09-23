// Config em runtime (não é bundlado pelo Vite): o workflow do GitHub Actions
// sobrescreve este arquivo com os secrets antes do build (ver .github/workflows).
// Localmente fica com os placeholders — tests/server.js troca na hora de servir.
window.PWR_CONFIG = {
  URL_API: "TROQUE_ISSO_URL_EXEC",
  ORIGEM_TOKEN: "TROQUE_ISSO_pwr_123",
  GOOGLE_CLIENT_ID: "TROQUE_ISSO_google_client_id",
};
