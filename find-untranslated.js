const {parse} = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const fs = require('fs');

const files = [
  'src/screens/ProposalsScreen.js',
  'src/screens/DashboardScreen.js',
  'src/screens/SettingsScreen.js',
  'src/screens/LoginScreen.js',
  'src/screens/AgentsScreen.js',
  'src/screens/ReportsScreen.js',
  'src/screens/EditorScreen.js',
  'src/screens/CreateProposalScreen.js',
  'src/screens/DomainScreen.js',
  'src/components/BottomTabBar.js',
];

// Detect Spanish by looking for common Spanish words/chars
const SPANISH_RE = /[áéíóúñüÁÉÍÓÚÑÜ¿¡]|(\b(de|la|el|los|las|por|para|con|sin|del|una|uno|que|est[aáe]|propuesta|filtro|cerrar|guardar|borrar|cancelar|enviar|ver|todo|todos|nueva|nuevo|mis|modo|oscuro|idioma|cuenta|plantilla|ajustes|notificaci|cargando|actualizar|recargar|propuestas|dashboard|reportes|agentes)\b)/i;

const TEXT_ELEMENTS = new Set(['Text', 'TextInput']);

files.forEach(filePath => {
  let code;
  try { code = fs.readFileSync(filePath, 'utf8'); } catch { return; }
  let ast;
  try { ast = parse(code, { sourceType: 'module', plugins: ['jsx'] }); } catch(e) { return; }

  const issues = [];

  traverse(ast, {
    JSXElement(path) {
      const name = path.node.openingElement?.name?.name || '';
      if (!TEXT_ELEMENTS.has(name)) return;

      path.node.children.forEach(child => {
        if (child.type === 'JSXText') {
          const val = child.value.trim();
          if (val && SPANISH_RE.test(val)) {
            issues.push(`L${child.loc.start.line}: JSXText "${val.slice(0,80)}"`);
          }
        }
        if (child.type === 'JSXExpressionContainer') {
          const expr = child.expression;
          // t('key') || 'hardcoded fallback' — check the fallback
          if (expr.type === 'LogicalExpression' && expr.operator === '||') {
            const right = expr.right;
            if (right.type === 'StringLiteral' && SPANISH_RE.test(right.value)) {
              issues.push(`L${child.loc.start.line}: fallback "${right.value.slice(0,80)}"`);
            }
          }
        }
      });
    },
    // Also check placeholder props on TextInput
    JSXAttribute(path) {
      if (path.node.name?.name !== 'placeholder') return;
      const val = path.node.value;
      if (!val) return;
      const str = val.type === 'StringLiteral' ? val.value
        : val.expression?.type === 'StringLiteral' ? val.expression.value : null;
      if (str && SPANISH_RE.test(str)) {
        issues.push(`L${path.node.loc.start.line}: placeholder "${str.slice(0,80)}"`);
      }
    }
  });

  if (issues.length > 0) {
    console.log('\n=== ' + filePath + ' (' + issues.length + ') ===');
    issues.forEach(i => console.log('  ' + i));
  } else {
    console.log('OK: ' + filePath);
  }
});
console.log('\nDone.');
