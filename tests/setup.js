// Gera (ou reseta) os CSVs de teste. Abra no LibreOffice Calc para inspecionar/editar:
//   libreoffice tests/fixtures/*.csv
// O tests/run.js chama este setup antes dos testes; rode sozinho só p/ inspecionar.
// Uso: node tests/setup.js
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DIR = path.join(__dirname, "fixtures");
const SALT = "TROQUE_ISSO_salt_bem_longo"; // igual ao backend/Code.gs
const hash = (s) => crypto.createHash("sha256").update(SALT + s).digest("hex");

const csv = (rows) => rows.map((r) => r.join(",")).join("\n") + "\n";

const FILES = {
  "Users.csv": [
    ["id", "nickname", "email", "pass_hash", "role", "status", "bio", "youtube_url", "points", "created_at", "google_sub"],
    ["admin-1", "Admin", "admin@test.com", hash("admin123"), "admin", "active", "", "", "0", new Date().toISOString(), ""],
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

fs.mkdirSync(DIR, { recursive: true });
for (const [f, rows] of Object.entries(FILES)) fs.writeFileSync(path.join(DIR, f), csv(rows));
console.log("fixtures resetadas em tests/fixtures/");
