// Gera (ou reseta) os CSVs de teste. Abra no LibreOffice Calc para inspecionar/editar:
//   libreoffice tests/fixtures/*.csv
// O tests/run.js chama este setup antes dos testes; rode sozinho só p/ inspecionar.
// Uso: node tests/setup.js
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DIR = process.env.PWR_FIXTURES_DIR || path.join(__dirname, "fixtures");
const SALT = "TROQUE_ISSO_salt_bem_longo"; // igual ao backend/Code.gs
const hash = (s) => crypto.createHash("sha256").update(SALT + s).digest("hex");

const csv = (rows) => rows.map((r) => r.join(",")).join("\n") + "\n";

const FILES = {
  "Users.csv": [
    ["id", "nickname", "email", "pass_hash", "role", "status", "bio", "youtube_url", "points", "created_at", "google_sub", "avatar_url"],
    ["admin-1", "Admin", "admin@test.com", hash("admin123"), "admin", "active", "", "", "0", new Date().toISOString(), "", ""],
  ],
  "Courses.csv": [
    ["id", "name", "active"],
    ["blue_water", "Blue Water", "TRUE"],
    ["blue_lagoon", "Blue Lagoon", "TRUE"],
  ],
  "PowerBands.csv": [
    ["id", "label", "min", "max", "active"],
    ["b230_240", "230-240", "230", "240", "TRUE"],
    ["b241_250", "241-250", "241", "250", "TRUE"],
    ["b251_260", "251-260", "251", "260", "TRUE"],
    ["b261_270", "261-270", "261", "270", "TRUE"],
  ],
  "Records.csv": [
    ["id", "user_id", "course_id", "powerband_id", "power_value", "score", "pang", "method", "wind", "screenshot_url", "video_url", "status", "submitted_at", "validated_by", "validated_at", "note", "is_best", "community", "pts_admin", "pts_com", "edited", "edit_of"],
  ],
  "Votes.csv": [["id", "record_id", "user_id", "vote", "weight", "created_at"]],
  "Sessions.csv": [["token", "user_id", "expires_at"]],
};

// The regular test suite starts empty. The local demo can opt into this larger
// dataset to exercise pagers without ever touching the private Google Sheet.
if (process.env.PWR_DEMO_SEED === "1") {
  const now = new Date().toISOString();
  const users = FILES["Users.csv"];
  const records = FILES["Records.csv"];
  for (let i = 1; i <= 48; i++) {
    const id = `demo-player-${i}`;
    users.push([id, `Jogador ${String(i).padStart(2, "0")}`, `demo${i}@local.test`, hash(`demo-${i}`), "user", "active", "Jogador de demonstração", "", "15", now, ""]);
  }
  for (let i = 1; i <= 72; i++) {
    const player = `demo-player-${((i - 1) % 48) + 1}`;
    const course = i % 2 ? "blue_water" : "blue_lagoon";
    const band = i % 3 === 0 ? "b251_260" : "b241_250";
    const power = band === "b251_260" ? 255 : 245;
    records.push([
      `demo-record-${i}`, player, course, band, String(power), String(-10 - (i % 22)), String(8000 + i * 125),
      i % 3 === 0 ? "sem_ajuda" : "com_ajuda", i % 4 === 0 ? "natural" : "normal", "", i % 3 === 0 ? `https://example.test/demo-${i}` : "",
      "approved", now, "Admin", now, "Record de demonstração", "", "1", "TRUE", "TRUE", "", "",
    ]);
  }
  // The demo must obey the production invariant too: one BEST for each
  // course + power band + method + wind, with lower score then higher Pang.
  const bestByCategory = new Map();
  records.slice(1).forEach((row) => {
    if (row[11] !== "approved" || row[17] !== "1") return;
    const key = [row[2], row[3], row[7], row[8]].join("|");
    const current = bestByCategory.get(key);
    if (!current || Number(row[5]) < Number(current[5]) || (Number(row[5]) === Number(current[5]) && Number(row[6]) > Number(current[6]))) bestByCategory.set(key, row);
  });
  bestByCategory.forEach((row) => { row[16] = "TRUE"; });
  for (let i = 1; i <= 38; i++) {
    const player = `demo-player-${((i + 12) % 48) + 1}`;
    records.push([
      `demo-community-${i}`, player, i % 2 ? "blue_water" : "blue_lagoon", "b241_250", "245", String(-8 - (i % 18)), String(7000 + i * 80),
      "com_ajuda", "normal", "", "", "approved", now, "Admin", now, "Aguardando a comunidade", "", "0", "TRUE", "", "", "",
    ]);
  }
}

fs.mkdirSync(DIR, { recursive: true });
for (const [f, rows] of Object.entries(FILES)) fs.writeFileSync(path.join(DIR, f), csv(rows));
console.log(`fixtures ${process.env.PWR_DEMO_SEED === "1" ? "de demonstração" : "de teste"} resetadas em ${DIR}`);
