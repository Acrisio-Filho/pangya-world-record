// Mock do ambiente Google Apps Script sobre os CSVs de tests/fixtures/.
// Edite os CSVs no LibreOffice Calc; mutações (append/setValue/delete) são
// gravadas de volta no disco para inspeção. Sem dependências (só node).
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const crypto = require("crypto");

const DIR = path.join(__dirname, "fixtures");
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
  sandbox.SpreadsheetApp = { getActiveSpreadsheet: () => ({ getSheetByName: loadSheet }) };
  sandbox.ContentService = {
    MimeType: { JSON: "json" },
    createTextOutput: (txt) => ({ setMimeType: () => ({ getContent: () => txt }) }),
  };
  sandbox.Utilities = {
    DigestAlgorithm: { SHA_256: "sha256" },
    computeDigest: (_alg, s) => Array.from(crypto.createHash("sha256").update(s).digest()),
    getUuid: () => crypto.randomUUID(),
  };
  sandbox.LockService = { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) };
  // tokeninfo do Google: email/sub derivam do id_token (determinístico p/ testes)
  sandbox.UrlFetchApp = {
    fetch: (url) => {
      const m = String(url).match(/id_token=([^&]*)/);
      const tok = m ? decodeURIComponent(m[1]) : "";
      const body = tok && tok !== "bad"
        ? { aud: "TROQUE_ISSO_google_client_id", email_verified: "true", email: tok + "@test.com", sub: "sub-" + tok, exp: "9999999999" }
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
