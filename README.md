# Fanalca App

Aplicación móvil Android para que los agentes de Fanalca gestionen propuestas comerciales a través de la plataforma **Prolibu**.

---

## Requisitos

- Node.js >= 18
- [Expo CLI](https://docs.expo.dev/get-started/installation/) (`npm install -g expo-cli`)
- Android Studio + emulador, o dispositivo físico con **Expo Go**

---

## Instalación y ejecución

```bash
cd fanalca-app
npm install
npm run android      # abre en emulador Android
# o
npm start            # abre el Metro Bundler (escanear QR con Expo Go)
```

---

## Estructura del proyecto

```
fanalca-app/
├── App.js                        # Punto de entrada — navegación (Stack)
├── src/
│   ├── api.js                    # Todas las llamadas a la API de Prolibu
│   ├── theme.js                  # Paleta de colores global
│   └── screens/
│       ├── LoginScreen.js        # Autenticación del agente
│       ├── AgentsScreen.js       # Selección de agente (admin)
│       ├── ProposalsScreen.js    # Lista de propuestas del agente
│       ├── EditorScreen.js       # Editor de propuesta (productos + estado)
│       └── CreateProposalScreen.js  # Crear nueva propuesta
└── package.json
```

---

## Pantallas

### LoginScreen
- Formulario de usuario y contraseña.
- Llama a `POST /v1/user/login` con `accessToken` fijo de plataforma.
- Guarda el token JWT en AsyncStorage para persistir sesión.

### AgentsScreen
- Lista los agentes activos (`GET /v1/publicservices/getAgents?status=active&roles[]=agent`).
- Al seleccionar un agente se navega a sus propuestas.

### ProposalsScreen
- Lista las propuestas del agente (`GET /v1/proposal?createdBy={agentId}&limit=200`).
- Agrupa por estado: **Borrador · Lista · Aprobada · Negada**.
- Se recarga automáticamente al volver desde el editor (listener `focus`).
- Pull-to-refresh disponible.
- Botón **FAB (+)** en esquina inferior derecha para crear nueva propuesta.

### CreateProposalScreen
- Número de propuesta: se genera automáticamente (6 chars alfanumérico mayúsculas), editable.
- Título de la propuesta.
- **Búsqueda de lead por email**: llama a `/lead/exist` primero; si no parsea un lead con ID válido, hace fallback a `GET /v1/lead?email=xxx`.
- Si el lead no existe: muestra formulario para crear uno nuevo (nombre + apellido).
- Al confirmar: crea el lead si es necesario (`POST /v1/lead`), luego crea la propuesta (`POST /v1/proposal`) y navega directamente al editor.

### EditorScreen
- Carga la propuesta completa (`GET /v1/proposal/{id}`).
- **Estado**: selector de 4 estados (Borrador / Lista / Aprobada / Negada). Solo llama a la API si el estado cambió respecto al cargado.
- **Productos**: lista editable con cantidad (stepper pill), descuento (modo % o valor $), subtotal por línea y total general con desglose (Subtotal / Descuento / Impuestos).
- **Agregar producto**: desde el catálogo de la plataforma o creando uno personalizado (nombre + precio + cantidad). Los productos custom envían `name` y `price` al servidor.
- **Guardar**: dos llamadas en secuencia:
  1. `PUT /v1/proposal/{id}` — actualiza la lista de productos.
  2. `PUT /v1/proposal/changeStatus` — cambia el estado (solo si cambió). Si la API rechaza el cambio de estado, los productos se guardan igual y se notifica al usuario.
- **Pantalla de éxito**: muestra la URL de la propuesta con botones para abrir en el navegador y compartir.

---

## API (`src/api.js`)

| Función | Método | Endpoint |
|---|---|---|
| `login(user, pass)` | POST | `/v1/user/login` |
| `getAgents()` | GET | `/v1/publicservices/getAgents` |
| `getProposals(agentId, token)` | GET | `/v1/proposal` |
| `getProposal(id, token)` | GET | `/v1/proposal/{id}` |
| `saveProposal(id, body, token)` | PUT | `/v1/proposal/{id}` |
| `changeProposalStatus(id, status, token)` | PUT | `/v1/proposal/changeStatus` |
| `getProducts(token)` | GET | `/v1/product?disabled=false` |
| `checkLeadByEmail(email, token)` | GET | `/v1/lead/exist?key=email&val={email}` |
| `searchLeadByEmail(email, token)` | GET | `/v1/lead?email={email}` |
| `createLead(data, token)` | POST | `/v1/lead` |
| `createProposal(data, token)` | POST | `/v1/proposal` |

**Dominio:** `customer-design.prolibu.com`

---

## Estados de propuesta

| API value | Etiqueta | Color |
|---|---|---|
| `Draft` | Borrador | Amarillo |
| `Ready` | Lista | Verde |
| `Approved` | Aprobada | Azul |
| `Denied` | Negada | Rojo |

---

## Notas técnicas

- **Identificador de producto en catálogo:** se usa el campo `sku` (no el `_id` de MongoDB). Si no hay SKU se cae a `id`/`_id`.
- **Productos personalizados:** generan un ID efímero `custom-{timestamp}-{random}`. Al guardar se envían `name` y `price` para que Prolibu los registre correctamente.
- **Descuento:** admite modo porcentaje (`discountRate` 0–100) o valor absoluto (se convierte internamente a tasa). El campo enviado a la API es siempre `discountRate`.
- **Moneda:** `proposal.currency` es un objeto `{code, name, format, id}`. Se usa `currency.code` para mostrar (ej: `COP`).
- **IVA/Impuestos:** `p.product.tax` = monto en $ (no porcentaje). `p.product.taxRate` = porcentaje para recalcular cuando el usuario edita.
- **Subtotal del servidor:** `p.subtotal` es el valor pre-calculado por Prolibu. Se usa mientras el usuario no edita cantidad/descuento (`_edited: false`). Al editar se recalcula localmente.
- **Cambio de estado:** solo se llama a `PUT /v1/proposal/changeStatus` si el estado difiere del cargado originalmente. Si la API rechaza la transición, los productos se guardan igual.
- **Búsqueda de lead:** doble estrategia — `/lead/exist` (rápido) con fallback a `GET /v1/lead?email=xxx` para encontrar leads recién creados.
- **URL de propuesta:** `https://customer-design.prolibu.com/v1/document/proposal/{mongoId}/full?source=none&rand={random}`
- **Stale closure en focus listener:** `ProposalsScreen` usa `useRef` para capturar `auth` y `userId` sin valores obsoletos en el closure del listener.

---

## Dependencias principales

| Paquete | Versión | Uso |
|---|---|---|
| expo | ~54.0.0 | Runtime base |
| react-native | 0.81.5 | UI nativa |
| @react-navigation/native-stack | ^6.11.0 | Navegación entre pantallas |
| @react-native-async-storage/async-storage | 2.2.0 | Persistencia local |
| react-native-safe-area-context | ~5.6.0 | Áreas seguras en Android |
