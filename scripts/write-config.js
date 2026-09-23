const fs = require('node:fs');
const config = { URL_API: process.env.PWR_URL_EXEC || '', GOOGLE_CLIENT_ID: process.env.PWR_GOOGLE_CLIENT_ID || '' };
if (!/^https:\/\//.test(config.URL_API)) throw new Error('Configure PWR_URL_EXEC in repository secrets.');
fs.writeFileSync('frontend/public/config.js', `window.PWR_CONFIG = ${JSON.stringify(config, null, 2)};\n`);
