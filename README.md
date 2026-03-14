# Prolibu V1

Aplicación móvil Android/iOS para que los agentes gestionen propuestas comerciales a través de la plataforma **Prolibu**. Construida con React Native + Expo SDK 54.

---

## Requisitos

- Node.js >= 18
- [Expo CLI](https://docs.expo.dev/get-started/installation/) (`npm install -g expo-cli`)
- Dispositivo físico con **Expo Go** o build de desarrollo vía EAS

---

## Instalación y ejecución

```bash
npm install
npx expo start --tunnel    # escanear QR con Expo Go (sin notificaciones push)

# Con notificaciones push reales → build de desarrollo
npm install -g eas-cli
eas login
eas build --platform android --profile development   # genera APK instalable
```

---

## Estructura del proyecto

```
Appv1/
├── App.js                             # Punto de entrada — Stack Navigator + bootstrap
├── app.json                           # Config Expo (nombre: Prolibu V1, slug: prolibu-v1)
├── eas.json                           # Config EAS Build (development APK / preview APK / production AAB)
├── src/
│   ├── api.js                         # Todas las llamadas a la API (dominio dinámico)
│   ├── theme.js                       # Paleta de colores (Brand Book v7)
│   ├── useNotifications.js            # Hook de notificaciones en tiempo real (Socket.io + expo-notifications)
│   ├── components/
│   │   ├── ProlibuLogo.js             # Logo de marca (vertical para Login, horizontal para headers)
│   │   └── BottomTabBar.js            # Barra de navegación inferior (4 tabs principales)
│   └── screens/
│       ├── DomainScreen.js            # Configuración inicial del dominio/cuenta
│       ├── LoginScreen.js             # Autenticación del agente
│       ├── AgentsScreen.js            # Selección de agente (auxiliar)
│       ├── ProposalsScreen.js         # Lista de propuestas — tab principal
│       ├── EditorScreen.js            # Editor de propuesta (productos + estado)
│       ├── CreateProposalScreen.js    # Crear nueva propuesta (modo Básico / Avanzado)
│       ├── DashboardScreen.js         # KPIs animados y estadísticas del agente — tab Dashboard
│       ├── ReportsScreen.js           # Generador de reportes por períodos — tab Reportes
│       └── SettingsScreen.js          # Plantillas de mensajes y cuenta — tab Ajustes
└── package.json
```

---

## Flujo de navegación

```
Abrir app
   │
   ├─ Sin dominio configurado  → DomainScreen
   └─ Con dominio guardado     → setApiDomain()
         │
         ├─ Sin sesión  → LoginScreen
         └─ Con sesión  → ProposalsScreen (Tab principal)
                               │
                               ├── [Tab] Dashboard   → DashboardScreen
                               ├── [Tab] Reportes    → ReportsScreen
                               ├── [Tab] Ajustes     → SettingsScreen
                               │
                               ├── Tap en propuesta  → EditorScreen
                               └── FAB (+)           → CreateProposalScreen
```

---

## Navegación por tabs

La barra inferior (`BottomTabBar`) está presente en las 4 pantallas principales:

| Tab | Pantalla | Ícono |
|---|---|---|
| Propuestas | `ProposalsScreen` | ⊞ |
| Dashboard | `DashboardScreen` | ◉ |
| Reportes | `ReportsScreen` | ▤ |
| Ajustes | `SettingsScreen` | ⚙ |

---

## Pantallas

### DomainScreen
- Se muestra **solo la primera vez** (o al cambiar cuenta/servidor).
- El usuario ingresa el subdominio y selecciona la plataforma (`.prolibu.com` / `.nodriza.io`), o un dominio completo.
- Vista previa en tiempo real de la URL resultante.
- Guarda el dominio en AsyncStorage y llama a `setApiDomain()`.

### LoginScreen
- Logo vertical `ProlibuLogoVertical` con el símbolo de marca (círculo azul + barras amarillas + flecha roja).
- Formulario email + contraseña. Botón **"Cambiar cuenta"** limpia dominio y sesión.
- Llama a `POST /v1/user/login` y extrae el token JWT de: `data.token.accessToken` → `data.token` → `data.accessToken`.
- Guarda `{token, user, userId}` en AsyncStorage bajo la clave `auth`.

### AgentsScreen
- Lista agentes activos (`GET /v1/publicservices/getAgents?status=active&roles[]=agent`).
- Búsqueda en tiempo real. Auto-selecciona al usuario logueado.

### ProposalsScreen *(Tab Propuestas)*
- Lista `GET /v1/proposal?inCharge={agentId}&limit=200&sort=updatedAt:DESC&populate=all`.
- **Filtro por estado**: chips Todas / Borrador / Lista / Aprobada / Negada con contador.
- **Filtro avanzado**: por lead, actividad, temperatura, vistas, rango de fechas y ordenamiento.
- **Notificaciones en tiempo real**: badge 🔔 con contador; al abrir muestra historial de vistas.
- **Indicador "Viendo ahora"**: banner verde si el cliente está revisando la propuesta en ese momento.
- **Última vista**: banner gris con tiempo relativo (ej. "hace 3 horas") via Socket.io + campo API.
- Cada tarjeta muestra: título, estado, número, fecha, moneda, temperatura (Caliente/Tibia/Fría), contador de vistas.
- **Modal de envío** por propuesta:
  - **WhatsApp** — plantilla pre-redactada con número del lead pre-cargado.
  - **Email** — detecta dominio del lead → Gmail (`googlegmail://`) / Outlook (`ms-outlook://`) / fallback `mailto:`.
  - **Compartir** — hoja nativa del SO.
  - Selector de URL: Cliente (tracking `?source={email}`) o Anónima (`?source=none&rand={random}`).
  - URLs cortas via `POST /v1/urlShort/generate` para el canal cliente.
- **Seguimiento urgente** 🔥: aparece si la propuesta fue vista recientemente.
- **Sin vistas — Contactar** 📞: aparece si la propuesta lleva > 7 días sin vistas.
- Pull-to-refresh. FAB **(+)** para crear nueva propuesta.

### CreateProposalScreen
- **Modo Básico** (por defecto): número auto-generado, título, moneda, lead por email, catálogo de productos.
- **Modo Avanzado**: agrega observaciones especiales, fecha de vencimiento, fecha estimada de cierre, número de pagos, número de referencia.
- Número de propuesta: 6 caracteres aleatorios `[A-Z0-9]`, editable.
- Búsqueda de lead por email: `GET /v1/lead/exist` con fallback a `GET /v1/lead?email=…`.
- Si el lead no existe: formulario de creación con código de país (CO/US/MX/AR/CL/PE/BR/VE/EC/ES).
- Catálogo de productos con búsqueda por nombre o SKU. El SKU es el identificador al guardar.
- Resumen financiero (subtotal, descuento, impuestos, total) antes de confirmar.

### EditorScreen
- Carga propuesta completa (`GET /v1/proposal/{id}?populate=all`).
- Selector de estado (Borrador / Lista / Aprobada / Negada).
- Selector de moneda dinámico desde la API.
- Productos: stepper de cantidad, descuento (% o $ — toggleable), subtotal por línea con IVA.
- Catálogo con búsqueda por nombre o SKU. Producto personalizado (nombre + precio + cantidad).
- Guardar: `PUT /v1/proposal/{id}` + `PUT /v1/proposal/changeStatus` (solo si cambió). Error parcial alertado sin revertir productos.
- Pantalla de éxito con URL seleccionable/copiable.

### DashboardScreen *(Tab Dashboard)*
Estadísticas calculadas **localmente** desde las propuestas del agente (sin endpoints adicionales).

- **KPIs animados**: total de propuestas, tasa de conversión, tasa de pérdida, creadas en los últimos 30 días.
- **Barra segmentada multicolor**: distribución visual de estados (Borrador / Lista / Aprobada / Negada).
- **Gráfica de columnas**: actividad por estado con alturas proporcionales.
- **Cards de temperatura**: Caliente 🔥 / Tibia 🌡 / Fría ❄️ con porcentaje del total.
- **Embudo de cierre**: Aprobadas vs Negadas con progress bars y porcentajes.
- **Cartera**: montos total, aprobado y en negociación (se oculta si no hay montos registrados).
- Pull-to-refresh.

### ReportsScreen *(Tab Reportes)*
Generador de reportes **local** con desglose por períodos.

- **Selector de rango**: 3 meses / 6 meses / Este año / Año pasado / Personalizado (modal con inputs DD/MM/AAAA).
- **Selector de período**: Diario / Semanal / Mensual / Trimestral / Anual.
- Botón **▶ Generar reporte** — agrupa propuestas por período y calcula métricas.
- **Fila de totales**: Creadas, Aprobadas, Negadas, Conversión %.
- **Cards por período**: etiqueta, rango de fechas, barra de actividad relativa, stats (Creadas / Aprobadas / Negadas / Activas / $ Aprobado).
- **Sección admin** (visible solo si `user.role` contiene `admin/superadmin/super`): lista de reportes del servidor con botones Ejecutar y Excel.

### SettingsScreen *(Tab Ajustes)*
Personalización de plantillas de mensajes y gestión de cuenta.

- **Cuenta**: avatar, nombre, email, dominio activo. Botones "Cambiar servidor" y "Cerrar sesión".
- **Variables disponibles**: `{nombre}`, `{propuesta}`, `{url}` — se reemplazan en los mensajes al enviar.
- **5 plantillas editables** con contador de caracteres y límite:
  - Seguimiento urgente (WhatsApp, máx 300)
  - Sin vistas — Contactar (WhatsApp, máx 300)
  - Mensaje de envío WhatsApp (máx 400)
  - Asunto del email (máx 120)
  - Cuerpo del email (máx 600)
- Botón **Restaurar predeterminados**.
- Plantillas guardadas en AsyncStorage bajo la clave `message_templates`.

---

## Notificaciones en tiempo real (`useNotifications.js`)

- Conecta a un servidor de sockets privado (puerto 3001) con autenticación por token Bearer.
- Escucha el evento `proposal:view` y notifica cuando un cliente abre una propuesta.
- **iOS**: solicita permisos de notificación push (`expo-notifications`) y muestra banners nativos.
- **In-app**: historial de hasta 50 eventos con deduplicación en 30 segundos.
- Tracking en vivo: `liveViewing` indica qué propuestas se están viendo en el momento.
- `lastViewed` mapea el último timestamp de vista por propuesta (usado en las tarjetas).
- Hook exporta: `notifications`, `unread`, `liveViewing`, `lastViewed`, `markAllRead`, `clearAll`.

> **Nota**: en Expo Go las notificaciones push nativas no funcionan. Se requiere un development build (`eas build --profile development`).

---

## API (`src/api.js`)

Dominio base dinámico — se configura en `DomainScreen` con `setApiDomain(domain)`.

**URL por defecto (fallback):** `https://customer-design.prolibu.com/v1`

| Función | Método | Endpoint |
|---|---|---|
| `setApiDomain(domain)` | — | Configura BASE URL en runtime |
| `getApiBase()` | — | Retorna BASE URL activa |
| `login(user, pass)` | POST | `/v1/user/login` |
| `getAgents()` | GET | `/v1/publicservices/getAgents?status=active&roles[]=agent` |
| `getProposals(agentId, token)` | GET | `/v1/proposal?inCharge={id}&limit=200&sort=updatedAt:DESC&populate=all` |
| `getProposal(id, token)` | GET | `/v1/proposal/{id}?populate=all` |
| `saveProposal(id, body, token)` | PUT | `/v1/proposal/{id}` |
| `changeProposalStatus(id, status, token)` | PUT | `/v1/proposal/changeStatus` |
| `getCurrencies(token)` | GET | `/v1/currency` |
| `searchCurrencies(q, token)` | GET | `/v1/currency?code={q}&limit=10` |
| `getProducts(token)` | GET | `/v1/product?disabled=false&limit=1000` |
| `checkLeadByEmail(email, token)` | GET | `/v1/lead/exist?key=email&val={email}` |
| `searchLeadByEmail(email, token)` | GET | `/v1/lead?email={email}&limit=1` |
| `createLead(data, token)` | POST | `/v1/lead` |
| `createProposal(data, token)` | POST | `/v1/proposal` |
| `generateShortUrl(url, userId, token)` | POST | `/v1/urlShort/generate` |
| `getProposalStats(agentId, token)` | GET | `/v1/proposal/calcStats?inCharge={id}` |
| `getReports(token)` | GET | `/v1/report?limit=50&sort=createdAt DESC` |
| `runReport(id, token)` | GET | `/v1/report/{id}/run` |
| `downloadReport(id, token)` | GET | `/v1/report/{id}/download` |

---

## Estados de propuesta

| API value | Etiqueta | Color |
|---|---|---|
| `Draft` | Borrador | Amarillo Canario `#FDBD00` |
| `Ready` | Lista | Verde Amazonia `#39B54A` |
| `Approved` | Aprobada | Azul Barú `#4285F4` |
| `Denied` | Negada | Rojo Crayola `#D4145A` |

---

## Identidad visual (Brand Book v7)

Logo reconstruido como componente React Native puro en `src/components/ProlibuLogo.js`:
- **Círculo** — Azul Barú `#4285F4` (borde sin relleno)
- **Dos barras verticales** — Amarillo Canario `#FDBD00`
- **Flecha ›** — Rojo Crayola `#D4145A`
- `ProlibuLogoVertical` — símbolo centrado + "PROLIBU" debajo (Login)
- `ProlibuLogoHorizontal` — símbolo a la izquierda + "PROLIBU" a la derecha (headers)

| Token | Hex | Uso |
|---|---|---|
| `accent` / Azul Barú | `#4285F4` | Acción principal, botones, tabs activos |
| `draft` / Amarillo Canario | `#FDBD00` | Estado Borrador |
| `ready` / Verde Amazonia | `#39B54A` | Estado Lista, éxito |
| `error` / `denied` / Rojo Crayola | `#D4145A` | Estado Negada, errores |
| `bg` | `#FFFFFF` | Fondo general |
| `card` | `#F5F5F5` | Tarjetas y paneles |
| `text` | `#111111` | Texto principal |
| `textMuted` | `#666666` | Texto secundario |
| `border` | `#E5E5E5` | Bordes |

---

## Notas técnicas

- **Dominio dinámico:** `api.js` usa una variable `let BASE` mutable. `setApiDomain()` la actualiza globalmente.
- **Reportes y Dashboard locales:** calculados desde el array de propuestas ya cargado — sin endpoints adicionales.
- **Plantillas de mensaje:** guardadas en AsyncStorage clave `message_templates`. Variables `{nombre}`, `{propuesta}`, `{url}`.
- **SKU como identificador:** al guardar propuestas se usa el SKU del producto, no el `_id` de MongoDB.
- **URL corta:** `POST /v1/urlShort/generate` genera `/r/{uuid}` para el canal cliente (tracking activo).
- **Email inteligente:** detecta dominio del destinatario → Gmail / Outlook / `mailto:`.
- **Stale closure:** `ProposalsScreen` usa `useRef` para `auth` y `userId` en listeners de navegación.
- **Error parcial al guardar:** si `changeStatus` falla pero los productos se guardaron, alerta sin revertir.
- **Autenticación:** token de plataforma fijo = `56a69869-bf0a-4650-98e9-fcd9680b31d5`. JWT del usuario en AsyncStorage clave `auth`.

---

## Build con EAS

```bash
# APK de desarrollo con notificaciones push (Android)
eas build --platform android --profile development

# APK de prueba (Android)
eas build --platform android --profile preview

# AAB de producción (Google Play)
eas build --platform android --profile production

# iOS (requiere Apple Developer Account $99/año)
eas build --platform ios --profile development
```

Config (`app.json`): Package Android + Bundle ID iOS = `com.prolibu.v1` · Version `1.0.0`

---

## Dependencias principales

| Paquete | Versión | Uso |
|---|---|---|
| expo | ~54.0.0 | Runtime base |
| react | 19.1.0 | UI library |
| react-native | 0.81.5 | UI nativa |
| @react-navigation/native | ^6.1.18 | Navegación base |
| @react-navigation/native-stack | ^6.11.0 | Stack navigator |
| @react-native-async-storage/async-storage | 2.2.0 | Persistencia local |
| react-native-safe-area-context | ~5.6.0 | Áreas seguras + insets para tab bar |
| react-native-screens | ~4.16.0 | Optimización de pantallas |
| expo-notifications | ~0.29.0 | Notificaciones push nativas (iOS/Android) |
| expo-dev-client | ~6.0.20 | Development build con módulos nativos |
| socket.io-client | ^4.5.4 | Notificaciones en tiempo real |
| expo-asset | ~12.0.12 | Gestión de assets |
| expo-constants | ~18.0.13 | Constantes de entorno |
