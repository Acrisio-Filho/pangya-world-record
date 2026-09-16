// Servidor local p/ teste end-to-end: serve frontend/ + API no mesmo processo.
// Uso: node tests/server.js [porta] [mock|real|URL]
//   mock → API mock local (mesmo com .env preenchido)
//   real → planilha de verdade (URL do .env ou passada junto)
//   URL  → real com aquela URL | nada → .env se tiver URL_EXEC, senão mock
// O /js/config.js é servido com URL_API apontada (sem editar o arquivo).
// Dados mock: tests/fixtures/*.csv (inspecione com `libreoffice tests/fixtures/*.csv`).
const fs = require("fs");
const path = require("path");
const http = require("http");

let port = 8080, mode = "", urlArg = "";
for (const a of process.argv.slice(2)) {
  if (/^\d+$/.test(a)) port = Number(a);
  else if (/^https?:\/\//i.test(a)) urlArg = a;
  else if (a === "mock") mode = "mock";
  else if (a === "real" || a === "api") mode = "real";
}
// .env (gitignorado): URL_EXEC + ORIGEM_TOKEN + GOOGLE_CLIENT_ID reais p/ testar contra a planilha de verdade.
function loadEnv() {
  const env = {};
  try {
    const f = path.join(__dirname, "..", ".env");
    if (!fs.existsSync(f)) return env;
    fs.readFileSync(f, "utf8").split("\n").forEach((line) => {
      const t = line.trim();
      if (!t || t.startsWith("#")) return;
      const i = t.indexOf("=");
      if (i < 0) return;
      env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    });
  } catch {}
  return env;
}
const ENV = loadEnv();
const REAL_URL = mode === "mock" ? "" : urlArg || ENV.URL_EXEC || "";
const REAL_TOKEN = ENV.ORIGEM_TOKEN || "";
const REAL_GID = ENV.GOOGLE_CLIENT_ID || "";
// Validação amiga: valores trocados geram 404 estranho no navegador.
if (REAL_URL && !/^https?:\/\//i.test(REAL_URL)) console.error("AVISO: URL_EXEC não parece URL (trocou com ORIGEM_TOKEN?)");
if (REAL_TOKEN && /^https?:\/\//i.test(REAL_TOKEN)) console.error("AVISO: ORIGEM_TOKEN parece URL (trocou com URL_EXEC?)");
if (REAL_URL && !/\/exec(\?|$)/i.test(REAL_URL)) console.error("AVISO: URL_EXEC não termina com /exec — use a URL do App da Web (Implantar > Gerenciar implantações), não a da planilha");
if (mode === "real" && !REAL_URL) {
  console.error("modo real sem URL: preencha URL_EXEC no .env ou passe a URL junto");
  process.exit(1);
}
const API_URL = REAL_URL || `http://localhost:${port}/exec`;
const FIXTURES = path.join(__dirname, "fixtures");
if (!fs.existsSync(FIXTURES)) require("./setup.js");
const { loadApi } = require("./gas-mock.js");
const api = loadApi();

const WEBROOT = path.join(__dirname, "..", "frontend");
const MIME = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript" };

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

  let file = url.pathname === "/" ? "/index.html" : url.pathname;
  const abs = path.normalize(path.join(WEBROOT, file));
  if (!abs.startsWith(WEBROOT) || !fs.existsSync(abs) || fs.statSync(abs).isDirectory()) {
    return send(res, 404, "não encontrado", "text/plain");
  }
  let content = fs.readFileSync(abs, "utf8");
  if (file === "/js/config.js") {
    content = content.replace(/const URL_API = ".*?"/, `const URL_API = "${API_URL}"`);
    // No modo real o token vem do .env (o mock espera o placeholder do Code.gs).
    if (REAL_URL && REAL_TOKEN) content = content.replace(/const ORIGEM_TOKEN = ".*?"/, `const ORIGEM_TOKEN = "${REAL_TOKEN}"`);
    // Client ID idem: botão Google local funciona sem editar o arquivo.
    if (REAL_GID) content = content.replace(/const GOOGLE_CLIENT_ID = ".*?"/, `const GOOGLE_CLIENT_ID = "${REAL_GID}"`);
  }
  send(res, 200, content, MIME[path.extname(abs)] || "text/plain");
});

server.listen(port, () => console.log(`local: http://localhost:${port}/  (API em ${REAL_URL ? "PLANILHA REAL" : "/exec mock"})`));
