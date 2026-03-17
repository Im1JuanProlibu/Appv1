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

## Pantallas

```
Abrir app
  ├── Sin dominio guardado  → DomainScreen
  └── Con dominio
        ├── Sin sesión      → LoginScreen
        └── Con sesión      → ProposalsScreen (tab principal)
                                  ├── [Tab] Dashboard   → DashboardScreen
                                  ├── [Tab] Reportes    → ReportsScreen
                                  ├── [Tab] Ajustes     → SettingsScreen
                                  ├── Tap en propuesta  → EditorScreen
                                  └── Botón (+)         → CreateProposalScreen
```

### DomainScreen
- Ingreso del subdominio o dominio completo de la cuenta Prolibu
- Selector de plataforma: `.prolibu.com` / `.nodriza.io`
- Vista previa de URL en tiempo real

### LoginScreen
- Autenticación con email y contraseña
- **Toggle para mostrar/ocultar contraseña**
- Logo PNG dinámico (claro/oscuro)
- Botón "Cambiar cuenta" para regresar al DomainScreen

### ProposalsScreen *(tab principal)*
- Lista de propuestas del agente con filtros por estado (chips con contador)
- Panel de filtros avanzados: lead, actividad, temperatura, vistas, rango de fechas, ordenamiento
- Indicador en tiempo real cuando un cliente está viendo una propuesta (Socket.IO)
- Última vez vista por el cliente (hora y nombre)
- Badge de notificaciones con historial
- **CTA contextual por propuesta (condicional según teléfono del lead):**
  - 🔥 **Llamarlo ahora** — si fue vista en la última hora **y el lead tiene teléfono**
  - ✉ **Seguimiento por correo** — si fue vista en la última hora **pero el lead no tiene teléfono**
  - 📞 **Sin vistas — Llamar ahora** — si lleva más de 7 días sin vistas **y hay teléfono**
  - ✉ **Sin vistas — Enviar correo** — si lleva más de 7 días sin vistas **y no hay teléfono**
- Modal de envío por propuesta:
  - **WhatsApp** con plantilla personalizable + número pre-cargado del lead
  - **Email** con detección automática de cliente (Gmail / Outlook / mailto)
  - **Compartir** con menú nativo del SO
  - Selector de URL: corta con seguimiento o anónima sin seguimiento
- Pull-to-refresh con loader animado de marca (sin spinner nativo)

### CreateProposalScreen
- Modo **Básico** (por defecto) y modo **Avanzado** (observaciones, fechas, pagos, referencia)
- Número de propuesta: 6 caracteres aleatorios `[A-Z0-9]`, editable
- Búsqueda de lead por email con creación si no existe
- Catálogo con tabs **Productos / Paquetes**, búsqueda en tiempo real
- **Descuento por producto** (%) en el primer formulario
- **Nota por producto** (campo `comment` enviado en el payload)
- Resumen financiero antes de confirmar (subtotal, descuento, impuestos, total)

### EditorScreen
- Carga completa de propuesta (`populate=all`)
- Selector de estado, moneda, temperatura
- Gestión de productos: cantidad, descuento (% o $), subtotal con IVA
- Catálogo con tabs **Productos / Paquetes**
- **Nota por producto** (campo `comment`)
- Guardar: `PUT /proposal/:id` + cambio de estado si aplica
- Pantalla de éxito con URL copiable

### DashboardScreen
- KPIs: total, conversión, pérdida, actividad 7/30 días
- Barra segmentada multicolor por estado
- Gráfica de columnas por estado
- Cards de temperatura (Caliente / Tibia / Fría)
- Embudo de cierre (Aprobadas vs Negadas)
- Montos: total, aprobado, pipeline
- Pull-to-refresh con ProlibuLoader overlay (sin spinner nativo)
- Delay mínimo de 600ms para que la animación siempre sea visible

### ReportsScreen
- Selector de rango: 3 meses / 6 meses / Este año / Año pasado / Personalizado
- Agrupación: Diario / Semanal / Mensual / Trimestral / Anual
- Métricas por período: Creadas, Aprobadas, Negadas, Lista, Borrador, $ Aprobado
- Totales acumulados del rango completo
- Generación con animación ProlibuLoader (delay 700ms)
- Sección de reportes del servidor (solo admin)

### SettingsScreen
- Perfil del agente (nombre, email, dominio)
- **5 plantillas editables** con contador de caracteres:
  - Llamarlo ahora (WhatsApp, máx 300)
  - Sin vistas — Llamar ahora (WhatsApp, máx 300)
  - Envío WhatsApp (máx 400)
  - Asunto email (máx 120)
  - Cuerpo email (máx 600)
- Variables disponibles: `{nombre}`, `{propuesta}`, `{url}`
- **Toggle modo claro / oscuro** persistido en AsyncStorage
- Botón restaurar predeterminados
- Cerrar sesión / Cambiar servidor

---

## Componentes

| Componente | Descripción |
|---|---|
| `ProlibuLogoVertical` | Logo PNG para Login y Domain — cambia según tema claro/oscuro |
| `ProlibuLogoHorizontal` | Logo PNG para headers de tabs — cambia según tema |
| `ProlibuSpinner` | 3 pelotas animadas (azul, amarillo, rojo) — inline |
| `ProlibuLoader` | Overlay absoluteFillObject con ProlibuSpinner — zIndex 999 |
| `BottomTabBar` | Tab bar personalizado con 4 tabs y punto indicador |
| `FilterPanel` | Panel de filtros avanzados (modal deslizable) |

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

Los logos cambian automáticamente entre versión blanca (modo claro) y negra (modo oscuro).

---

## Loader animado (ProlibuLoader)

Animación de 3 pelotas con colores de marca usando `Animated.loop` + `Easing.bezier(0.28, 0.84, 0.42, 1)`:

- **Azul** `#4285F4` — delay 0ms
- **Amarillo** `#FDBD00` — delay 400ms
- **Rojo** `#D4145A` — delay 800ms

Se usa como overlay (`absoluteFillObject`) para evitar que el tab bar o el layout se muevan durante la carga. El `RefreshControl` se configura con `refreshing={false}` y `tintColor="transparent"` para ocultar el spinner nativo del SO.

---

## Notificaciones en tiempo real

Socket.IO autenticado en `{dominio}:3001`:

```
App conecta → emite { accessToken }
             ← recibe { socketId }
             ← escucha canal socketId: { action: 'common.proposalView', data }
```

- Banner nativo del SO (iOS y Android) al recibir una vista
- Canal Android `prolibu` con prioridad HIGH
- Historial de hasta 50 notificaciones con persistencia
- Deduplicación de 30 segundos por propuesta
- Indicador en vivo (`liveViewing`) visible en las tarjetas de propuesta

> Las notificaciones funcionan solo mientras la app está abierta (Socket.IO). Para notificaciones con app cerrada se requiere integración FCM/APNs en el backend de Prolibu.

---

## API

Base URL dinámica: `https://{subdominio}.prolibu.com/v1`

| Función | Método | Endpoint |
|---|---|---|
| `login` | POST | `/user/login` |
| `getProposals` | GET | `/proposal?inCharge={id}&limit=200&populate=all` |
| `getProposal` | GET | `/proposal/:id?populate=all` |
| `createProposal` | POST | `/proposal` |
| `saveProposal` | PUT | `/proposal/:id` |
| `changeProposalStatus` | PUT | `/proposal/changeStatus` |
| `getProducts` | GET | `/product?disabled=false&limit=1000` |
| `getPackages` | GET | `/package?sort=updatedAt DESC&limit=200` |
| `getCurrencies` | GET | `/currency` |
| `searchCurrencies` | GET | `/currency?code={q}&limit=10` |
| `checkLeadByEmail` | GET | `/lead/exist?key=email&val={email}` |
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

## Estructura de archivos

```
Appv1/
├── App.js                          # Entry point — ThemeProvider + NavigationContainer
├── app.json                        # Config Expo (nombre, ícono, splash, bundle IDs)
├── eas.json                        # Config EAS Build (preview APK/IPA, production)
├── assets/
│   ├── icon.png                    # Ícono de la app (800x800)
│   ├── safe-white-logo-horizontal.png
│   ├── safe-white-logo-vertical.png
│   ├── safe-black-logo-horizontal.png  # Logo para modo oscuro
│   └── safe-black-logo-vertical.png    # Logo para modo oscuro
└── src/
    ├── api.js                      # Todas las llamadas a la API
    ├── theme.js                    # Paleta LIGHT estática (referencia)
    ├── ThemeContext.js             # Context claro/oscuro — useTheme()
    ├── useNotifications.js         # Hook Socket.IO + notificaciones locales
    ├── components/
    │   ├── ProlibuLogo.js          # Logos PNG dinámicos por tema
    │   ├── ProlibuLoader.js        # Spinner animado 3 pelotas + overlay
    │   ├── BottomTabBar.js         # Tab bar personalizado
    │   └── FilterPanel.js          # Panel filtros avanzados
    └── screens/
        ├── DomainScreen.js
        ├── LoginScreen.js
        ├── ProposalsScreen.js
        ├── CreateProposalScreen.js
        ├── EditorScreen.js
        ├── DashboardScreen.js
        ├── ReportsScreen.js
        └── SettingsScreen.js
```

---

## Desarrollo local

**Opción recomendada — misma red WiFi (más estable):**
```bash
npm install
npx expo start --go
```
Escanear el QR con **Expo Go** en el dispositivo (teléfono y PC en el mismo WiFi).

**Con tunnel (si el teléfono está en otra red):**
```bash
npx expo start --tunnel --go
```
> Requiere `@expo/ngrok` instalado. Si hay errores de ngrok (`session closed`, `remote gone away`), es un problema de disponibilidad del servicio. Usar la opción LAN es más confiable.

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

**Proyecto EAS:** `@prolibujuan/prolibu-v1`
**Package Android:** `com.prolibu.v1`
**Bundle ID iOS:** `com.prolibu.v1`
**Versión:** `1.0.0`

> El ícono debe llamarse `icon.png` (minúsculas) — los servidores EAS de Linux son case-sensitive.

---

## Dependencias principales

| Paquete | Uso |
|---|---|
| `expo ~54.0.0` | Runtime base |
| `react-native 0.81.5` | UI nativa |
| `@react-navigation/native-stack` | Navegación |
| `@react-native-async-storage/async-storage` | Persistencia local |
| `react-native-safe-area-context` | Áreas seguras |
| `expo-notifications ~0.29.0` | Banners locales iOS/Android |
| `socket.io-client ^4.5.4` | Tiempo real |
| `expo-asset` | Assets estáticos |
| `@expo/ngrok ^4.1.0` | Tunnel para desarrollo (opcional) |
