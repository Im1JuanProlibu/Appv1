# Prolibu V1 — App Móvil

App móvil Android/iOS para gestión de propuestas comerciales de la plataforma **Prolibu**. Permite a asesores de ventas crear, editar y hacer seguimiento de propuestas en tiempo real — incluyendo alertas cuando un cliente abre una propuesta.

Construida con **React Native + Expo SDK 54**.

---

## Qué hace la app

- **Gestión de propuestas**: crear, editar, cambiar estado (Borrador / Lista / Aprobada / Negada), agregar productos/paquetes con descuentos e IVA
- **Seguimiento en tiempo real**: Socket.IO notifica al asesor en el instante que un cliente abre su propuesta (banner nativo + historial)
- **Dashboard de KPIs**: conversión, pérdida, pipeline, temperatura de leads
- **Reportes**: métricas por período con múltiples agrupaciones
- **CTA inteligente**: sugiere llamar o enviar correo/WhatsApp según comportamiento del lead
- **Multi-empresa**: cada empresa tiene su propio subdominio Prolibu (`empresa.prolibu.com`)
- **Modo claro/oscuro** con paleta de marca Prolibu

---

## Requisitos previos

Antes de instalar, asegúrate de tener:

| Herramienta | Versión mínima | Cómo instalar |
|---|---|---|
| **Node.js** | 18+ | [nodejs.org](https://nodejs.org) |
| **npm** | 9+ | Incluido con Node.js |
| **Git** | cualquiera | [git-scm.com](https://git-scm.com) |
| **Expo Go** (teléfono) | última versión | App Store / Google Play |
| **EAS CLI** *(solo para builds)* | última versión | `npm install -g eas-cli` |

> No se necesita Android Studio ni Xcode para desarrollo con Expo Go.

---

## Instalación

```bash
# 1. Clonar el repositorio
git clone https://github.com/Im1JuanProlibu/Appv1.git
cd Appv1

# 2. Instalar dependencias
#    (el postinstall aplica patch-ngrok.js automáticamente)
npm install

# 3. Arrancar en modo desarrollo (misma red WiFi)
npx expo start --go

# O con tunnel si estás en redes diferentes
npm run tunnel
```

Luego escanear el QR desde **dentro de Expo Go** (no con la cámara del sistema).

---

## Desarrollo local — opciones de tunnel

### Opción 1 — Misma red WiFi (más estable)
```bash
npx expo start --go
```
PC y teléfono deben estar en el mismo WiFi.

### Opción 2 — Tunnel recomendado (cualquier red) ✅
```bash
npm run tunnel
```
- Mata procesos Metro colgados en puerto 8081
- Aplica parche ngrok v3 automáticamente
- Arranca con `EXPO_NO_REDIRECT_PAGE=1` para que el QR use `exp://` directo (evita la página de advertencia de ngrok)

### Opción 3 — Cloudflare Tunnel (sin cuenta)
```bash
npm run tunnel:cf
```
Usa `cloudflared` vía npx. No requiere cuenta ni token. Genera URL `*.trycloudflare.com`.

### Opción 4 — ngrok v3 directo
```bash
npm run tunnel:ng
```
Requiere ngrok v3 instalado: `winget install ngrok.ngrok` (Windows) o `brew install ngrok` (Mac).

> **Importante:** siempre escanear el QR desde **dentro de Expo Go**, no con la cámara del sistema.

---

## Scripts npm

| Script | Descripción |
|---|---|
| `npm start` | Metro sin tunnel |
| `npm run android` | Abre en emulador Android |
| `npm run ios` | Abre en simulador iOS (solo Mac) |
| `npm run tunnel` | **Tunnel recomendado para Expo Go** |
| `npm run tunnel:cf` | Cloudflare Tunnel alternativo |
| `npm run tunnel:ng` | ngrok v3 directo |

El `postinstall` aplica `patch-ngrok.js` automáticamente en cada `npm install`.

---

## Build nativo (APK/IPA)

```bash
npm install -g eas-cli
eas login           # cuenta expo.dev
eas init            # solo la primera vez

# Android — APK instalable directamente
eas build --platform android --profile preview

# iOS — IPA (requiere cuenta Apple Developer $99/año para distribución)
eas build --platform ios --profile preview
```

| | |
|---|---|
| Proyecto EAS | `@prolibujuan/prolibu-v1` |
| Package Android | `com.prolibu.v1` |
| Bundle ID iOS | `com.prolibu.v1` |
| Versión | `1.0.1` |
| Proyecto ID EAS | `8485e9de-7a20-4641-8a90-f37185fc5389` |

> Para iOS sin cuenta de pago: usar **Expo Go** en desarrollo, o Sideloadly con Apple ID gratuito (el IPA caduca cada 7 días).

---

## Primer uso de la app

1. **Ingresar dominio**: escribe el subdominio de tu cuenta Prolibu (ej: `miempresa`) y selecciona la plataforma (`.prolibu.com` o `.nodriza.io`)
2. **Login**: email y contraseña del usuario en Prolibu
3. **Seleccionar asesor** *(solo admins)*: elegir el asesor a gestionar
4. Ya en la app: las propuestas cargan automáticamente y el socket se conecta para alertas en tiempo real

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

### ProposalsScreen *(tab principal)*
- Lista de propuestas en `SectionList` con chips de estado y contador
- **Panel de filtros avanzados** (modal deslizable):
  - **Lead**: dropdown colapsable con buscador — muestra el lead seleccionado, al tocar se despliega lista con scroll (sin abrir teclado automáticamente)
  - Por actividad: visto hoy, esta semana, sin ver, aprobada+vista, lista+vista
  - Por temperatura: Hot / Warm / Cold
  - Por vistas: con vistas, sin vistas, 5+ vistas
  - Por rango de fechas: hoy, semana, mes, 3 meses, personalizado (YYYY-MM-DD)
  - Ordenamiento: recientes, antiguas, por creación, A-Z
- Indicador en vivo cuando un cliente está viendo una propuesta (Socket.IO, dura 60s)
- Última vista: hora y nombre del lead en cada tarjeta
- Badge de notificaciones + panel historial (máx 50, persistido)
- **CTA contextual por propuesta** según comportamiento y teléfono del lead:
  - 🔥 **Llamarlo ahora** — vista en la última hora + tiene teléfono
  - ✉ **Seguimiento por correo** — vista en la última hora + sin teléfono
  - 📞 **Sin vistas — Llamar ahora** — +7 días sin vistas + tiene teléfono
  - ✉ **Sin vistas — Enviar correo** — +7 días sin vistas + sin teléfono
- **Modal de envío** por propuesta:
  - WhatsApp con plantilla personalizable + número pre-cargado del lead
  - Email con detección automática del cliente (Gmail / Outlook / mailto)
  - Compartir con menú nativo del SO
  - Selector URL: corta con seguimiento o anónima sin seguimiento
- Pull-to-refresh con ProlibuLoader (sin spinner nativo)

### CreateProposalScreen
- Modo **Básico** (por defecto) y **Avanzado** (observaciones, fechas, pagos, referencia)
- Número de propuesta: 6 caracteres aleatorios `[A-Z0-9]`, editable
- Búsqueda de lead por email — lo crea automáticamente si no existe
- Selector de país con código telefónico (+57, +1, +52, etc.)
- Catálogo con tabs **Productos / Paquetes**, búsqueda en tiempo real
- Descuento por producto (%) y nota por producto (campo `comment`)
- Resumen financiero antes de confirmar (subtotal, descuento, impuestos, total)

### EditorScreen
- Carga completa de propuesta (`populate=all`)
- Selector de estado con colores de marca
- **Campo "Razón de negación"**: aparece automáticamente al seleccionar estado `Negada`; se guarda en `PUT /proposal/denialReason`
- Selector de moneda con búsqueda en tiempo real
- Gestión de productos: cantidad, descuento (% o $), subtotal con IVA
- Catálogo con tabs **Productos / Paquetes**
- Nota por producto (campo `comment`)
- Guardar: `PUT /proposal/:id` → cambio de estado si aplica → razón de negación si aplica
- Pantalla de éxito con URL copiable y botón compartir

### DashboardScreen
- KPIs calculados en cliente: total, conversión %, pérdida %, actividad 7/30 días
- Barra segmentada multicolor por estado
- Gráfica de distribución por estado
- Cards de temperatura (Caliente / Tibia / Fría)
- Montos: total, aprobado, pipeline
- Pull-to-refresh con ProlibuLoader overlay

### ReportsScreen
- Selector de rango: 3 meses / 6 meses / Este año / Año pasado / Personalizado
- Agrupación: Diario / Semanal / Mensual / Trimestral / Anual
- Métricas por período: Creadas, Aprobadas, Negadas, Lista, Borrador, $ Aprobado
- Totales acumulados del rango completo
- Generación con animación ProlibuLoader (delay 700ms)
- Sección de reportes del servidor (solo admin) — descarga Excel por email

### SettingsScreen
- Perfil del agente (nombre, email, dominio) — solo lectura
- Toggle modo claro / oscuro persistido en AsyncStorage
- **5 plantillas de mensajes editables** con contador de caracteres:

| Plantilla | Canal | Máx. caracteres |
|---|---|---|
| Urgente (vista reciente) | WhatsApp | 300 |
| Sin vistas (+7 días) | WhatsApp | 300 |
| Envío general | WhatsApp | 400 |
| Asunto | Email | 120 |
| Cuerpo | Email | 600 |

- Variables disponibles: `{nombre}`, `{propuesta}`, `{url}`
- Botón restaurar predeterminados
- Cerrar sesión / Cambiar servidor

---

## Componentes

| Componente | Archivo | Descripción |
|---|---|---|
| `ProlibuLogoVertical` | `components/ProlibuLogo.js` | Logo PNG vertical — cambia según tema |
| `ProlibuLogoHorizontal` | `components/ProlibuLogo.js` | Logo PNG horizontal — cambia según tema |
| `ProlibuSpinner` | `components/ProlibuLoader.js` | 3 pelotas animadas (azul, amarillo, rojo) — inline |
| `ProlibuLoader` | `components/ProlibuLoader.js` | Overlay `absoluteFillObject` con ProlibuSpinner — zIndex 999 |
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

Los logos cambian automáticamente entre versión blanca (modo oscuro) y negra (modo claro).

---

## Estados de propuesta

| Valor API | Etiqueta | Color |
|---|---|---|
| `Draft` | Borrador | `#FDBD00` Amarillo Canario |
| `Ready` | Lista | `#4285F4` Azul Barú |
| `Approved` | Aprobada | `#39B54A` Verde Amazonia |
| `Denied` | Negada | `#D4145A` Rojo Crayola |

---

## Notificaciones en tiempo real

El hook `useNotifications(token)` en `src/useNotifications.js` conecta via Socket.IO al servidor Prolibu en el puerto 3001.

```
App conecta a {dominio}:3001
  → emite:  authenticate { accessToken }
  ← recibe: authenticated { socketId }
  ← escucha canal socketId: { action: 'common.proposalView', data }
```

- Banner nativo del SO (iOS y Android) al recibir una vista
- Canal Android `prolibu` con prioridad MAX, vibración y luces
- Historial de hasta 50 notificaciones persistido en AsyncStorage
- Deduplicación de 30 segundos por propuesta
- Indicador en vivo (`liveViewing`) visible en tarjetas por 60 segundos
- Reconexión automática sin límite de intentos
- Si los permisos de notificación están denegados: banner amarillo en el panel con link directo a Ajustes del sistema

> Las notificaciones funcionan solo mientras la app está abierta. Para notificaciones con app cerrada se requiere integración FCM/APNs en el backend de Prolibu.

---

## API

Base URL dinámica: `https://{subdominio}.prolibu.com/v1` (configurable en DomainScreen, guardado en AsyncStorage).

Todas las peticiones (excepto login) llevan header `Authorization: Bearer {token}`.

| Función en `api.js` | Método | Endpoint |
|---|---|---|
| `login` | POST | `/user/login` |
| `getAgents` | GET | `/publicservices/getAgents?roles[]=agent&status=active` |
| `getProposals` | GET | `/proposal?inCharge={id}&sort=updatedAt DESC&populate=all` |
| `getProposal` | GET | `/proposal/:id?populate=all` |
| `getProposalStats` | GET | `/proposal/calcStats?inCharge={id}` |
| `createProposal` | POST | `/proposal` |
| `saveProposal` | PUT | `/proposal/:id` |
| `changeProposalStatus` | PUT | `/proposal/changeStatus` |
| `saveDenialReason` | PUT | `/proposal/denialReason` |
| `getProducts` | GET | `/product?disabled=false&limit=1000` |
| `createProduct` | POST | `/product` |
| `getPackages` | GET | `/package?sort=updatedAt DESC&limit=200` |
| `getCurrencies` | GET | `/currency` |
| `searchCurrencies` | GET | `/currency/search?criteria={q}` |
| `checkLeadByEmail` | GET | `/lead/exist?key=email&val={email}` |
| `searchLeadByEmail` | GET | `/lead?email={email}` |
| `createLead` | POST | `/lead` |
| `generateShortUrl` | POST | `/urlShort/generate` |
| `getReports` | GET | `/report?limit=50` |
| `runReport` | GET | `/report/:id/run` |
| `downloadReport` | GET | `/report/:id/download` |

---

## Persistencia local (AsyncStorage)

| Clave | Contenido |
|---|---|
| `domain` | URL base del servidor (`https://sub.prolibu.com`) |
| `auth` | Token JWT + datos del usuario logueado (JSON) |
| `dark_mode` | Preferencia de tema (`"true"` / `"false"`) |
| `prolibu_notifications` | Historial de notificaciones (JSON, máx 50) |
| `message_templates` | Plantillas de mensajes personalizadas (JSON) |

---

## Estructura de archivos

```
Appv1/
├── App.js                          # Entry point — ThemeProvider + NavigationContainer
├── app.json                        # Config Expo (nombre, ícono, splash, bundle IDs, plugins)
├── eas.json                        # Config EAS Build (preview APK/IPA, production)
├── package.json                    # Dependencias y scripts npm
├── babel.config.js                 # Config Babel para Expo
├── kill-port.js                    # Libera puerto 8081 antes de arrancar Metro
├── patch-ngrok.js                  # Parchea @expo/ngrok para compatibilidad con ngrok v3
├── start-ngrok.js                  # ngrok v3 directo + Metro + QR en consola
├── start-dev.js                    # Cloudflare Tunnel + Metro + QR en consola
├── assets/
│   ├── icon.png                    # Ícono app (800×800, fondo negro)
│   ├── safe-white-logo-horizontal.png   # Logo blanco horizontal (modo claro)
│   ├── safe-white-logo-vertical.png     # Logo blanco vertical (modo claro)
│   ├── safe-black-logo-horizontal.png   # Logo negro horizontal (modo oscuro)
│   └── safe-black-logo-vertical.png     # Logo negro vertical (modo oscuro)
└── src/
    ├── api.js                      # Todas las llamadas a la API REST de Prolibu
    ├── theme.js                    # Paleta de colores LIGHT estática (referencia)
    ├── ThemeContext.js             # React Context claro/oscuro — exporta useTheme()
    ├── useNotifications.js         # Hook Socket.IO + notificaciones locales + historial
    ├── components/
    │   ├── ProlibuLogo.js          # Logos PNG dinámicos según tema (vertical + horizontal)
    │   ├── ProlibuLoader.js        # Spinner 3 pelotas de marca + overlay fullscreen
    │   └── BottomTabBar.js         # Tab bar personalizado con 4 tabs y punto indicador
    └── screens/
        ├── DomainScreen.js         # Configurar servidor (subdominio Prolibu)
        ├── LoginScreen.js          # Autenticación email + contraseña
        ├── AgentsScreen.js         # Selector de asesor (solo admins)
        ├── ProposalsScreen.js      # Lista propuestas + filtros + notificaciones + CTA
        ├── CreateProposalScreen.js # Crear propuesta nueva (básico/avanzado)
        ├── EditorScreen.js         # Editar propuesta + razón de negación
        ├── DashboardScreen.js      # KPIs y estadísticas de pipeline
        ├── ReportsScreen.js        # Reportes por período y agrupación
        └── SettingsScreen.js       # Preferencias + plantillas de mensajes
```

---

## Iconografía (Phosphor Icons)

Todos los iconos usan **[phosphor-react-native](https://github.com/duongdev/phosphor-react-native)** — SVG nativos con 6 pesos.

```jsx
import { Fire, Phone, Envelope } from 'phosphor-react-native';
<Fire size={20} color="#FF5722" weight="fill" />
```

Pesos usados: `regular` (inactivo), `fill` (activo/énfasis), `bold` (confirmaciones).

---

## Dependencias principales

| Paquete | Versión | Uso |
|---|---|---|
| `expo` | `~54.0.0` | Runtime base |
| `react-native` | `0.81.5` | UI nativa |
| `react` | `19.1.0` | Librería base |
| `@react-navigation/native-stack` | `^6.11.0` | Navegación entre pantallas |
| `@react-native-async-storage/async-storage` | `2.2.0` | Persistencia local |
| `react-native-safe-area-context` | `~5.6.0` | Áreas seguras (notch, home bar) |
| `react-native-screens` | `~4.16.0` | Optimización de navegación |
| `expo-notifications` | `~0.32.16` | Banners locales iOS/Android |
| `expo-asset` | `~12.0.12` | Assets estáticos (imágenes) |
| `expo-constants` | `~18.0.13` | Constantes de entorno |
| `expo-dev-client` | `~6.0.20` | Builds de desarrollo personalizados |
| `socket.io-client` | `^4.5.4` | Tiempo real (alertas de vista) |
| `phosphor-react-native` | `^3.0.3` | Iconografía SVG (800+ iconos) |
| `react-native-svg` | `15.12.1` | Dependencia de Phosphor |
| `@expo/ngrok` | `^4.1.3` | Tunnel Expo (parcheado para ngrok v3) |
| `ngrok` | `^4.3.3` | Cliente ngrok v3 |
| `qrcode-terminal` | `^0.12.0` | QR en consola para scripts de tunnel |

**DevDependencies:**

| Paquete | Uso |
|---|---|
| `@babel/core` | Compilación JS |
| `babel-preset-expo` | Preset Babel para Expo |
| `cross-env` | Variables de entorno cross-platform en scripts npm |

---

## Notas de desarrollo

- El ícono debe llamarse `icon.png` (minúsculas) — los servidores EAS de Linux son case-sensitive
- El archivo `sas` está en `.gitignore` — contiene datos de clientes reales
- `patch-ngrok.js` se ejecuta automáticamente en cada `npm install` vía `postinstall`
- El socket usa `transports: ['websocket', 'polling']` — websocket primero para mejor rendimiento
- En Android 13+ el permiso de notificaciones debe ser concedido explícitamente en el primer launch
