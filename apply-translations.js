const fs = require('fs');

function patch(filePath, replacements) {
  let c = fs.readFileSync(filePath, 'utf8');
  let changed = 0;
  for (const [from, to] of replacements) {
    if (c.includes(from)) {
      c = c.split(from).join(to);
      changed++;
    } else {
      console.log('  MISS: ' + from.slice(0, 60));
    }
  }
  fs.writeFileSync(filePath, c, 'utf8');
  console.log(filePath + ': ' + changed + '/' + replacements.length + ' replaced');
}

// ── DashboardScreen ──────────────────────────────────────────────────────────
patch('src/screens/DashboardScreen.js', [
  // Import useTranslation
  ["import { useTheme } from '../ThemeContext';", "import { useTheme } from '../ThemeContext';\nimport { useTranslation } from '../i18n';"],
  // Add t to component
  ["const { colors: COLORS, isDark } = useTheme();\n  const [loading, setLoading]", "const { colors: COLORS, isDark } = useTheme();\n  const { t } = useTranslation();\n  const [loading, setLoading]"],
  // STATUS_CONFIG labels
  ["{ key: 'Draft',    label: 'Borrador', color: '#FDBD00' },", "{ key: 'Draft',    label: () => t('statusDraft'),    color: '#FDBD00' },"],
  // Static texts
  ["No se pudieron cargar las estadísticas", "{t('noDataStats')}"],
  ["Propuestas totales", "{t('totalProposals')}"],
  ["Tasa de cierre", "{t('conversionRate')}"],
  ["Tasa de pérdida", "{t('lossRate')}"],
  ["DISTRIBUCIÓN POR ESTADO", "{t('distributionByStatus')}"],
  ["COMPARATIVA DE ESTADOS", "{t('statusComparison')}"],
  ["EMBUDO DE CIERRE", "{t('closingFunnel')}"],
  ["propuestas cerradas en total", "{t('totalClosed')}"],
  [">≡  Ver reporte detallado por período →<", ">{t('viewDetailedReport')}<"],
  ["Filtrar por asesor", "{t('filterByAgentDash')}"],
  // viewLabel
  ["viewMode === 'mine' ? `Mis datos · ${userName}`\n    : viewMode === 'all'  ? 'Toda la plataforma'\n    : `Asesor: ${selectedAgent?.name || ''}`",
   "viewMode === 'mine' ? `${t('myData')} · ${userName}`\n    : viewMode === 'all'  ? t('wholeplatform')\n    : `${t('agent')}: ${selectedAgent?.name || ''}`"],
  // viewSelector chips
  ["{ mode: 'mine',  label: 'Mis datos' },", "{ mode: 'mine',  label: t('myData') },"],
  ["{ mode: 'all',   label: 'Plataforma' },", "{ mode: 'all',   label: t('platform') },"],
  // Asesor chip
  ["{viewMode === 'agent' ? selectedAgent?.name : 'Asesor'}", "{viewMode === 'agent' ? selectedAgent?.name : t('agent')}"],
]);

// ── LoginScreen ──────────────────────────────────────────────────────────────
patch('src/screens/LoginScreen.js', [
  ["Cambiar cuenta", "{t('changeAccount')}"],
]);

// ── SettingsScreen ───────────────────────────────────────────────────────────
patch('src/screens/SettingsScreen.js', [
  [">PLANTILLAS DE MENSAJE<", ">{t('templatesSection')}<"],
]);

// ── ProposalsScreen ──────────────────────────────────────────────────────────
patch('src/screens/ProposalsScreen.js', [
  // Lead picker modal title
  ["Filtrar por lead", "{t('filterByAgentPickerTitle')}"],
  // Todos los leads option
  [">Todos los leads<", ">{t('filterAllLeads')}<"],
  // Send proposal title (already done via t() but let's confirm)
  // URL type label
  [">Tipo de URL<", ">{t('urlTypeLabel')}<"],
  // URL larga sin seguimiento
  ["URL larga · Sin seguimiento", "{t('urlTypeLong')}"],
  // Placeholders
  ["placeholder=\"Escribe el mensaje...\"", "placeholder={t('writeMessage')}"],
  ["placeholder=\"Asunto del correo...\"", "placeholder={t('emailSubjectPlaceholder')}"],
  // La URL se adjunta
  [">La URL se adjunta automáticamente al final<", ">{t('autoAttachUrl') || 'La URL se adjunta automáticamente al final'}<"],
  // Se compartirá
  ["Se compartirá el mensaje con el template y el enlace de la propuesta", "{t('shareTemplateHint')}"],
  // Cancelar in send modal (standalone — not the one wrapped in t())
  [">Cancelar<", ">{t('cancel')}<"],
  // El cliente vio...
  ["El cliente vio la propuesta hace menos de 1 hora. ¡Es el momento de contactar!", "{t('urgentFollowupDesc')}"],
  // Esta propuesta lleva...
  ["Esta propuesta lleva más de una semana sin ser vista. Recuérdale al lead.", "{t('noViewsFollowupDesc')}"],
  // Banners disabled
  ["Los banners están desactivados. Toca aquí para activar notificaciones en Ajustes", "{t('notifBannerDisabled')}"],
  // Notif empty hint
  ["Cuando un cliente abra una propuesta aparecerá aquí", "{t('notifEmptyHint')}"],
  // vio tu propuesta fallback
  ["|| 'vio tu propuesta'", "|| t('viewedProposal')"],
  // Toca un filtro fallback
  ["|| 'Toca un filtro activo para desactivarlo'", "|| 'Tap a filter to deactivate it'"],
]);

console.log('\nDone.');
