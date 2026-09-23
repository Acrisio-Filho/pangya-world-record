// Mock do ambiente Google Apps Script sobre os CSVs de tests/fixtures/.
// Edite os CSVs no LibreOffice Calc; mutações (append/setValue/delete) são
// gravadas de volta no disco para inspeção. Sem dependências (só node).
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const crypto = require("crypto");
const zlib = require("zlib");

const DIR = process.env.PWR_FIXTURES_DIR || path.join(__dirname, "fixtures");
const SHEET_FILE = { Users: "Users.csv", Courses: "Courses.csv", PowerBands: "PowerBands.csv", Records: "Records.csv", Sessions: "Sessions.csv", Votes: "Votes.csv" };

const parse = (txt) => txt.trim().split("\n").map((l) => l.split(","));
const stringify = (grid) => grid.map((r) => r.join(",")).join("\n") + "\n";

function loadSheet(name) {
  const grid = parse(fs.readFileSync(path.join(DIR, SHEET_FILE[name]), "utf8"));
  const save = () => fs.writeFileSync(path.join(DIR, SHEET_FILE[name]), stringify(grid));
  return {
    getDataRange: () => ({ getValues: () => grid.map((r) => r.slice()) }),
    appendRow: (row) => { grid.push(row.map(String)); save(); },
    deleteRow: (n) => { grid.splice(n - 1, 1); save(); },
    getRange: (row, col, nRows = 1, nCols = 1) => ({
      setValue: (v) => { grid[row - 1][col - 1] = String(v); save(); },
      setValues: (mat) => { mat.forEach((r, i) => r.forEach((v, j) => { grid[row - 1 + i][col - 1 + j] = String(v); })); save(); },
    }),
  };
}

function loadApi() {
  const sandbox = {};
  const cache = new Map();
  sandbox.SpreadsheetApp = { getActiveSpreadsheet: () => ({ getSheetByName: loadSheet }) };
  sandbox.ContentService = {
    MimeType: { JSON: "json" },
    createTextOutput: (txt) => ({ setMimeType: () => ({ getContent: () => txt }) }),
  };
  sandbox.Utilities = {
    DigestAlgorithm: { SHA_256: "sha256" },
    computeDigest: (_alg, s) => Array.from(crypto.createHash("sha256").update(s).digest()),
    getUuid: () => crypto.randomUUID(),
    newBlob: (value) => {
      const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value);
      return { getBytes: () => Array.from(bytes), getDataAsString: () => bytes.toString("utf8") };
    },
    gzip: (blob) => {
      const bytes = Buffer.from(blob.getBytes());
      return sandbox.Utilities.newBlob(zlib.gzipSync(bytes));
    },
    ungzip: (blob) => sandbox.Utilities.newBlob(zlib.gunzipSync(Buffer.from(blob.getBytes()))),
    base64EncodeWebSafe: (bytes) => Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
    base64DecodeWebSafe: (value) => Array.from(Buffer.from(String(value).replace(/-/g, "+").replace(/_/g, "/"), "base64")),
  };
  sandbox.LockService = { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) };
  sandbox.CacheService = {
    getScriptCache: () => ({
      get: key => cache.get(key) || null,
      put: (key, value) => cache.set(key, value),
      remove: key => cache.delete(key),
    }),
  };
  // Simula a troca server-side do código OAuth e a validação do ID token.
  // Tokens curtos preservam o fallback determinístico dos testes.
  sandbox.UrlFetchApp = {
    fetch: (url, options = {}) => {
      if (String(url) === "https://oauth2.googleapis.com/token") {
        return { getContentText: () => JSON.stringify({ id_token: options.payload?.code || "" }) };
      }
      const m = String(url).match(/id_token=([^&]*)/);
      const tok = m ? decodeURIComponent(m[1]) : "";
      let claims = {};
      try {
        const part = tok.split(".")[1];
        if (part) claims = JSON.parse(Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
      } catch { /* token de fixture ou formato inválido: usa fallback abaixo */ }
      const body = tok && tok !== "bad"
        ? { aud: "TROQUE_ISSO_google_client_id", email_verified: "true", email: claims.email || (tok === "nick-conflict" ? "player1@google.test" : tok + "@test.com"), sub: claims.sub || "sub-" + tok, picture: claims.picture || "https://lh3.googleusercontent.com/a/" + tok, exp: "9999999999" }
        : { aud: "outro-cliente", email_verified: "true", email: "x@test.com", sub: "sx", exp: "9999999999" };
      return { getContentText: () => JSON.stringify(body) };
    },
  };
  sandbox.console = console;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "backend", "Code.gs"), "utf8"), sandbox, { filename: "Code.gs" });
  const call = (fn, e) => JSON.parse(sandbox[fn](e).getContent());
  return {
    get: (params) => call("doGet", { parameter: params }),
    post: (payload, params = {}) => call("doPost", { postData: { contents: JSON.stringify(payload) }, parameter: params }),
  };
}

module.exports = { loadApi };
