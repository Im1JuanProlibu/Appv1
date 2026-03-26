/**
 * start-dev.js — Inicia Cloudflare Tunnel + Metro + QR code
 * Uso: node start-dev.js
 */
const { spawn } = require('child_process');
const qrcode = require('qrcode-terminal');

const PORT = 8081;

console.log('\n🚀 Iniciando servidor de desarrollo...\n');

// 1. Iniciar Cloudflare Tunnel
const cf = spawn('npx', ['cloudflared', 'tunnel', '--url', `http://localhost:${PORT}`], {
  shell: true,
  stdio: ['ignore', 'pipe', 'pipe'],
});

let tunnelUrl = null;
let metroStarted = false;

function onTunnelUrl(url) {
  if (metroStarted) return;
  metroStarted = true;
  tunnelUrl = url;
  const host = url.replace('https://', '');

  console.log(`\n✅ Tunnel activo: ${url}\n`);

  // 2. Iniciar Metro con el host del tunnel
  const metro = spawn('npx', ['expo', 'start', '--port', String(PORT)], {
    shell: true,
    stdio: 'inherit',
    env: { ...process.env, REACT_NATIVE_PACKAGER_HOSTNAME: host },
  });

  // 3. Mostrar QR después de 5 segundos
  setTimeout(() => {
    const expUrl = `exp://${host}`;
    console.log('\n\n========================================');
    console.log('     ESCANEA CON EXPO GO');
    console.log('========================================\n');
    qrcode.generate(expUrl, { small: true });
    console.log(`\nURL: ${expUrl}`);
    console.log('\nO en Expo Go → "Enter URL manually" → pega la URL de arriba');
    console.log('========================================\n');
  }, 5000);

  metro.on('exit', (code) => {
    cf.kill();
    process.exit(code);
  });
}

// Buscar URL del tunnel en stdout y stderr
function parseOutput(data) {
  const text = data.toString();
  process.stdout.write(text.includes('trycloudflare') ? '' : '');
  const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
  if (match && !tunnelUrl) {
    onTunnelUrl(match[0]);
  }
}

cf.stdout.on('data', parseOutput);
cf.stderr.on('data', parseOutput);

cf.on('exit', (code) => {
  if (!tunnelUrl) {
    console.error('❌ Cloudflare tunnel falló. Asegúrate de tener conexión a internet.');
    process.exit(1);
  }
});

// Timeout si no conecta en 30s
setTimeout(() => {
  if (!tunnelUrl) {
    console.error('\n❌ Timeout: Cloudflare no respondió en 30 segundos.');
    cf.kill();
    process.exit(1);
  }
}, 30000);
