# Prolibu V1

Aplicacion movil Android/iOS para que los agentes gestionen propuestas comerciales a traves de la plataforma **Prolibu**. Construida con React Native + Expo SDK 54.

---

## Requisitos

- Node.js >= 18
- [Expo CLI](https://docs.expo.dev/get-started/installation/) (`npm install -g expo-cli`)
- Android Studio + emulador, o dispositivo fisico con **Expo Go**

---

## Instalacion y ejecucion

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
├── App.js                          # Punto de entrada — navegacion (Stack) + bootstrap de dominio/sesion
├── app.json                        # Config Expo (nombre: Prolibu V1, slug: prolibu-v1)
├── eas.json                        # Config EAS Build (preview APK / production AAB)
├── src/
│   ├── api.js                      # Llamadas a la API de Prolibu (dominio dinamico)
│   ├── theme.js                    # Paleta de colores (Prolibu Brand Book v7)
│   └── screens/
│       ├── DomainScreen.js         # Configuracion inicial del dominio/cuenta
│       ├── LoginScreen.js          # Autenticacion del agente
│       ├── AgentsScreen.js         # Seleccion de agente (pantalla auxiliar, accesible desde Login)
│       ├── ProposalsScreen.js      # Lista de propuestas del agente
│       ├── EditorScreen.js         # Editor de propuesta (productos + estado)
│       └── CreateProposalScreen.js # Crear nueva propuesta
└── package.json
```

---

## Flujo de arranque

```
Abrir app
   |
   +-- Hay dominio guardado?
   |       NO -> DomainScreen  (configura subdominio + plataforma)
   |       SI -> setApiDomain() -> Hay sesion guardada?
   |                                   NO -> LoginScreen
   |                                   SI -> ProposalsScreen
   |
   LoginScreen
       |
       +-- Login exitoso -> ProposalsScreen  (propuestas del usuario logueado)
       +-- (opcional)    -> AgentsScreen     (seleccion manual de otro agente)
```

---

## Pantallas

### DomainScreen
- Se muestra **solo la primera vez** (o al hacer "Cambiar cuenta").
- El usuario ingresa el subdominio de su cuenta (ej. `mi-empresa`) y selecciona la plataforma (`.prolibu.com` / `.nodriza.io`).
- Tambien acepta un dominio completo con punto (ej. `mi-empresa.prolibu.com`).
- Vista previa en tiempo real de la URL resultante.
- Guarda el dominio en AsyncStorage y llama a `setApiDomain()` para configurar todos los endpoints dinamicamente.

### LoginScreen
- Formulario de usuario y contrasena.
- Muestra el dominio activo en el footer.
- Boton **"Cambiar cuenta"** que limpia dominio + sesion y vuelve a `DomainScreen`.
- Llama a `POST /v1/user/login` con el `accessToken` fijo de plataforma.
- Extrae el token JWT de la respuesta probando los campos: `data.token.accessToken`, `data.token`, `data.accessToken` (en ese orden).
- Guarda en AsyncStorage el objeto `{token, user, userId}`.

### AgentsScreen
- Lista los agentes activos (`GET /v1/publicservices/getAgents?status=active&roles[]=agent`).
- Busqueda/filtro en tiempo real por nombre o email.
- Auto-selecciona al usuario logueado si aparece en la lista.
- Al seleccionar un agente, navega a `ProposalsScreen` con ese agente.
- Boton de logout en el header.

### ProposalsScreen
- Lista las propuestas del agente (`GET /v1/proposal?inCharge={agentId}&limit=200&sort=updatedAt:DESC&populate=all`).
- **Filtro por estado**: chips Todas / Borrador / Lista / Aprobada / Negada con contador por estado.
- **Filtro por lead**: chip que abre un picker con buscador y lista de leads unicos (extraidos del campo `relatedLead` de las propuestas cargadas, sin llamada adicional a la API) con conteo de propuestas por lead.
- **Ordenamiento**: Recientes (updatedAt DESC) / Antiguas (updatedAt ASC) / Creacion (createdAt DESC) / A-Z (titulo ASC).
- Pull-to-refresh y recarga automatica al volver desde el editor.
- FAB **(+)** para crear nueva propuesta.
- Cada tarjeta muestra: titulo, estado, numero (`#`), fecha, moneda, temperatura (`rating`: Caliente/Tibia/Fria), contador de vistas (campo `views` / `visits` / `opens` / `timesOpened` / `opened` segun lo que retorne la API).
- Boton de llamada directa al lead (si tiene telefono registrado).
- **Modal de envio** por propuesta con selector de canal:
  - **WhatsApp** — abre la app con plantilla pre-redactada y numero del lead pre-cargado.
  - **Correo** — detecta el dominio del lead: `gmail.com` → app Gmail nativa (`googlegmail://`), `outlook.com` / `hotmail.com` / `live.com` / `msn.com` / `microsoft.com` → app Outlook nativa (`ms-outlook://`), resto → `mailto:`. Incluye plantilla de asunto y cuerpo editable.
  - **Compartir** — hoja nativa de compartir del sistema operativo.
- Selector de tipo de URL: Cliente (contabiliza vistas, `?source={email}`) o Anonima (sin seguimiento, `?source=none&rand={random}`).

### CreateProposalScreen
- Numero de propuesta **auto-generado** (6 caracteres alfanumericos A-Z 0-9 en mayusculas), editable manualmente.
- Titulo de la propuesta.
- Selector de moneda dinamico desde la API.
- **Busqueda de lead por email**: llama a `/lead/exist?key=email&val={email}`; si no resuelve un ID valido, hace fallback a `GET /v1/lead?email={email}&limit=1`.
- Si el lead existe: muestra tarjeta con nombre y email, con opcion de cambiar.
- Si el lead no existe: formulario para crear uno nuevo:
  - **Nombre** (requerido), **Apellido** (opcional), **Celular** (opcional) con selector de codigo de pais: CO/US/MX/AR/CL/PE/BR/VE/EC/ES.
- Al confirmar: crea el lead si es necesario (`POST /v1/lead`), crea la propuesta (`POST /v1/proposal`) y navega al editor.
- Catalogo de productos desde la API con buscador por nombre o SKU. **La API usa el SKU como identificador del producto**, no el ID de MongoDB.
- Resumen de subtotal, descuento e impuestos antes de crear.

### EditorScreen
- Carga la propuesta completa (`GET /v1/proposal/{id}?populate=all`).
- **Estado**: selector de 4 estados (Borrador / Lista / Aprobada / Negada).
- **Moneda**: selector dinamico desde la API (fallback: COP, USD, EUR).
- **Productos**: lista editable con stepper de cantidad, descuento (% o $ — toggleable), subtotal por linea con IVA y total general (Subtotal / Descuento / Impuestos / Total).
- **Catalogo**: modal con buscador por nombre o SKU. Usa SKU como identificador al guardar.
- **Producto personalizado**: nombre + precio + cantidad (sin necesidad de que este en el catalogo). ID generado como `custom-{timestamp}-{random}`.
- **Guardar**:
  1. `PUT /v1/proposal/{id}` — actualiza productos y moneda.
  2. `PUT /v1/proposal/changeStatus` — cambia estado (solo si cambio respecto al estado cargado originalmente).
  - Si los productos se guardan pero el cambio de estado falla, muestra alerta de advertencia (error parcial) sin revertir los productos.
- **Pantalla de exito**: URL de propuesta seleccionable/copiable con botones para abrir en navegador y compartir.

---

## API (`src/api.js`)

El dominio base es **dinamico** — se configura en `DomainScreen` y se aplica con `setApiDomain(domain)`.

**URL por defecto (fallback):** `https://customer-design.prolibu.com/v1`
**Formato configurado:** `https://{subdominio}.{plataforma}/v1`
**Plataformas soportadas:** `.prolibu.com`, `.nodriza.io`

| Funcion | Metodo | Endpoint |
|---|---|---|
| `setApiDomain(domain)` | — | Configura la BASE URL en runtime |
| `getApiBase()` | — | Retorna la BASE URL activa |
| `login(user, pass)` | POST | `/v1/user/login` |
| `getAgents()` | GET | `/v1/publicservices/getAgents?status=active&roles[]=agent` |
| `getProposals(agentId, token)` | GET | `/v1/proposal?inCharge={id}&limit=200&sort=updatedAt:DESC&populate=all` |
| `getProposal(id, token)` | GET | `/v1/proposal/{id}?populate=all` |
| `saveProposal(id, body, token)` | PUT | `/v1/proposal/{id}` |
| `changeProposalStatus(id, status, token)` | PUT | `/v1/proposal/changeStatus` |
| `getCurrencies(token)` | GET | `/v1/currency` |
| `getProducts(token)` | GET | `/v1/product?disabled=false&limit=1000` |
| `checkLeadByEmail(email, token)` | GET | `/v1/lead/exist?key=email&val={email}` |
| `searchLeadByEmail(email, token)` | GET | `/v1/lead?email={email}&limit=1` |
| `createLead(data, token)` | POST | `/v1/lead` |
| `createProposal(data, token)` | POST | `/v1/proposal` |

---

## Estados de propuesta

| API value | Etiqueta | Color |
|---|---|---|
| `Draft` | Borrador | Amarillo Canario `#FDBD00` |
| `Ready` | Lista | Verde Amazonia `#39B54A` |
| `Approved` | Aprobada | Azul Baru `#4285F4` |
| `Denied` | Negada | Rojo Crayola `#D4145A` |

---

## Identidad visual (Prolibu Brand Book v7)

| Token | Hex | Uso |
|---|---|---|
| `accent` / Azul Baru | `#4285F4` | Accion principal, botones, links |
| `accentFg` | `#FFFFFF` | Texto sobre fondo accent |
| `draft` / Amarillo Canario | `#FDBD00` | Estado Borrador |
| `success` / `ready` / Verde Amazonia | `#39B54A` | Estado Lista, exito |
| `error` / `denied` / Rojo Crayola | `#D4145A` | Estado Negada, errores |
| `sent` | `#4285F4` | Alias de accent para estado enviado |
| `bg` | `#FFFFFF` | Fondo general |
| `card` | `#F5F5F5` | Tarjetas y paneles |
| `text` | `#111111` | Texto principal |
| `textMuted` | `#666666` | Texto secundario |
| `border` | `#E5E5E5` | Bordes |

Logo: `OII>` — O en Azul Baru · II en Amarillo Canario · > en Rojo Crayola.

> **app.json:** `userInterfaceStyle` esta configurado como `"dark"`, pero el tema de la app es completamente blanco (COLORS.bg = `#FFFFFF`). Esto no afecta el funcionamiento pero puede revisarse.

---

## Notas tecnicas

- **Dominio dinamico:** `api.js` usa una variable `let BASE` mutable inicializada en `https://customer-design.prolibu.com/v1`. `setApiDomain()` la actualiza globalmente; todas las funciones del modulo usan la misma referencia.
- **Respuesta de productos:** la API puede devolver el array directo o dentro de `docs`/`data`/`records`. El codigo prueba todos: `Array.isArray(res) ? res : (res.docs || res.data || res.records || [])`.
- **Email inteligente:** detecta el dominio del correo del lead. Dominios soportados: `gmail.com` → `googlegmail://`; `outlook.com`, `hotmail.com`, `live.com`, `msn.com`, `microsoft.com` → `ms-outlook://`; resto → `mailto:`.
- **Filtro de lead:** extrae leads unicos de las propuestas cargadas (campo `relatedLead`), no llama a una API adicional.
- **IVA/Impuestos:** `p.product.taxRate` = porcentaje usado para recalcular al editar (fallback a `p.product.tax`).
- **Descuento:** admite modo porcentaje (`discountRate`) o valor absoluto (se convierte internamente a tasa). La API siempre recibe `discountRate`.
- **SKU como identificador de producto:** al guardar propuestas, el codigo usa el SKU del producto como clave (no el `_id` de MongoDB), segun el comportamiento de la API de Prolibu.
- **URL de propuesta:** `https://{dominio-activo}/v1/document/proposal/{mongoId}/full?source={email}` (cliente) o `?source=none&rand={random}` (anonima). Usa la BASE URL activa al momento de construirla.
- **Stale closure en focus listener:** `ProposalsScreen` usa `useRef` para capturar `auth` y `userId` sin valores obsoletos en el listener de navegacion.
- **Cambio de estado:** solo llama a `changeStatus` si el estado difiere del cargado originalmente (`originalStatus`); en caso de error, revierte la UI al estado anterior. Si solo falla el estado (pero los productos se guardaron), muestra alerta de advertencia sin deshacer los productos.
- **Telefono en leads:** el numero se limpia de caracteres no numericos y se prefija con el codigo de pais seleccionado antes de guardar.
- **Numero de propuesta auto-generado:** 6 caracteres aleatorios del conjunto `[A-Z0-9]`, generado en `CreateProposalScreen` al montar el componente. El usuario puede editarlo antes de crear.
- **Vistas/Aperturas:** el contador de vistas en tarjetas busca el valor en: `views` → `visits` → `opens` → `timesOpened` → `opened` (el primero definido que retorne la API).
- **Autenticacion:** el token de plataforma fijo es `56a69869-bf0a-4650-98e9-fcd9680b31d5`. El JWT del usuario se guarda como JSON en AsyncStorage bajo la clave `auth`.

---

## Build con EAS

```bash
# APK de prueba (Android)
eas build --profile preview --platform android

# AAB de produccion (Google Play)
eas build --profile production --platform android
```

Requiere cuenta en [expo.dev](https://expo.dev) y EAS CLI >= 12.

**Config de la app (`app.json`):**
- Package Android: `com.prolibu.v1`
- Bundle ID iOS: `com.prolibu.v1`
- Version: `1.0.0`

---

## Dependencias principales

| Paquete | Version | Uso |
|---|---|---|
| expo | ~54.0.0 | Runtime base |
| react | 19.1.0 | UI library |
| react-native | 0.81.5 | UI nativa |
| @react-navigation/native | ^6.1.18 | Navegacion base |
| @react-navigation/native-stack | ^6.11.0 | Stack navigator |
| @react-native-async-storage/async-storage | 2.2.0 | Persistencia local |
| react-native-safe-area-context | ~5.6.0 | Areas seguras |
| react-native-screens | ~4.16.0 | Optimizacion de pantallas |
| expo-asset | ~12.0.12 | Gestion de assets |
| expo-constants | ~18.0.13 | Constantes de entorno |
