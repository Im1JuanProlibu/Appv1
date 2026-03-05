# Prolibu App

Aplicación móvil Android/iOS para que los agentes gestionen propuestas comerciales a través de la plataforma **Prolibu**. Construida con React Native + Expo SDK 54.

---

## Requisitos

- Node.js >= 18
- [Expo CLI](https://docs.expo.dev/get-started/installation/) (`npm install -g expo-cli`)
- Android Studio + emulador, o dispositivo físico con **Expo Go**

---

## Instalación y ejecución

```bash
cd Appv1
npm install
npm run android      # abre en emulador Android
# o
npm start            # Metro Bundler (escanear QR con Expo Go)
```

---

## Estructura del proyecto

```
Appv1/
├── App.js                          # Punto de entrada — navegación (Stack) + bootstrap de dominio/sesión
├── src/
│   ├── api.js                      # Llamadas a la API de Prolibu (dominio dinámico)
│   ├── theme.js                    # Paleta de colores (Prolibu Brand Book v7)
│   └── screens/
│       ├── DomainScreen.js         # Configuración inicial del dominio/cuenta
│       ├── LoginScreen.js          # Autenticación del agente
│       ├── AgentsScreen.js         # Selección de agente (solo si el login es admin)
│       ├── ProposalsScreen.js      # Lista de propuestas del agente
│       ├── EditorScreen.js         # Editor de propuesta (productos + estado)
│       └── CreateProposalScreen.js # Crear nueva propuesta
└── package.json
```

---

## Flujo de arranque

```
Abrir app
   │
   ├─ ¿Hay dominio guardado?
   │       NO → DomainScreen  (configura subdominio + plataforma)
   │       SÍ → setApiDomain() → ¿Hay sesión guardada?
   │                                   NO → LoginScreen
   │                                   SÍ → ProposalsScreen
```

---

## Pantallas

### DomainScreen
- Se muestra **solo la primera vez** (o al hacer "Cambiar cuenta").
- El usuario ingresa el subdominio de su cuenta (ej. `mi-empresa`) y selecciona la plataforma (`.prolibu.com` / `.nodriza.io`).
- También acepta un dominio completo con punto (ej. `mi-empresa.prolibu.com`).
- Vista previa en tiempo real de la URL resultante.
- Guarda el dominio en AsyncStorage y llama a `setApiDomain()` para configurar todos los endpoints dinámicamente.

### LoginScreen
- Formulario de usuario y contraseña.
- Muestra el dominio activo en el footer.
- Botón **"Cambiar cuenta"** que limpia dominio + sesión y vuelve a `DomainScreen`.
- Llama a `POST /v1/user/login` con el `accessToken` fijo de plataforma.
- Guarda el token JWT en AsyncStorage para persistir la sesión.

### AgentsScreen
- Lista los agentes activos (`GET /v1/publicservices/getAgents?status=active&roles[]=agent`).
- Al seleccionar un agente, navega a sus propuestas.

### ProposalsScreen
- Lista las propuestas del agente (`GET /v1/proposal?inCharge={agentId}&limit=200&populate=all`).
- **Filtro por estado**: chips Todas / Borrador / Lista / Aprobada / Negada.
- **Filtro por lead**: chip ◈ Lead que abre un picker con buscador y lista de leads únicos con conteo de propuestas.
- **Ordenamiento**: por fecha o por valor de propuesta.
- Pull-to-refresh y recarga automática al volver desde el editor.
- FAB **(+)** para crear nueva propuesta.
- **Modal de envío** por propuesta con selector de canal:
  - **◉ WhatsApp** — abre la app con plantilla pre-redactada (URL personalizada o de visualización).
  - **✉ Correo** — detecta el dominio del lead: Gmail → app Gmail nativa, Outlook/Hotmail/Live → app Outlook nativa, resto → `mailto:`. Incluye plantilla de asunto y cuerpo editable.
  - **↑ Compartir** — hoja nativa de compartir del sistema operativo.

### CreateProposalScreen
- Número de propuesta auto-generado (6 chars alfanumérico mayúsculas), editable.
- Título de la propuesta.
- **Búsqueda de lead por email**: llama a `/lead/exist`; si no resuelve un ID válido, hace fallback a `GET /v1/lead?email=xxx`.
- Si el lead no existe: formulario para crear uno nuevo (nombre + apellido).
- Al confirmar: crea el lead si es necesario (`POST /v1/lead`), crea la propuesta (`POST /v1/proposal`) y navega al editor.
- Selector de moneda (`GET /v1/currency`).
- Catálogo de productos desde la API (`GET /v1/product?disabled=false&limit=1000`).

### EditorScreen
- Carga la propuesta completa (`GET /v1/proposal/{id}?populate=all`).
- **Estado**: selector de 4 estados (Borrador / Lista / Aprobada / Negada).
- **Productos**: lista editable con stepper de cantidad, descuento (% o $), subtotal por línea y total general (Subtotal / Descuento / Impuestos).
- **Catálogo**: modal con buscador (sin auto-foco), conteo de productos cargados, y lista filtrable por nombre o SKU.
- **Producto personalizado**: nombre + precio + cantidad.
- **Guardar**:
  1. `PUT /v1/proposal/{id}` — actualiza productos.
  2. `PUT /v1/proposal/changeStatus` — cambia estado (solo si cambió).
- **Pantalla de éxito**: URL de propuesta con botones para abrir en navegador y compartir.

---

## API (`src/api.js`)

El dominio base es **dinámico** — se configura en `DomainScreen` y se aplica con `setApiDomain(domain)`.

**Formato:** `https://{subdominio}.{plataforma}/v1`
**Plataformas soportadas:** `.prolibu.com`, `.nodriza.io`

| Función | Método | Endpoint |
|---|---|---|
| `setApiDomain(domain)` | — | Configura la BASE URL en runtime |
| `getApiBase()` | — | Retorna la BASE URL activa |
| `login(user, pass)` | POST | `/v1/user/login` |
| `getAgents()` | GET | `/v1/publicservices/getAgents` |
| `getProposals(agentId, token)` | GET | `/v1/proposal` |
| `getProposal(id, token)` | GET | `/v1/proposal/{id}` |
| `saveProposal(id, body, token)` | PUT | `/v1/proposal/{id}` |
| `changeProposalStatus(id, status, token)` | PUT | `/v1/proposal/changeStatus` |
| `getCurrencies(token)` | GET | `/v1/currency` |
| `getProducts(token)` | GET | `/v1/product?disabled=false&limit=1000` |
| `checkLeadByEmail(email, token)` | GET | `/v1/lead/exist?key=email&val={email}` |
| `searchLeadByEmail(email, token)` | GET | `/v1/lead?email={email}` |
| `createLead(data, token)` | POST | `/v1/lead` |
| `createProposal(data, token)` | POST | `/v1/proposal` |

---

## Estados de propuesta

| API value | Etiqueta | Color |
|---|---|---|
| `Draft` | Borrador | Amarillo Canario |
| `Ready` | Lista | Verde Amazonia |
| `Approved` | Aprobada | Azul Barú |
| `Denied` | Negada | Rojo Crayola |

---

## Identidad visual (Prolibu Brand Book v7)

| Token | Hex | Uso |
|---|---|---|
| `accent` / Azul Barú | `#4285F4` | Acción principal, botones, links |
| `draft` / Amarillo Canario | `#FDBD00` | Estado Borrador |
| `success` / `ready` / Verde Amazonia | `#39B54A` | Estado Lista, éxito |
| `error` / `denied` / Rojo Crayola | `#D4145A` | Estado Negada, errores |
| `bg` | `#FFFFFF` | Fondo general |
| `card` | `#F5F5F5` | Tarjetas y paneles |
| `text` | `#111111` | Texto principal |
| `textMuted` | `#666666` | Texto secundario |
| `border` | `#E5E5E5` | Bordes |

Logo: `OII>` — O en Azul Barú · II en Amarillo Canario · > en Rojo Crayola.

---

## Notas técnicas

- **Dominio dinámico:** `api.js` usa una variable `let BASE` mutable. `setApiDomain()` la actualiza; todas las funciones usan el mismo módulo, por lo que el cambio es global e inmediato.
- **Respuesta de productos:** la API puede devolver el array directo o dentro de `docs`/`data`/`records`. El código prueba todos: `Array.isArray(res) ? res : (res.docs || res.data || res.records || [])`.
- **Email inteligente:** detecta el dominio del correo del lead para abrir Gmail (`googlegmail://`), Outlook (`ms-outlook://`) o `mailto:` como fallback.
- **Filtro de lead:** extrae leads únicos de las propuestas cargadas (no llama a una API adicional).
- **IVA/Impuestos:** `p.product.tax` = monto en $ · `p.product.taxRate` = porcentaje para recalcular al editar.
- **Descuento:** admite modo porcentaje (`discountRate`) o valor absoluto (se convierte a tasa). La API siempre recibe `discountRate`.
- **URL de propuesta:** `https://{dominio}/v1/document/proposal/{mongoId}/full?source=none&rand={random}`
- **Stale closure en focus listener:** `ProposalsScreen` usa `useRef` para capturar `auth` y `userId` sin valores obsoletos.
- **Cambio de estado:** solo llama a `changeStatus` si el estado difiere del cargado originalmente.

---

## Dependencias principales

| Paquete | Versión | Uso |
|---|---|---|
| expo | ~54.0.0 | Runtime base |
| react-native | 0.81.5 | UI nativa |
| @react-navigation/native-stack | ^6.11.0 | Navegación |
| @react-native-async-storage/async-storage | 2.2.0 | Persistencia local |
| react-native-safe-area-context | ~5.6.0 | Áreas seguras |
