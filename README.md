# Prolibu V1 — App Móvil

App móvil Android/iOS para gestión de propuestas comerciales Prolibu. Construida con **React Native + Expo SDK 54**.

---

## Stack

| | |
|---|---|
| Framework | React Native + Expo SDK 54 |
| Navegación | React Navigation (Stack + BottomTabBar personalizado) |
| Distribución | EAS Build (APK Android / IPA iOS) |
| Tiempo real | Socket.IO en puerto 3001 |
| Persistencia local | AsyncStorage |
| Tema | React Context (claro/oscuro) |

---

## Navegación

```
Abrir app
  ├── Sin dominio guardado  → DomainScreen
  └── Con dominio
        ├── Sin sesión      → LoginScreen
        │                         └── (admin) → AgentsScreen → elige asesor
        └── Con sesión      → ProposalsScreen (tab principal)
                                  ├── [Tab] Dashboard   → DashboardScreen
                                  ├── [Tab] Reportes    → ReportsScreen
                                  ├── [Tab] Ajustes     → SettingsScreen
                                  ├── Tap en propuesta  → EditorScreen
                                  └── Botón (+)         → CreateProposalScreen
```

---

## Pantallas

### DomainScreen
- Ingreso del subdominio o dominio completo de la cuenta Prolibu
- Selector de plataforma: `.prolibu.com` / `.nodriza.io`
- Vista previa de URL en tiempo real
- Guarda el dominio en AsyncStorage y navega a LoginScreen

### LoginScreen
- Autenticación con email y contraseña
- Toggle para mostrar/ocultar contraseña (`Eye` / `EyeSlash`)
- Logo PNG dinámico que cambia según tema claro/oscuro
- Muestra el dominio activo en el footer
- Botón "Cambiar cuenta" para regresar al DomainScreen

### AgentsScreen *(modo admin)*
- Lista todos los asesores del equipo (`GET /publicservices/getAgents?roles[]=agent`)
- Búsqueda en tiempo real por nombre o email
- Auto-selecciona al usuario logueado si tiene rol de agente
- Avatar con inicial del nombre, resaltado en azul al seleccionar
- Botón continuar navega a ProposalsScreen pasando el asesor elegido

### ProposalsScreen *(tab principal)*
- Lista de propuestas en `SectionList` con filtros por estado (chips con contador)
- Panel de filtros avanzados (modal deslizable):
  - Por lead/cliente
  - Por actividad (visto hoy, esta semana, sin ver, etc.)
  - Por temperatura (Hot / Warm / Cold)
  - Por vistas (tiene vistas, sin vistas, muchas vistas)
  - Por rango de fechas (hoy, semana, mes, 3 meses, personalizado)
  - Ordenamiento (recientes, antiguas, creación, A-Z)
- Indicador en tiempo real cuando un cliente está viendo una propuesta (Socket.IO)
- Última vez vista por el cliente (hora y nombre)
- Badge de notificaciones con historial (panel deslizable)
- **CTA contextual por propuesta (condicional según teléfono del lead):**
  - 🔥 **Llamarlo ahora** — vista en la última hora + lead tiene teléfono
  - ✉ **Seguimiento por correo** — vista en la última hora + sin teléfono
  - 📞 **Sin vistas — Llamar ahora** — más de 7 días sin vistas + hay teléfono
  - ✉ **Sin vistas — Enviar correo** — más de 7 días sin vistas + sin teléfono
- Modal de envío por propuesta:
  - **WhatsApp** con plantilla personalizable + número pre-cargado del lead
  - **Email** con detección automática del cliente (Gmail / Outlook / mailto)
  - **Compartir** con menú nativo del SO
  - Selector de URL: corta con seguimiento o anónima sin seguimiento
- Pull-to-refresh con ProlibuLoader (sin spinner nativo)

### CreateProposalScreen
- Modo **Básico** (por defecto) y modo **Avanzado** (observaciones, fechas, pagos, referencia)
- Número de propuesta: 6 caracteres aleatorios `[A-Z0-9]`, editable
- Búsqueda de lead por email — lo crea automáticamente si no existe
- Selector de país con código telefónico (+57, +1, +52, etc.)
- Catálogo con tabs **Productos / Paquetes**, búsqueda en tiempo real
- Descuento por producto (%) y nota por producto (campo `comment`)
- Resumen financiero antes de confirmar (subtotal, descuento, impuestos, total)

### EditorScreen
- Carga completa de propuesta (`populate=all`)
- Selector de estado, moneda (con búsqueda), temperatura
- Gestión de productos: cantidad, descuento (% o $), subtotal con IVA
- Catálogo con tabs **Productos / Paquetes**
- Nota por producto (campo `comment`)
- Guardar: `PUT /proposal/:id` + cambio de estado si aplica
- Pantalla de éxito con URL copiable y botón compartir

### DashboardScreen
- KPIs calculados en cliente: total, conversión %, pérdida %, actividad 7/30 días
- Barra segmentada multicolor por estado
- Gráfica de distribución por estado
- Cards de temperatura (Caliente / Tibia / Fría)
- Montos: total, aprobado, pipeline
- Pull-to-refresh con ProlibuLoader overlay (sin spinner nativo)

### ReportsScreen
- Selector de rango: 3 meses / 6 meses / Este año / Año pasado / Personalizado
- Agrupación: Diario / Semanal / Mensual / Trimestral / Anual
- Métricas por período: Creadas, Aprobadas, Negadas, Lista, Borrador, $ Aprobado
- Totales acumulados del rango completo
- Generación con animación ProlibuLoader (delay 700ms)
- Sección de reportes del servidor (solo admin) — descarga Excel por email

### SettingsScreen
- Perfil del agente (nombre, email, dominio) — solo lectura
- **Toggle modo claro / oscuro** persistido en AsyncStorage
- **5 plantillas de mensajes editables** con contador de caracteres:

| Plantilla | Canal | Máx. caracteres |
|---|---|---|
| Urgente (vista reciente) | WhatsApp | 300 |
| Sin vistas (+7 días) | WhatsApp | 300 |
| Envío general | WhatsApp | 400 |
| Asunto | Email | 120 |
| Cuerpo | Email | 600 |

- Variables disponibles en plantillas: `{nombre}`, `{propuesta}`, `{url}`
- Botón restaurar predeterminados
- Cerrar sesión / Cambiar servidor

---

## Componentes

| Componente | Archivo | Descripción |
|---|---|---|
| `ProlibuLogoVertical` | `components/ProlibuLogo.js` | Logo PNG vertical — cambia según tema |
| `ProlibuLogoHorizontal` | `components/ProlibuLogo.js` | Logo PNG horizontal — cambia según tema |
| `ProlibuSpinner` | `components/ProlibuLoader.js` | 3 pelotas animadas (azul, amarillo, rojo) — inline |
| `ProlibuLoader` | `components/ProlibuLoader.js` | Overlay absoluteFillObject con ProlibuSpinner — zIndex 999 |
| `BottomTabBar` | `components/BottomTabBar.js` | Tab bar personalizado con 4 tabs y punto indicador |

---

## Tema claro / oscuro

Implementado con React Context (`ThemeContext.js`). Todas las pantallas usan `useTheme()`:

```js
const { colors: COLORS, isDark, toggleTheme } = useTheme();
const styles = makeStyles(COLORS); // estilos reactivos al tema
```

| Token | Claro | Oscuro |
|---|---|---|
| `bg` | `#FFFFFF` | `#000000` |
| `card` | `#F5F5F5` | `#0D0D0D` |
| `text` | `#111111` | `#FFFFFF` |
| `textMuted` | `#666666` | `#AAAAAA` |
| `border` | `#E5E5E5` | `#1F1F1F` |
| `accent` | `#4285F4` | `#4285F4` |
| `success` | `#39B54A` | `#39B54A` |
| `error` | `#D4145A` | `#D4145A` |
| `draft` | `#FDBD00` | `#FDBD00` |

Los logos cambian automáticamente entre versión blanca (modo claro) y negra (modo oscuro).

---

## Iconografía (Phosphor Icons)

Todos los iconos usan **[phosphor-react-native](https://github.com/duongdev/phosphor-react-native)** — SVG nativos con 6 pesos.

```jsx
import { Fire, Phone, Envelope } from 'phosphor-react-native';
<Fire size={20} color="#FF5722" weight="fill" />
```

| Pesos | Uso |
|---|---|
| `regular` | Estado inactivo (tabs, iconos sin foco) |
| `fill` | Estado activo, énfasis |
| `bold` | Checkmarks, confirmaciones |
| `light` / `thin` | Decorativos |
| `duotone` | Efectos de dos tonos con `duotoneColor` |

**Iconos por pantalla:**

| Pantalla | Icono | Componente |
|---|---|---|
| Bottom tabs | Propuestas | `SquaresFour` |
| Bottom tabs | Dashboard | `ChartBar` |
| Bottom tabs | Reportes | `Rows` |
| Bottom tabs | Ajustes | `GearSix` |
| Login | Ver/ocultar contraseña | `Eye` / `EyeSlash` |
| Agentes | Asesor seleccionado | `Check` |
| Agentes | Continuar | `ArrowRight` |
| Propuestas | Notificaciones | `Bell` / `BellRinging` |
| Propuestas | Filtros avanzados | `SlidersHorizontal` |
| Propuestas | CTA urgente | `Fire` |
| Propuestas | CTA teléfono | `Phone` |
| Propuestas | CTA correo | `Envelope` |
| Propuestas | Canal WhatsApp | `WhatsappLogo` |
| Propuestas | Canal compartir | `Export` |
| Dashboard | Temperatura caliente | `Fire` |
| Dashboard | Temperatura tibia | `Thermometer` |
| Dashboard | Temperatura fría | `Snowflake` |
| Dashboard | Recargar | `ArrowClockwise` |
| Editor / Crear | Volver | `ArrowLeft` |
| Editor / Crear | Cerrar modal | `X` |
| Editor / Crear | Ítem seleccionado | `Check` |
| Editor | Propuesta guardada | `CheckCircle` |

---

## Loader animado (ProlibuLoader)

Animación de 3 pelotas con colores de marca usando `Animated.loop` + `Easing.bezier(0.28, 0.84, 0.42, 1)`:

- **Azul** `#4285F4` — delay 0ms
- **Amarillo** `#FDBD00` — delay 400ms
- **Rojo** `#D4145A` — delay 800ms

Se usa como overlay (`absoluteFillObject`) para evitar que el layout se mueva durante la carga. El `RefreshControl` se configura con `refreshing={false}` y `tintColor="transparent"` para ocultar el spinner nativo del SO.

---

## Notificaciones en tiempo real

Socket.IO autenticado en `{dominio}:3001`:

```
App conecta → emite { accessToken }
             ← recibe authenticated { socketId }
             ← escucha canal socketId: { action: 'common.proposalView', data }
```

- Banner nativo del SO (iOS y Android) al recibir una vista
- Canal Android `prolibu` con prioridad HIGH
- Historial de hasta 50 notificaciones con persistencia en AsyncStorage
- Deduplicación de 30 segundos por propuesta
- Indicador en vivo (`liveViewing`) visible en las tarjetas por 60 segundos
- Reconexión automática (cada 3s, máx 10 intentos)

> Las notificaciones funcionan solo mientras la app está abierta (Socket.IO). Para notificaciones con app cerrada se requiere integración FCM/APNs en el backend de Prolibu.

---

## API

Base URL dinámica: `https://{subdominio}.prolibu.com/v1`

Todas las peticiones (excepto login) llevan header `Authorization: Bearer {token}`.

| Función | Método | Endpoint |
|---|---|---|
| `login` | POST | `/user/login` |
| `getAgents` | GET | `/publicservices/getAgents?roles[]=agent` |
| `getProposals` | GET | `/proposal?inCharge={id}&sort=updatedAt DESC&populate=all` |
| `getProposal` | GET | `/proposal/:id?populate=all` |
| `getProposalStats` | GET | `/proposal/calcStats?inCharge={id}` |
| `createProposal` | POST | `/proposal` |
| `saveProposal` | PUT | `/proposal/:id` |
| `changeProposalStatus` | PUT | `/proposal/changeStatus` |
| `getProducts` | GET | `/product?disabled=false&limit=1000` |
| `createProduct` | POST | `/product` |
| `getPackages` | GET | `/package?sort=updatedAt DESC&limit=200` |
| `getCurrencies` | GET | `/currency` |
| `searchCurrencies` | GET | `/currency?code={q}&limit=10` |
| `checkLeadByEmail` | GET | `/lead/exist?key=email&val={email}` |
| `searchLeadByEmail` | GET | `/lead?email={email}` |
| `createLead` | POST | `/lead` |
| `generateShortUrl` | POST | `/urlShort/generate` |
| `getReports` | GET | `/report?limit=50` |
| `runReport` | GET | `/report/:id/run` |
| `downloadReport` | GET | `/report/:id/download` |

---

## Estados de propuesta

| Valor API | Etiqueta | Color |
|---|---|---|
| `Draft` | Borrador | `#FDBD00` Amarillo Canario |
| `Ready` | Lista | `#39B54A` Verde Amazonia |
| `Approved` | Aprobada | `#4285F4` Azul Barú |
| `Denied` | Negada | `#D4145A` Rojo Crayola |

---

## Persistencia local (AsyncStorage)

| Clave | Contenido |
|---|---|
| `domain` | URL base del servidor (`https://sub.prolibu.com`) |
| `auth` | Token JWT + datos del usuario logueado |
| `dark_mode` | Preferencia de tema (`"true"` / `"false"`) |
| `prolibu_notifications` | Historial de notificaciones (JSON, máx 50) |
| `message_templates` | Plantillas de mensajes personalizadas (JSON) |

---

## Estructura de archivos

```
Appv1/
├── App.js                          # Entry point — ThemeProvider + NavigationContainer
├── app.json                        # Config Expo (nombre, ícono, splash, bundle IDs)
├── eas.json                        # Config EAS Build (preview APK/IPA, production)
├── kill-port.js                    # Libera puerto 8081 antes de arrancar
├── patch-ngrok.js                  # Parchea @expo/ngrok para ngrok v3
├── start-ngrok.js                  # ngrok v3 directo + Metro + QR
├── start-dev.js                    # Cloudflare Tunnel + Metro + QR
├── assets/
│   ├── icon.png                    # Ícono de la app (800x800)
│   ├── safe-white-logo-horizontal.png
│   ├── safe-white-logo-vertical.png
│   ├── safe-black-logo-horizontal.png
│   └── safe-black-logo-vertical.png
└── src/
    ├── api.js                      # Todas las llamadas a la API
    ├── theme.js                    # Paleta LIGHT estática (referencia)
    ├── ThemeContext.js             # Context claro/oscuro — useTheme()
    ├── useNotifications.js         # Hook Socket.IO + notificaciones locales
    ├── components/
    │   ├── ProlibuLogo.js          # Logos PNG dinámicos por tema (vertical + horizontal)
    │   ├── ProlibuLoader.js        # Spinner 3 pelotas + overlay fullscreen
    │   └── BottomTabBar.js         # Tab bar personalizado (4 tabs)
    └── screens/
        ├── DomainScreen.js         # Configurar servidor
        ├── LoginScreen.js          # Autenticación
        ├── AgentsScreen.js         # Selector de asesor (modo admin)
        ├── ProposalsScreen.js      # Lista propuestas + filtros + notificaciones
        ├── CreateProposalScreen.js # Crear propuesta nueva
        ├── EditorScreen.js         # Editar propuesta existente
        ├── DashboardScreen.js      # KPIs y estadísticas
        ├── ReportsScreen.js        # Reportes con rangos y períodos
        └── SettingsScreen.js       # Preferencias + plantillas de mensajes
```

---

## Desarrollo local

**Opción 1 — Misma red WiFi (más estable):**
```bash
npm install
npx expo start --go
```
Escanear el QR con **Expo Go** desde dentro de la app (teléfono y PC en el mismo WiFi).

**Opción 2 — Tunnel recomendado (cualquier red):**
```bash
npm run tunnel
```
Mata cualquier proceso Metro colgado, aplica parches ngrok v3 y arranca el tunnel con `EXPO_NO_REDIRECT_PAGE=1` para que el QR use `exp://` directamente (evita la página intermedia de ngrok).

> Importante: escanear el QR desde **dentro de Expo Go** (no con la cámara del sistema).

**Opción 3 — Cloudflare Tunnel (sin cuenta, sin instalación):**
```bash
npm run tunnel:cf
```
Usa `cloudflared` via npx. No requiere cuenta ni token. Genera URL `*.trycloudflare.com`.

**Opción 4 — ngrok v3 directo:**
```bash
npm run tunnel:ng
```
Inicia ngrok directamente (requiere ngrok v3 en PATH: `winget install ngrok.ngrok`), Metro y muestra QR con `exp://`.

---

## Scripts npm

| Script | Comando | Descripción |
|---|---|---|
| `npm start` | `expo start` | Metro sin tunnel |
| `npm run android` | `expo start --android` | Abre en emulador Android |
| `npm run ios` | `expo start --ios` | Abre en simulador iOS |
| `npm run tunnel` | `kill-port + expo start --tunnel --go` | **Tunnel recomendado para Expo Go** |
| `npm run tunnel:cf` | `node start-dev.js` | Cloudflare Tunnel alternativo |
| `npm run tunnel:ng` | `node start-ngrok.js` | ngrok v3 directo |

El `postinstall` aplica `patch-ngrok.js` automáticamente en cada `npm install`.

---

## Build nativo (EAS)

```bash
npm install -g eas-cli
eas login
eas init

# Android — APK instalable
eas build --platform android --profile preview

# iOS — IPA (instalar con Sideloadly + Apple ID gratuito, expira 7 días)
eas build --platform ios --profile preview
```

| | |
|---|---|
| Proyecto EAS | `@prolibujuan/prolibu-v1` |
| Package Android | `com.prolibu.v1` |
| Bundle ID iOS | `com.prolibu.v1` |
| Versión | `1.0.0` |
| Proyecto ID | `8485e9de-7a20-4641-8a90-f37185fc5389` |

> El ícono debe llamarse `icon.png` (minúsculas) — los servidores EAS de Linux son case-sensitive.

---

## Dependencias principales

| Paquete | Versión | Uso |
|---|---|---|
| `expo` | `~54.0.0` | Runtime base |
| `react-native` | `0.81.5` | UI nativa |
| `react` | `19.1.0` | Librería base |
| `@react-navigation/native-stack` | `^6.11.0` | Navegación |
| `@react-native-async-storage/async-storage` | `2.2.0` | Persistencia local |
| `react-native-safe-area-context` | `~5.6.0` | Áreas seguras |
| `react-native-screens` | `~4.16.0` | Optimización navegación |
| `expo-notifications` | `~0.32.16` | Banners locales iOS/Android |
| `expo-asset` | `~12.0.12` | Assets estáticos |
| `expo-constants` | `~18.0.13` | Constantes de entorno |
| `expo-dev-client` | `~6.0.20` | Builds de desarrollo personalizados |
| `socket.io-client` | `^4.5.4` | Tiempo real |
| `phosphor-react-native` | `^3.0.3` | Iconografía SVG (800+ iconos) |
| `react-native-svg` | `15.12.1` | Dependencia de Phosphor |
| `@expo/ngrok` | `^4.1.3` | Tunnel Expo (parcheado para v3) |
| `ngrok` | `^4.3.3` | Cliente ngrok v3 |
| `qrcode-terminal` | `^0.12.0` | QR en consola para scripts de tunnel |

**DevDependencies:**

| Paquete | Uso |
|---|---|
| `@babel/core` | Compilación JS |
| `babel-preset-expo` | Preset Babel para Expo |
| `cross-env` | Variables de entorno cross-platform en scripts npm |
