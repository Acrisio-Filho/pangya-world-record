// Servidor local p/ teste end-to-end: serve frontend/dist (build do Vite) + API
// no mesmo processo. Uso: node tests/server.js [porta] [mock|real|URL]
//   mock → API mock local (mesmo com .env preenchido)
//   real → planilha de verdade (URL do .env ou passada junto)
//   URL  → real com aquela URL | nada → .env se tiver URL_EXEC, senão mock
// O /config.js é servido com URL_API apontada (sem editar o arquivo).
// Dados mock: tests/fixtures/*.csv (inspecione com `libreoffice tests/fixtures/*.csv`).
const fs = require("fs");
const path = require("path");
const http = require("http");
const { execSync } = require("child_process");

let port = 8080, mode = "", urlArg = "";
for (const a of process.argv.slice(2)) {
  if (/^\d+$/.test(a)) port = Number(a);
  else if (/^https?:\/\//i.test(a)) urlArg = a;
  else if (a === "mock") mode = "mock";
  else if (a === "real" || a === "api") mode = "real";
}
// .env e .env.local usam mock por padrão. PWR_DATA_MODE=real é a escolha
// explícita para apontar formulários à planilha de verdade.
function loadEnv() {
  const env = {};
  try {
    for (const name of [".env", ".env.local"]) {
      const f = path.join(__dirname, "..", name);
      if (!fs.existsSync(f)) continue;
      fs.readFileSync(f, "utf8").split("\n").forEach((line) => {
        const t = line.trim();
        if (!t || t.startsWith("#")) return;
        const i = t.indexOf("=");
        if (i < 0) return;
        env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
      });
    }
  } catch {}
  return env;
}
const ENV = loadEnv();
const dataMode = mode || process.env.PWR_DATA_MODE || ENV.PWR_DATA_MODE || "mock";
const REAL_URL = dataMode === "real" ? urlArg || ENV.URL_EXEC || "" : "";
const REAL_TOKEN = ENV.ORIGEM_TOKEN || "";
const REAL_GID = ENV.GOOGLE_CLIENT_ID || "";
// Validação amiga: valores trocados geram 404 estranho no navegador.
if (REAL_URL && !/^https?:\/\//i.test(REAL_URL)) console.error("AVISO: URL_EXEC não parece URL (trocou com ORIGEM_TOKEN?)");
if (REAL_TOKEN && /^https?:\/\//i.test(REAL_TOKEN)) console.error("AVISO: ORIGEM_TOKEN parece URL (trocou com URL_EXEC?)");
if (REAL_URL && !/\/exec(\?|$)/i.test(REAL_URL)) console.error("AVISO: URL_EXEC não termina com /exec — use a URL do App da Web (Implantar > Gerenciar implantações), não a da planilha");
if (dataMode === "real" && !REAL_URL) {
  console.error("modo real sem URL: preencha URL_EXEC no .env ou passe a URL junto");
  process.exit(1);
}
const API_URL = REAL_URL || `http://localhost:${port}/exec`;
const FIXTURES = process.env.PWR_FIXTURES_DIR || path.join(__dirname, "fixtures");
if (!fs.existsSync(FIXTURES)) require("./setup.js");
const { loadApi } = require("./gas-mock.js");
const api = loadApi();

const FRONTEND = path.join(__dirname, "..", "frontend");
const WEBROOT = path.join(FRONTEND, "dist");
// O build usa base "/pangya-world-record/" (nome do repo, pro GitHub Pages);
// localmente servimos tudo em "/", então tiramos esse prefixo das requisições.
const BASE = "/pangya-world-record";
if (!fs.existsSync(path.join(WEBROOT, "index.html"))) {
  if (!fs.existsSync(path.join(FRONTEND, "node_modules"))) {
    console.error("frontend/node_modules não existe — rode `npm install` dentro de frontend/ primeiro.");
    process.exit(1);
  }
  console.log("build do frontend não encontrado — rodando `npm run build`...");
  execSync("npm run build", { cwd: FRONTEND, stdio: "inherit" });
}
const MIME = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp" };

const send = (res, code, body, type = "application/json") => {
  res.writeHead(code, { "Content-Type": `${type};charset=utf-8`, "Access-Control-Allow-Origin": "*" });
  res.end(body);
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");

  if (url.pathname === "/exec") {
    if (req.method === "OPTIONS") return send(res, 204, "");
    if (req.method === "GET") return send(res, 200, JSON.stringify(api.get(Object.fromEntries(url.searchParams))));
    if (req.method === "POST") {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        try {
          return send(res, 200, JSON.stringify(api.post(JSON.parse(body), Object.fromEntries(url.searchParams))));
        } catch (e) { return send(res, 400, JSON.stringify({ erro: String(e.message || e) })); }
      });
      return;
    }
    return send(res, 405, JSON.stringify({ erro: "método inválido" }));
  }

  const pathname = url.pathname.startsWith(BASE + "/") ? url.pathname.slice(BASE.length) : url.pathname;
  let file = pathname === "/" ? "/index.html" : pathname;
  let abs = path.normalize(path.join(WEBROOT, file));
  // rota SPA (hash routing): qualquer caminho desconhecido cai no index.html
  if (!abs.startsWith(WEBROOT + path.sep) || !fs.existsSync(abs) || fs.statSync(abs).isDirectory()) {
    if (path.extname(file)) return send(res, 404, "não encontrado", "text/plain");
    abs = path.join(WEBROOT, "index.html");
  }
  let content = fs.readFileSync(abs);
  if (file === "/config.js") {
    content = "window.PWR_CONFIG = " + JSON.stringify({
      URL_API: API_URL,
      ORIGEM_TOKEN: REAL_URL ? REAL_TOKEN : "TROQUE_ISSO_pwr_123",
      // The Google button only needs a public Client ID; it is independent
      // from whether the records API is using the local mock or Apps Script.
      GOOGLE_CLIENT_ID: REAL_GID,
      DATA_MODE: REAL_URL ? "live" : "demo",
    }) + ";\n";
  }
  send(res, 200, content, MIME[path.extname(abs)] || "text/plain");
});

server.listen(port, () => console.log(`local: http://localhost:${port}/  (API em ${REAL_URL ? "PLANILHA REAL" : "/exec mock"})`));
