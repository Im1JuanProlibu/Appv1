/**
 * start-ngrok.js — Inicia ngrok v3 tunnel + Metro + QR code
 * Uso: node start-ngrok.js
 */
const { spawn } = require('child_process');
const http = require('http');
const qrcode = require('qrcode-terminal');

const PORT = 8081;

console.log('\n\u{1F680} Iniciando ngrok tunnel en puerto', PORT, '...\n');

const ngrok = spawn('ngrok', ['http', String(PORT), '--log', 'stdout', '--log-format', 'logfmt'], {
  shell: true,
  stdio: ['pipe', 'pipe', 'pipe'],
});

let tunnelUrl = null;
let metroStarted = false;

function startMetro(url) {
  if (metroStarted) return;
  metroStarted = true;
  tunnelUrl = url;
  const host = url.replace(/^https?:\/\//, '');
  console.log(`\n\u2705 Tunnel activo: ${url}`);
  console.log(`   Host: ${host}\n`);

  const metro = spawn('npx', ['expo', 'start', '--port', String(PORT)], {
    shell: true,
    stdio: 'inherit',
    env: { ...process.env, REACT_NATIVE_PACKAGER_HOSTNAME: host },
  });

  setTimeout(() => {
    const expUrl = `exp://${host}`;
    console.log('\n\n========================================');
    console.log('     ESCANEA CON EXPO GO');
    console.log('========================================\n');
    qrcode.generate(expUrl, { small: true });
    console.log(`\nURL: ${expUrl}`);
    console.log('\nEn Expo Go > "Enter URL manually" > pega la URL');
    console.log('========================================\n');
  }, 5000);

  metro.on('exit', (code) => { ngrok.kill(); process.exit(code); });
}

function parseOutput(data) {
  const text = data.toString();
  const match = text.match(/https:\/\/[a-z0-9-]+\.ngrok-free\.\w+/i);
  if (match && !tunnelUrl) startMetro(match[0]);
}
ngrok.stdout.on('data', parseOutput);
ngrok.stderr.on('data', parseOutput);

function pollNgrokApi() {
  if (tunnelUrl) return;
  http.get('http://127.0.0.1:4040/api/tunnels', (res) => {
    let body = '';
    res.on('data', (d) => body += d);
    res.on('end', () => {
      try {
        const data = JSON.parse(body);
        const t = data.tunnels.find(t => t.public_url.startsWith('https://'));
        if (t) { startMetro(t.public_url); return; }
      } catch {}
      setTimeout(pollNgrokApi, 1000);
    });
  }).on('error', () => setTimeout(pollNgrokApi, 1000));
}
setTimeout(pollNgrokApi, 2000);

ngrok.on('exit', () => {
  if (!tunnelUrl) { console.error('\u274C ngrok fallo.'); process.exit(1); }
});
setTimeout(() => {
  if (!tunnelUrl) { console.error('\u274C Timeout 20s'); ngrok.kill(); process.exit(1); }
}, 20000);
process.on('SIGINT', () => { ngrok.kill(); process.exit(0); });
