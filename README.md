# Prolibu V1 — Fanalca App

Aplicación móvil Android/iOS para que los agentes de Fanalca gestionen propuestas comerciales a través de la plataforma **Prolibu**. Construida con React Native + Expo SDK 54.

---

## Requisitos

- Node.js >= 18
- EAS CLI >= 12: `npm install -g eas-cli`
- Dispositivo físico con **Expo Go** o emulador Android/iOS

---

## Instalación y ejecución

```bash
npm install
npx expo start          # Metro Bundler — escanear QR con Expo Go
npx expo start --tunnel # Si no estás en la misma red local
```

> **Nota Android (Expo Go):** Los banners de notificación del OS no funcionan en Expo Go SDK 53+ en Android (limitación de Expo). Todo lo demás funciona. Para banners en Android se necesita un development build (ver sección Build).

---

## Estructura del proyecto

```
fanalca-app/
├── App.js                          # Punto de entrada — navegación (Stack) + bootstrap dominio/sesión
├── app.json                        # Config Expo (nombre, bundle ID, plugin expo-notifications)
├── eas.json                        # Config EAS Build (development / preview / production)
├── src/
│   ├── api.js                      # Todas las llamadas a la API de Prolibu (dominio dinámico)
│   ├── theme.js                    # Paleta de colores (Prolibu Brand Book v7)
│   ├── useNotifications.js         # Hook: Socket.IO en tiempo real + banners iOS
│   └── screens/
│       ├── DomainScreen.js         # Configuración inicial del dominio/cuenta
│       ├── LoginScreen.js          # Autenticación del agente
│       ├── AgentsScreen.js         # Selección de agente
│       ├── ProposalsScreen.js      # Lista de propuestas — pantalla principal
│       ├── EditorScreen.js         # Editor de propuesta (productos + estado)
│       └── CreateProposalScreen.js # Crear nueva propuesta
└── package.json
```

---

## Flujo de arranque

```
Abrir app
   |
   +-- ¿Hay dominio guardado?
   |       NO → DomainScreen  (configura subdominio + plataforma)
   |       SI → setApiDomain() → ¿Hay sesión guardada?
   |                                  NO → LoginScreen
   |                                  SI → ProposalsScreen
```

---

## Pantallas

### DomainScreen
- Primera vez (o al cambiar cuenta).
- Ingresa subdominio (ej. `fanalca`) y plataforma (`.prolibu.com` / `.nodriza.io`).
- También acepta dominio completo con punto (ej. `fanalca.prolibu.com`).
- Vista previa en tiempo real de la URL resultante.
- Guarda en AsyncStorage y llama `setApiDomain()`.

### LoginScreen
- Formulario usuario + contraseña.
- Muestra dominio activo en el footer.
- Botón **Cambiar cuenta** → limpia dominio + sesión → vuelve a DomainScreen.
- `POST /v1/user/login` con `accessToken` fijo de plataforma.
- Guarda JWT en AsyncStorage.

### AgentsScreen
- Lista agentes activos (`GET /v1/publicservices/getAgents?status=active&roles[]=agent`).
- Al seleccionar un agente navega a sus propuestas.

### ProposalsScreen _(pantalla principal)_

**Listado:**
- `GET /v1/proposal?inCharge={agentId}&limit=200&populate=all` con throttle de 20 s (evita saturar el backend).
- Pull-to-refresh (siempre forzado). Recarga al volver desde el editor.
- Secciones por estado: Lista / Borrador / Aprobada / Negada.

**Filtros y ordenamiento:**
- Chips de estado con contador por estado.
- Filtro por lead (picker con buscador, extraído de propuestas cargadas sin llamada extra al API).
- Filtro por actividad, temperatura (Caliente/Tibia/Fría), vistas, rango de fechas (hoy / semana / mes / 3 meses / personalizado).
- Ordenamiento: Recientes / Antiguas / Creación / A-Z.

**Tarjeta de propuesta:**
- Título, estado (con color), número, fecha, moneda/monto, temperatura, contador de vistas.
- Botón de llamada directa al lead.
- Botón **Enviar ↗** → modal de envío.

**Botones de seguimiento (urgencia):**
- 🔥 **Seguimiento urgente →** — aparece si la propuesta fue vista hace menos de 1 hora.
- 📞 **Sin vistas — Contactar →** — aparece si nunca fue vista y tiene más de 1 semana de creada.
- Ambos abren un drawer con WhatsApp y llamada directa.

**Modal de envío:**
- Canales: **WhatsApp**, **Correo**, **Compartir**.
- Tipo de URL:
  - **URL Cliente** — solo disponible para propuestas en estado `Lista`. Genera URL corta `/r/{uuid}` vía `POST /v1/urlShort/generate` con `?source=email@cliente.com`. Contabiliza vistas y dispara notificaciones socket al agente.
  - **URL Anónima** — disponible para todos los estados. URL larga con `?source=none&rand=N`. Sin seguimiento.
- La URL (corta o anónima) se inserta directamente en el cuerpo del mensaje — editable antes de enviar.
- Al cambiar de tipo de URL, el mensaje se actualiza automáticamente.

**WhatsApp:**
- Abre la app con plantilla pre-redactada y número del lead pre-cargado.
- Siempre envía la URL corta para propuestas `Lista`, larga para otras.

**Correo:**
- Detecta app instalada en el **dispositivo** (no el dominio del destinatario):
  1. Gmail app (`googlegmail://`) si está instalada.
  2. Outlook app (`ms-outlook://`) si está instalada.
  3. `mailto:` como fallback (app de correo predeterminada del OS).
- Incluye plantilla de asunto y cuerpo editables con URL incluida.

**Notificaciones en tiempo real (🔔):**
- Campanita con contador de no leídos.
- Socket.IO conectado a `{dominio}:3001`, autenticado con el JWT del agente.
- Escucha evento `common.proposalView` en el canal personal del usuario.
- En **iOS**: muestra banner del OS (como WhatsApp) cuando un cliente ve la propuesta.
- En **Android Expo Go**: solo campanita interna (limitación de Expo Go SDK 53+).
- Deduplicación: ignora eventos de la misma propuesta en menos de 30 s.
- Limpieza de listeners al reconectar (evita duplicados).
- Persiste en AsyncStorage (max 50 notificaciones).
- `liveViewing`: estado `{ [proposalId]: true }` activo 60 s tras cada vista en tiempo real.
- `lastViewed`: mapa `{ [proposalId]: { timestamp, leadName } }` calculado del historial persistido.

### CreateProposalScreen
- Número auto-generado (6 chars alfanumérico mayúsculas), editable.
- Título de la propuesta.
- Selector de moneda con buscador en tiempo real vía `GET /v1/currency/search`.
- Búsqueda de lead por email: `GET /v1/lead/exist` → fallback `GET /v1/lead?email=xxx`.
- Si el lead no existe: formulario de creación (nombre + apellido + celular con selector de código de país: CO/US/MX/AR/CL/PE/BR/VE/EC/ES).
- Catálogo de productos con buscador por nombre o SKU.
- Resumen de subtotal, descuento e impuestos antes de crear.
- Al confirmar: `POST /v1/lead` (si nuevo) → `POST /v1/proposal` → navega al editor.

### EditorScreen
- Carga propuesta completa (`GET /v1/proposal/{id}?populate=all`).
- Selector de estado (Borrador / Lista / Aprobada / Negada).
- Selector de moneda con buscador en tiempo real vía `GET /v1/currency/search`.
- Lista editable de productos: stepper de cantidad, descuento (% o $ — toggleable), subtotal por línea con IVA.
- Total general: Subtotal / Descuento / Impuestos / Total.
- Modal catálogo con buscador por nombre o SKU.
- **Producto personalizado:** si el producto no está en el catálogo se puede crear directamente desde la UI (`POST /v1/product`) y se agrega a la propuesta.
- Guardar: `PUT /v1/proposal/{id}` → `PUT /v1/proposal/changeStatus` (solo si cambió).
- Pantalla de éxito con URL de propuesta.

---

## API (`src/api.js`)

Dominio **dinámico** — configurado en DomainScreen con `setApiDomain(domain)`.

**Base URL:** `https://{subdominio}.{plataforma}/v1`
**Plataformas:** `.prolibu.com`, `.nodriza.io`

| Función | Método | Endpoint |
|---|---|---|
| `setApiDomain(domain)` | — | Configura BASE URL en runtime |
| `getApiBase()` | — | Retorna BASE URL activa |
| `login(user, pass)` | POST | `/v1/user/login` |
| `getAgents()` | GET | `/v1/publicservices/getAgents` |
| `getProposals(agentId, token)` | GET | `/v1/proposal` |
| `getProposal(id, token)` | GET | `/v1/proposal/{id}` |
| `saveProposal(id, body, token)` | PUT | `/v1/proposal/{id}` |
| `changeProposalStatus(id, status, token)` | PUT | `/v1/proposal/changeStatus` |
| `generateShortUrl(longUrl, userId, token)` | POST | `/v1/urlShort/generate` |
| `getCurrencies(token)` | GET | `/v1/currency` |
| `searchCurrencies(criteria, token)` | GET | `/v1/currency/search` |
| `getProducts(token)` | GET | `/v1/product?disabled=false&limit=1000` |
| `createProduct(data, token)` | POST | `/v1/product` |
| `checkLeadByEmail(email, token)` | GET | `/v1/lead/exist?key=email&val={email}` |
| `searchLeadByEmail(email, token)` | GET | `/v1/lead?email={email}` |
| `createLead(data, token)` | POST | `/v1/lead` |
| `createProposal(data, token)` | POST | `/v1/proposal` |

### URL corta (`/v1/urlShort/generate`)
```json
// Body
{ "url": "https://dominio/v1/document/proposal/{id}/full?source=email@cliente.com",
  "createdBy": "{userId}", "updatedBy": "{userId}" }

// Respuesta
{ "url": "https://dominio/r/AbCd3F" }
```
- Si la URL larga ya existe en la DB, reutiliza la URL corta existente (deduplicación en servidor).
- La URL corta `/r/{uuid}` redirige a la URL larga, registra la vista y dispara notificaciones socket al agente.

### Búsqueda de monedas (`/v1/currency/search`)
```
GET /v1/currency/search?criteria={texto}&limit=100&searchFields=code,name&selectedFields=code,name&sort=updatedAt DESC
```
- Usada en CreateProposalScreen y EditorScreen para el selector de moneda con buscador en tiempo real.

---

## useNotifications (`src/useNotifications.js`)

```
Token JWT disponible
   |
   +-- Conecta Socket.IO a {dominio}:3001
   +-- emit authenticate { accessToken: JWT }
   +-- server → authenticated { socketId }
   +-- Escucha canal socketId
   +-- Evento common.proposalView
         |
         +-- Deduplicar (< 30s misma propuesta) → ignorar
         +-- iOS: scheduleNotificationAsync → banner del OS
         +-- Actualiza estado interno + AsyncStorage
         +-- liveViewing[proposalId] = true  (se limpia tras 60s)
```

**Retorna:**

| Campo | Tipo | Descripción |
|---|---|---|
| `notifications` | Array | Historial (max 50), persistido en AsyncStorage |
| `unread` | Number | Contador de no leídas |
| `connected` | Boolean | Estado de conexión Socket.IO |
| `liveViewing` | Object | `{ [proposalId]: true }` — activo 60 s por cada vista |
| `lastViewed` | Object | `{ [proposalId]: { timestamp, leadName } }` del historial |
| `markAllRead()` | Function | Marca todas como leídas |
| `clearAll()` | Function | Limpia historial y AsyncStorage |

**Comportamiento por plataforma:**

| | iOS | Android Expo Go | Android dev build |
|---|---|---|---|
| Banner OS | ✅ | ❌ SDK 53+ | ✅ |
| Campanita interna | ✅ | ✅ | ✅ |
| Socket tiempo real | ✅ | ✅ | ✅ |

---

## Estados de propuesta

| API value | Etiqueta | Color |
|---|---|---|
| `Draft` | Borrador | Amarillo Canario `#FDBD00` |
| `Ready` | Lista | Verde Amazonia `#39B54A` |
| `Approved` | Aprobada | Azul Barú `#4285F4` |
| `Denied` | Negada | Rojo Crayola `#D4145A` |

---

## Identidad visual (Prolibu Brand Book v7)

| Token | Hex | Uso |
|---|---|---|
| `accent` / Azul Barú | `#4285F4` | Acción principal, botones, links |
| `draft` / Amarillo Canario | `#FDBD00` | Estado Borrador |
| `ready` / Verde Amazonia | `#39B54A` | Estado Lista, éxito |
| `denied` / Rojo Crayola | `#D4145A` | Estado Negada, errores |
| `bg` | `#FFFFFF` | Fondo general |
| `card` | `#F5F5F5` | Tarjetas y paneles |
| `text` | `#111111` | Texto principal |
| `textMuted` | `#666666` | Texto secundario |
| `border` | `#E5E5E5` | Bordes |

Logo: `OII>` — O en Azul Barú · II en Amarillo Canario · > en Rojo Crayola.

---

## Notas técnicas

- **Dominio dinámico:** `api.js` usa `let BASE` mutable. `setApiDomain()` actualiza globalmente todos los endpoints.
- **Throttle de carga:** `load()` en ProposalsScreen tiene un cooldown de 20 s para peticiones desde el listener de navegación. La carga inicial y el pull-to-refresh siempre se fuerzan.
- **URL corta:** generada en demanda al abrir el modal de envío vía `POST /v1/urlShort/generate`. El servidor deduplica — si la URL larga ya existe, devuelve la misma URL corta.
- **URL Cliente:** solo disponible para propuestas en estado `Lista`. Para otros estados, la UI desactiva el botón y usa URL anónima por defecto.
- **Email inteligente:** detecta app instalada en el dispositivo (no el dominio del destinatario) — prueba Gmail → Outlook → mailto.
- **Socket listener leak:** al reconectar, se quita el listener del canal anterior antes de registrar el nuevo (`socket.off(socketIdRef.current)`).
- **Deduplicación de notificaciones:** `lastNotifRef` almacena el timestamp por `proposalId`. Eventos del mismo proposal en < 30 s se descartan.
- **`shouldSetBadge: false`:** no acumula badge de app para evitar interferir con otras apps (WhatsApp, etc.).
- **Stale closure en focus listener:** usa `useRef` para capturar `auth` y `userId` sin valores obsoletos.
- **Descuento:** admite modo porcentaje (`discountRate`) o valor absoluto. La API siempre recibe `discountRate`.
- **Teléfono en leads:** se limpia de caracteres no numéricos antes de guardar.
- **`liveViewing`:** al recibir un evento `common.proposalView`, el `proposalId` se agrega a `liveViewing` por 60 s. ProposalsScreen puede usar esto para destacar tarjetas en tiempo real.
- **Producto personalizado en EditorScreen:** si el catálogo no tiene el producto deseado, se puede crear inline vía `POST /v1/product` y queda disponible en la propuesta.
- **Búsqueda de moneda:** usa `GET /v1/currency/search` con debounce en el input; si la API falla, el campo queda editable con el valor manual del agente.

---

## Build con EAS

### Development build (hot reload desde cualquier red)

```bash
# 1. Build del APK de desarrollo (solo una vez)
eas build --profile development --platform android

# 2. Instalar el APK en el dispositivo

# 3. Desde cualquier red, conectar via tunnel:
npx expo start --dev-client --tunnel
```

El APK de development se conecta al servidor Metro por internet (ngrok). Los cambios de JS se reflejan con hot reload sin recompilar el APK. Solo se necesita un nuevo APK si cambia código nativo.

### Preview / Producción

```bash
# APK de prueba (Android)
eas build --profile preview --platform android

# AAB para Google Play
eas build --profile production --platform android

# IPA para App Store
eas build --profile production --platform ios
```

Requiere cuenta en [expo.dev](https://expo.dev) y EAS CLI >= 12.

---

## Dependencias principales

| Paquete | Versión | Uso |
|---|---|---|
| `expo` | ~54.0.0 | Runtime base |
| `react` | 19.1.0 | UI declarativa |
| `react-native` | 0.81.5 | UI nativa |
| `expo-notifications` | ~0.29.0 | Banners locales iOS |
| `expo-dev-client` | ~6.0.20 | Development builds con hot reload |
| `expo-constants` | ~18.0.13 | Constantes de entorno |
| `expo-asset` | ~12.0.12 | Assets |
| `@react-navigation/native` | ^6.1.18 | Contenedor de navegación |
| `@react-navigation/native-stack` | ^6.11.0 | Navegación stack nativa |
| `@react-native-async-storage/async-storage` | 2.2.0 | Persistencia local |
| `react-native-safe-area-context` | ~5.6.0 | Áreas seguras |
| `react-native-screens` | ~4.16.0 | Optimización de pantallas |
| `socket.io-client` | ^4.5.4 | Notificaciones tiempo real (puerto 3001) |
