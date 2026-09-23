import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";

// Projeto GitHub Pages (não é usuário.github.io raiz): precisa do base com o nome do repo.
export default defineConfig({
  base: "/pangya-world-record/",
  plugins: [vue(), tailwindcss(), {
    name: "local-api-config",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split("?")[0] !== "/pangya-world-record/config.js" && req.url?.split("?")[0] !== "/config.js") return next();
        res.setHeader("Content-Type", "application/javascript");
        res.end('window.PWR_CONFIG = { URL_API: "/exec", GOOGLE_CLIENT_ID: "", DATA_MODE: "demo" };');
      });
    },
  }],
  server: {
    port: 5173,
    proxy: { "/exec": "http://localhost:8080" },
  },
});
