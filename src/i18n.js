import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// ─── Translation tables ───────────────────────────────────────────────────────

export const translations = {
  es: {
    // ── Common ──
    cancel: 'Cancelar',
    save: 'Guardar',
    saving: 'Guardando…',
    close: 'Cerrar',
    confirm: 'Confirmar',
    error: 'Error',
    ok: 'OK',
    loading: 'Cargando…',
    retry: 'Reintentar',
    share: 'Compartir',
    send: 'Enviar',
    edit: 'Editar',
    delete: 'Eliminar',
    logout: 'Cerrar sesión',
    darkMode: 'Modo oscuro',
    darkModeDesc: 'Cambia entre tema claro y oscuro',
    language: 'Idioma',
    languageDesc: 'Cambiar idioma de la aplicación',
    appearance: 'APARIENCIA',
    account: 'CUENTA',
    templates: 'PLANTILLAS DE MENSAJES',
    tapToEdit: 'Toca para editar',
    newProposal: '+ Nueva',
    loadMore: 'Cargar más',
    noProposals: 'No hay propuestas',
    noResults: 'Sin resultados para este filtro',

    // ── Login ──
    loginTitle: 'Inicia sesión',
    loginSubtitle: 'Accede a tu cuenta Prolibu',
    emailPlaceholder: 'Correo electrónico',
    passwordPlaceholder: 'Contraseña',
    loginBtn: 'Ingresar',
    loginLoading: 'Ingresando…',
    loginErrorTitle: 'Error al ingresar',
    loginErrorMsg: 'Credenciales incorrectas o sin conexión.',
    loginRequiredTitle: 'Campos requeridos',
    loginRequiredMsg: 'Ingresa tu email y contraseña.',
    domainLabel: 'Subdominio Prolibu',
    domainPlaceholder: 'empresa.prolibu.com',
    domainHelp: 'Ejemplo: miempresa.prolibu.com',

    // ── Proposals ──
    proposalsTitle: 'Propuestas',
    myProposals: 'Mis propuestas',
    platform: 'Plataforma',
    advancedFilters: 'Filtros avanzados',
    applyFilters: 'Aplicar filtros',
    clearFilters: 'Limpiar filtros',
    activeFilters: 'Filtros activos',
    sortBy: 'Ordenar por',
    filterByStatus: 'Estado',
    filterByActivity: 'Actividad',
    filterByRating: 'Temperatura',
    filterByViews: 'Vistas',
    filterByDate: 'Fecha',
    filterByAgent: 'Agente',

    // ── Status ──
    statusAll: 'Todas',
    statusDraft: 'Borrador',
    statusReady: 'Lista',
    statusApproved: 'Aprobada',
    statusDenied: 'Negada',

    // ── Temperature ──
    tempHot: 'Caliente',
    tempWarm: 'Tibia',
    tempCold: 'Fría',

    // ── Sort ──
    sortRecent: 'Recientes',
    sortOldest: 'Antiguas',
    sortCreation: 'Creación',
    sortAZ: 'A-Z',

    // ── Activity filters ──
    activityAll: 'Toda actividad',
    activityViewedToday: 'Vista hoy',
    activityViewedWeek: 'Esta semana',
    activityNotViewed: 'Sin vistas',
    activityApprovedViewed: 'Aprobada + vista',
    activityReadyViewed: 'Lista + vista',

    // ── Views filters ──
    viewsAll: 'Todas',
    viewsHasViews: 'Con vistas',
    viewsNoViews: 'Sin vistas',
    viewsManyViews: '+5 vistas',

    // ── Date filters ──
    dateAll: 'Cualquier fecha',
    dateToday: 'Hoy',
    dateWeek: 'Esta semana',
    dateMonth: 'Este mes',
    date3Months: 'Últimos 3 meses',
    dateCustom: 'Personalizado',
    dateFrom: 'Desde',
    dateTo: 'Hasta',

    // ── Card ──
    views: 'vistas',
    view: 'vista',
    live: 'En vivo',
    sendProposal: 'Enviar propuesta',
    noViewsCallNow: 'Sin vistas — Llamar ahora',
    noViewsSendEmail: 'Sin vistas — Enviar correo',
    urgentFollowup: 'Seguimiento urgente',
    followupByEmail: 'Seguimiento por correo',
    momentAgo: 'hace un momento',
    minutesAgo: 'hace {{n}} min',
    hoursAgo: 'hace {{n}} h',
    daysAgo: 'hace {{n}} día',
    daysAgoPlural: 'hace {{n}} días',
    untitled: 'Sin título',

    // ── Send modal ──
    sendViaWhatsApp: 'Enviar por WhatsApp',
    sendViaEmail: 'Enviar por Correo',
    sendViaShare: 'Compartir enlace',
    sendChannel: 'Canal',
    sendUrlType: 'Tipo de enlace',
    urlTypeClient: 'Enlace cliente',
    urlTypeClientDesc: 'URL corta para el cliente. Se registran las visitas.',
    urlTypeInternal: 'Enlace interno',
    urlTypeInternalDesc: 'URL completa sin tracking.',
    sendMessageLabel: 'Mensaje',
    sendSubjectLabel: 'Asunto',
    sendBodyLabel: 'Cuerpo',
    sendEditHint: 'Puedes editar el mensaje y la URL antes de enviar',
    sendBtn: 'Enviar ↗',
    sendCancelBtn: 'Cancelar',

    // ── Follow-up modal ──
    seguimientoTitle: 'Sin vistas — Llamar ahora',
    seguimientoConfirm: 'Marcar como contactado',
    seguimientoMessage: 'Mensaje para WhatsApp',

    // ── Dashboard ──
    dashboardTitle: 'Dashboard',
    totalProposals: 'Total',
    approved: 'Aprobadas',
    denied: 'Negadas',
    pipeline: 'Pipeline',
    conversionRate: 'Conversión',
    lossRate: 'Pérdidas',
    last7Days: 'Últimos 7 días',
    last30Days: 'Últimos 30 días',
    amountApproved: 'Ganado',
    amountPipeline: 'Pipeline',
    noData: 'Sin datos',
    agent: 'Agente',
    allAgents: 'Todos los agentes',
    selectPeriod: 'Período',
    refresh: 'Actualizar',

    // ── Reports ──
    reportsTitle: 'Reportes',
    reportPDF: 'Exportar PDF',
    reportExcel: 'Exportar Excel',

    // ── Agents ──
    agentsTitle: 'Agentes',

    // ── Settings ──
    settingsTitle: 'Ajustes',
    templatesTitle: 'Plantillas de mensajes',
    templateUrgent: 'Seguimiento urgente',
    templateUrgentDesc: "Aparece cuando el cliente vio la propuesta en la última hora. Se usa en el botón 'Seguimiento urgente'.",
    templateNoView: 'Sin vistas — Contactar',
    templateNoViewDesc: "Aparece cuando la propuesta lleva +7 días sin vistas. Se usa en el botón 'Sin vistas — Contactar'.",
    templateSend: 'Mensaje de envío (WhatsApp)',
    templateSendDesc: "Mensaje por defecto al presionar 'Enviar ↗' en una propuesta y elegir WhatsApp.",
    templateEmailSubject: 'Asunto del email',
    templateEmailSubjectDesc: "Asunto del correo al enviar una propuesta por email desde el botón 'Enviar ↗'.",
    templateEmailBody: 'Cuerpo del email',
    templateEmailBodyDesc: 'Cuerpo del correo al enviar una propuesta por email. La URL se agrega automáticamente al final.',
    templateVarsHint: 'Variables: {nombre}, {propuesta}, {url}',
    templatesSaved: 'Guardado',
    templatesSavedMsg: 'Las plantillas se guardaron correctamente.',
    templatesSaveError: 'No se pudieron guardar los cambios.',
    resetTitle: 'Restaurar plantillas',
    resetMsg: '¿Seguro que quieres restaurar todas las plantillas a su valor original?',
    resetBtn: 'Restaurar',
    logoutTitle: 'Cerrar sesión',
    logoutMsg: '¿Seguro que quieres cerrar sesión?',
    logoutBtn: 'Cerrar sesión',
    domainSection: 'DOMINIO',
    domainSaved: 'Dominio guardado',
    domainSavedMsg: 'El dominio se guardó correctamente.',

    // ── Notifications ──
    notificationsTitle: 'Notificaciones',
    noNotifications: 'Sin notificaciones',
    markAllRead: 'Marcar todo como leído',
    clearAll: 'Limpiar todo',
    statusChanged: 'cambió a',
  },

  en: {
    // ── Common ──
    cancel: 'Cancel',
    save: 'Save',
    saving: 'Saving…',
    close: 'Close',
    confirm: 'Confirm',
    error: 'Error',
    ok: 'OK',
    loading: 'Loading…',
    retry: 'Retry',
    share: 'Share',
    send: 'Send',
    edit: 'Edit',
    delete: 'Delete',
    logout: 'Log out',
    darkMode: 'Dark mode',
    darkModeDesc: 'Switch between light and dark theme',
    language: 'Language',
    languageDesc: 'Change application language',
    appearance: 'APPEARANCE',
    account: 'ACCOUNT',
    templates: 'MESSAGE TEMPLATES',
    tapToEdit: 'Tap to edit',
    newProposal: '+ New',
    loadMore: 'Load more',
    noProposals: 'No proposals',
    noResults: 'No results for this filter',

    // ── Login ──
    loginTitle: 'Sign in',
    loginSubtitle: 'Access your Prolibu account',
    emailPlaceholder: 'Email address',
    passwordPlaceholder: 'Password',
    loginBtn: 'Sign in',
    loginLoading: 'Signing in…',
    loginErrorTitle: 'Login error',
    loginErrorMsg: 'Incorrect credentials or no connection.',
    loginRequiredTitle: 'Required fields',
    loginRequiredMsg: 'Enter your email and password.',
    domainLabel: 'Prolibu subdomain',
    domainPlaceholder: 'company.prolibu.com',
    domainHelp: 'Example: mycompany.prolibu.com',

    // ── Proposals ──
    proposalsTitle: 'Proposals',
    myProposals: 'My proposals',
    platform: 'Platform',
    advancedFilters: 'Advanced filters',
    applyFilters: 'Apply filters',
    clearFilters: 'Clear filters',
    activeFilters: 'Active filters',
    sortBy: 'Sort by',
    filterByStatus: 'Status',
    filterByActivity: 'Activity',
    filterByRating: 'Temperature',
    filterByViews: 'Views',
    filterByDate: 'Date',
    filterByAgent: 'Agent',

    // ── Status ──
    statusAll: 'All',
    statusDraft: 'Draft',
    statusReady: 'Ready',
    statusApproved: 'Approved',
    statusDenied: 'Denied',

    // ── Temperature ──
    tempHot: 'Hot',
    tempWarm: 'Warm',
    tempCold: 'Cold',

    // ── Sort ──
    sortRecent: 'Recent',
    sortOldest: 'Oldest',
    sortCreation: 'Created',
    sortAZ: 'A-Z',

    // ── Activity filters ──
    activityAll: 'All activity',
    activityViewedToday: 'Viewed today',
    activityViewedWeek: 'This week',
    activityNotViewed: 'Not viewed',
    activityApprovedViewed: 'Approved + viewed',
    activityReadyViewed: 'Ready + viewed',

    // ── Views filters ──
    viewsAll: 'All',
    viewsHasViews: 'Has views',
    viewsNoViews: 'No views',
    viewsManyViews: '+5 views',

    // ── Date filters ──
    dateAll: 'Any date',
    dateToday: 'Today',
    dateWeek: 'This week',
    dateMonth: 'This month',
    date3Months: 'Last 3 months',
    dateCustom: 'Custom',
    dateFrom: 'From',
    dateTo: 'To',

    // ── Card ──
    views: 'views',
    view: 'view',
    live: 'Live',
    sendProposal: 'Send proposal',
    noViewsCallNow: 'No views — Call now',
    noViewsSendEmail: 'No views — Send email',
    urgentFollowup: 'Urgent follow-up',
    followupByEmail: 'Follow-up by email',
    momentAgo: 'just now',
    minutesAgo: '{{n}} min ago',
    hoursAgo: '{{n}} h ago',
    daysAgo: '{{n}} day ago',
    daysAgoPlural: '{{n}} days ago',
    untitled: 'Untitled',

    // ── Send modal ──
    sendViaWhatsApp: 'Send via WhatsApp',
    sendViaEmail: 'Send via Email',
    sendViaShare: 'Share link',
    sendChannel: 'Channel',
    sendUrlType: 'Link type',
    urlTypeClient: 'Client link',
    urlTypeClientDesc: 'Short URL for the client. Visits are tracked.',
    urlTypeInternal: 'Internal link',
    urlTypeInternalDesc: 'Full URL without tracking.',
    sendMessageLabel: 'Message',
    sendSubjectLabel: 'Subject',
    sendBodyLabel: 'Body',
    sendEditHint: 'You can edit the message and URL before sending',
    sendBtn: 'Send ↗',
    sendCancelBtn: 'Cancel',

    // ── Follow-up modal ──
    seguimientoTitle: 'No views — Call now',
    seguimientoConfirm: 'Mark as contacted',
    seguimientoMessage: 'WhatsApp message',

    // ── Dashboard ──
    dashboardTitle: 'Dashboard',
    totalProposals: 'Total',
    approved: 'Approved',
    denied: 'Denied',
    pipeline: 'Pipeline',
    conversionRate: 'Conversion',
    lossRate: 'Loss rate',
    last7Days: 'Last 7 days',
    last30Days: 'Last 30 days',
    amountApproved: 'Won',
    amountPipeline: 'Pipeline',
    noData: 'No data',
    agent: 'Agent',
    allAgents: 'All agents',
    selectPeriod: 'Period',
    refresh: 'Refresh',

    // ── Reports ──
    reportsTitle: 'Reports',
    reportPDF: 'Export PDF',
    reportExcel: 'Export Excel',

    // ── Agents ──
    agentsTitle: 'Agents',

    // ── Settings ──
    settingsTitle: 'Settings',
    templatesTitle: 'Message templates',
    templateUrgent: 'Urgent follow-up',
    templateUrgentDesc: "Appears when the client viewed the proposal in the last hour. Used in the 'Urgent follow-up' button.",
    templateNoView: 'No views — Contact',
    templateNoViewDesc: "Appears when the proposal has had no views for +7 days. Used in the 'No views — Contact' button.",
    templateSend: 'Send message (WhatsApp)',
    templateSendDesc: "Default message when pressing 'Send ↗' on a proposal and choosing WhatsApp.",
    templateEmailSubject: 'Email subject',
    templateEmailSubjectDesc: "Subject of the email when sending a proposal by email from the 'Send ↗' button.",
    templateEmailBody: 'Email body',
    templateEmailBodyDesc: 'Body of the email when sending a proposal by email. The URL is added automatically at the end.',
    templateVarsHint: 'Variables: {name}, {proposal}, {url}',
    templatesSaved: 'Saved',
    templatesSavedMsg: 'Templates saved successfully.',
    templatesSaveError: 'Could not save changes.',
    resetTitle: 'Reset templates',
    resetMsg: 'Are you sure you want to reset all templates to their default values?',
    resetBtn: 'Reset',
    logoutTitle: 'Log out',
    logoutMsg: 'Are you sure you want to log out?',
    logoutBtn: 'Log out',
    domainSection: 'DOMAIN',
    domainSaved: 'Domain saved',
    domainSavedMsg: 'Domain saved successfully.',

    // ── Notifications ──
    notificationsTitle: 'Notifications',
    noNotifications: 'No notifications',
    markAllRead: 'Mark all as read',
    clearAll: 'Clear all',
    statusChanged: 'changed to',
  },
};

// ─── Detect default language ──────────────────────────────────────────────────

function getDeviceLang() {
  // Simple default — user can change in Settings
  return 'es';
}

// ─── Context ──────────────────────────────────────────────────────────────────

const LANG_KEY = 'app_language';

const LanguageContext = createContext({
  lang: 'es',
  t: (key) => key,
  setLang: () => {},
});

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(getDeviceLang());

  useEffect(() => {
    AsyncStorage.getItem(LANG_KEY).then(stored => {
      if (stored === 'es' || stored === 'en') setLangState(stored);
    });
  }, []);

  const setLang = useCallback(async (newLang) => {
    setLangState(newLang);
    await AsyncStorage.setItem(LANG_KEY, newLang);
  }, []);

  const t = useCallback((key, vars) => {
    const str = translations[lang]?.[key] ?? translations.es?.[key] ?? key;
    if (!vars) return str;
    return Object.entries(vars).reduce((s, [k, v]) => s.replace(`{{${k}}}`, String(v)), str);
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, t, setLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  return useContext(LanguageContext);
}
