/**
 * patch-ngrok.js — Parchea @expo/ngrok para funcionar con ngrok v3
 *
 * Se ejecuta automáticamente con `npm install` (postinstall)
 * o manualmente con `node patch-ngrok.js`
 *
 * Parches aplicados:
 *  1. process.js   — log format logfmt, parseAddr v3, skip setAuthtoken, skip configPath
 *  2. index.js     — filtrar campos incompatibles, UUID nuevo por retry, recuperar tunnel existente
 *  3. client.js    — manejar error.response undefined
 *  4. AsyncNgrok.js — timeout 10s → 30s
 *  5. NgrokResolver.js — resolver local directo (sin global)
 *  6. Binario — copiar ngrok v3 si está disponible en PATH
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const NGROK_PKG = path.join(__dirname, 'node_modules', '@expo', 'ngrok');
const EXPO_CLI = path.join(__dirname, 'node_modules', 'expo', 'node_modules', '@expo', 'cli', 'build', 'src', 'start');

function patchFile(filePath, patches) {
    if (!fs.existsSync(filePath)) {
        console.log(`  ⚠ No existe: ${path.relative(__dirname, filePath)}`);
        return false;
    }
    let content = fs.readFileSync(filePath, 'utf8');
    for (const [search, replace] of patches) {
        if (content.includes(replace)) continue; // ya parcheado
        if (!content.includes(search)) {
            console.log(`  ⚠ No se encontró texto a parchear en ${path.basename(filePath)}`);
            return false;
        }
        content = content.replace(search, replace);
    }
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
}

console.log('\n🔧 Aplicando parches ngrok v3...\n');

// ─── 1. process.js ───
const processFile = path.join(NGROK_PKG, 'src', 'process.js');
if (fs.existsSync(processFile)) {
    let proc = fs.readFileSync(processFile, 'utf8');
    let changed = false;

    // 1a. Add --log-format=logfmt
    if (!proc.includes('--log-format=logfmt')) {
        proc = proc.replace(
            '["start", "--none", "--log=stdout"]',
            '["start", "--none", "--log=stdout", "--log-format=logfmt"]'
        );
        changed = true;
    }

    // 1b. Remove configPath flag
    if (proc.includes('if (opts.configPath) start.push("--config=" + opts.configPath);')) {
        proc = proc.replace(
            'if (opts.configPath) start.push("--config=" + opts.configPath);',
            '// ngrok v3: use default config path'
        );
        changed = true;
    }

    // 1c. Replace parseAddr for v3 logfmt
    if (!proc.includes('addr=(\\\\d+')) {
        proc = proc.replace(
            /function parseAddr\(message\) \{[\s\S]*?\n\}/,
            `function parseAddr(message) {
  if (message[0] === "{") {
    try { const p = JSON.parse(message); if (p.addr) return p.addr; } catch {}
  }
  const lf = message.match(/addr=(\\d+\\.\\d+\\.\\d+\\.\\d+:\\d+)/);
  if (lf) return lf[1];
  return null;
}`
        );
        changed = true;
    }

    // 1d. Skip setAuthtoken (ngrok v3 already has it configured)
    if (!proc.includes('// ngrok v3: authtoken is already configured')) {
        proc = proc.replace(
            /async function setAuthtoken\(optsOrToken\) \{[\s\S]*?^}/m,
            `async function setAuthtoken(optsOrToken) {
  // ngrok v3: authtoken is already configured in ngrok.yml — skip
  return Promise.resolve();
}`
        );
        changed = true;
    }

    if (changed) {
        fs.writeFileSync(processFile, proc, 'utf8');
        console.log('  ✅ process.js');
    } else {
        console.log('  ✅ process.js (ya parcheado)');
    }
}

// ─── 2. index.js ───
const indexFile = path.join(NGROK_PKG, 'index.js');
if (fs.existsSync(indexFile)) {
    let idx = fs.readFileSync(indexFile, 'utf8');
    let changed = false;

    // Replace connectRetry completely
    if (!idx.includes('tunnelOpts.name = String(uuid.v4())')) {
        idx = idx.replace(
            /async function connectRetry\(opts, retryCount = 0\) \{[\s\S]*?\n\}/,
            `async function connectRetry(opts, retryCount = 0) {
  const tunnelOpts = {};
  ['proto','addr','inspect','host_header','bind_tls','schemes','auth','metadata'].forEach(k => { if (opts[k] !== undefined) tunnelOpts[k] = opts[k]; });
  tunnelOpts.name = String(uuid.v4());
  try {
    const response = await ngrokClient.startTunnel(tunnelOpts);
    return response.public_url;
  } catch (err) {
    if (err.message && err.message.includes('already exists')) {
      try {
        const tunnels = (await ngrokClient.listTunnels()).tunnels;
        const existing = tunnels.find(t => t.public_url && t.public_url.startsWith('https://'));
        if (existing) return existing.public_url;
      } catch {}
    }
    if (!isRetriable(err) || retryCount >= 100) {
      throw err;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
    return connectRetry(opts, ++retryCount);
  }
}`
        );
        changed = true;
    }

    if (changed) {
        fs.writeFileSync(indexFile, idx, 'utf8');
        console.log('  ✅ index.js');
    } else {
        console.log('  ✅ index.js (ya parcheado)');
    }
}

// ─── 3. client.js ───
const clientFile = path.join(NGROK_PKG, 'src', 'client.js');
if (fs.existsSync(clientFile)) {
    let cli = fs.readFileSync(clientFile, 'utf8');
    let changed = false;

    // Fix request() catch
    if (!cli.includes('if (!error.response) { throw new NgrokClientError(error.message')) {
        cli = cli.replace(
            `} catch (error) {
      let clientError;
      try {
        const response = JSON.parse(error.response.body);`,
            `} catch (error) {
      let clientError;
      if (!error.response) { throw new NgrokClientError(error.message || String(error), null, null); }
      try {
        const response = JSON.parse(error.response.body);`
        );
        changed = true;
    }

    // Fix booleanRequest() catch
    if (cli.includes('const response = JSON.parse(error.response.body);\n      throw new NgrokClientError(response.msg')
        && !cli.includes('// booleanRequest guard')) {
        cli = cli.replace(
            `} catch (error) {
      const response = JSON.parse(error.response.body);
      throw new NgrokClientError(response.msg, error.response, response);`,
            `} catch (error) {
      // booleanRequest guard
      if (!error.response) { throw new NgrokClientError(error.message || String(error), null, null); }
      const response = JSON.parse(error.response.body);
      throw new NgrokClientError(response.msg, error.response, response);`
        );
        changed = true;
    }

    if (changed) {
        fs.writeFileSync(clientFile, cli, 'utf8');
        console.log('  ✅ client.js');
    } else {
        console.log('  ✅ client.js (ya parcheado)');
    }
}

// ─── 4. AsyncNgrok.js — timeout ───
const asyncNgrokFile = path.join(EXPO_CLI, 'server', 'AsyncNgrok.js');
if (fs.existsSync(asyncNgrokFile)) {
    const patched = patchFile(asyncNgrokFile, [
        ['const TUNNEL_TIMEOUT = 10 * 1000;', 'const TUNNEL_TIMEOUT = 30 * 1000;']
    ]);
    console.log(`  ✅ AsyncNgrok.js${patched ? '' : ' (ya parcheado)'}`);
}

// ─── 5. NgrokResolver.js — resolver local directo ───
const resolverFile = path.join(EXPO_CLI, 'doctor', 'ngrok', 'NgrokResolver.js');
if (fs.existsSync(resolverFile)) {
    let res = fs.readFileSync(resolverFile, 'utf8');
    if (!res.includes('// Override to always load local patched')) {
        res = res.replace(
            `const _ExternalModule = require("./ExternalModule");
class NgrokResolver extends _ExternalModule.ExternalModule {
    constructor(projectRoot){
        super(projectRoot, {
            name: '@expo/ngrok',
            versionRange: '^4.1.0'
        }, (packageName)=>\`The package \${packageName} is required to use tunnels, would you like to install it globally?\`);
    }
}`,
            `const _ExternalModule = require("./ExternalModule");
const _path = require("path");
class NgrokResolver extends _ExternalModule.ExternalModule {
    constructor(projectRoot){
        super(projectRoot, {
            name: '@expo/ngrok',
            versionRange: '^4.1.0'
        }, (packageName)=>\`The package \${packageName} is required to use tunnels, would you like to install it globally?\`);
    }
    // Override to always load local patched @expo/ngrok
    getVersioned() {
        if (!this.instance) {
            const ngrokPath = _path.join(this.projectRoot, 'node_modules', '@expo', 'ngrok');
            this.instance = require(ngrokPath);
        }
        return this.instance;
    }
}`
        );
        fs.writeFileSync(resolverFile, res, 'utf8');
        console.log('  ✅ NgrokResolver.js');
    } else {
        console.log('  ✅ NgrokResolver.js (ya parcheado)');
    }
}

// ─── 6. Copiar binario ngrok v3 ───
const binTarget = path.join(__dirname, 'node_modules', '@expo', 'ngrok-bin-win32-x64', 'ngrok.exe');
if (fs.existsSync(binTarget)) {
    try {
        const ver = execSync(`"${binTarget}" version`, { encoding: 'utf8', timeout: 5000 }).trim();
        if (ver.includes('3.')) {
            console.log(`  ✅ Binario ya es v3 (${ver})`);
        } else {
            throw new Error('v2');
        }
    } catch {
        // Intentar copiar ngrok v3 desde PATH
        try {
            const ngrokPath = execSync('where ngrok', { encoding: 'utf8', timeout: 5000 }).trim().split('\n')[0].trim();
            const ngrokVer = execSync(`"${ngrokPath}" version`, { encoding: 'utf8', timeout: 5000 }).trim();
            if (ngrokVer.includes('3.')) {
                fs.copyFileSync(ngrokPath, binTarget);
                console.log(`  ✅ Binario reemplazado con ${ngrokVer}`);
            } else {
                console.log(`  ⚠ ngrok en PATH es ${ngrokVer}, necesita v3+`);
            }
        } catch {
            console.log('  ⚠ ngrok v3 no encontrado en PATH — instálalo con: winget install ngrok.ngrok');
        }
    }
}

// ─── 7. Desinstalar global si existe ───
try {
    execSync('npm list -g @expo/ngrok 2>&1', { encoding: 'utf8' });
    console.log('  🗑  Eliminando @expo/ngrok global (conflicta)...');
    execSync('npm uninstall -g @expo/ngrok', { encoding: 'utf8' });
    console.log('  ✅ Global eliminado');
} catch {
    // No hay global, OK
}

console.log('\n✅ Parches aplicados. Usa: npx expo start --tunnel --go\n');
