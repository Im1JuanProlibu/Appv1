/**
 * kill-port.js — Libera un puerto matando el proceso que lo ocupa
 * Uso: node kill-port.js <puerto>
 * Ejemplo: node kill-port.js 8081
 */
const { execSync } = require('child_process');

const port = process.argv[2] || '8081';

try {
  let pid;
  if (process.platform === 'win32') {
    const out = execSync(
      `powershell -Command "(Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue).OwningProcess"`,
      { encoding: 'utf8', timeout: 5000 }
    ).trim();
    pid = out.split('\n')[0].trim();
    if (pid && pid !== '0' && !isNaN(pid)) {
      execSync(`powershell -Command "Stop-Process -Id ${pid} -Force -ErrorAction SilentlyContinue"`, { timeout: 5000 });
      console.log(`Puerto ${port} liberado (PID ${pid})`);
    } else {
      console.log(`Puerto ${port} ya está libre`);
    }
  } else {
    const out = execSync(`lsof -ti tcp:${port} 2>/dev/null || true`, { encoding: 'utf8', timeout: 5000 }).trim();
    if (out) {
      execSync(`kill -9 ${out}`, { timeout: 5000 });
      console.log(`Puerto ${port} liberado (PID ${out})`);
    } else {
      console.log(`Puerto ${port} ya está libre`);
    }
  }
} catch (e) {
  // Si falla (no había proceso), continuar igual
  console.log(`Puerto ${port} listo`);
}
