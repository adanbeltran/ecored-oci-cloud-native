# Frontend React y Firebase

## Responsabilidad

El frontend presenta la interfaz, inicia sesión con Firebase y envía el ID token
al único punto de entrada configurado en `VITE_API_URL`. No conoce las URL
internas de Empresas ni Materiales.

## `src/main.jsx`

| Sentencia o bloque | Qué hace | Por qué existe |
|---|---|---|
| `StrictMode` | Activa comprobaciones adicionales de React | Detecta efectos y prácticas problemáticas durante desarrollo |
| `createElement` | Construye el componente importado dinámicamente | Hace explícito para React y ESLint que el valor importado se utiliza |
| `createRoot` | Crea la raíz React | Es la API moderna para montar la aplicación |
| Importaciones de Bootstrap | Cargan estilos y componentes interactivos | Evitan recrear utilidades visuales básicas |
| `global.css` | Aplica estilos propios | Separa presentación global del JSX |
| `document.getElementById("root")` | Busca el nodo definido en `index.html` | React necesita un punto de montaje |
| Validación de `rootElement` | Detiene el arranque si falta el nodo | Produce un error explícito en vez de una pantalla vacía |
| `renderStartupError()` | Centraliza la pantalla de error inicial | No repite el mismo JSX en varias ramas |
| `isEnvironmentConfigured()` | Comprueba variables antes de Firebase | Evita inicializar el SDK con valores vacíos |
| `import("./app/App.jsx")` | Carga la aplicación después de validar | La importación dinámica impide evaluar Firebase prematuramente |
| `.catch(...)` | Presenta un fallo de carga legible | Un error de módulo no debe dejar la página en blanco |

## `src/config/env.js`

| Sentencia o bloque | Qué hace | Por qué existe |
|---|---|---|
| `REQUIRED_ENV_VARIABLES` | Enumera la configuración mínima | Define una sola fuente de verdad |
| `Object.freeze()` | Evita mutaciones accidentales | La configuración no debe cambiar durante la ejecución |
| `runtimeConfig` | Lee `window.__ECORED_CONFIG__` | Permite configurar una imagen ya construida |
| `readEnvironmentValue()` | Usa configuración de Nginx o `import.meta.env` | Docker recibe variables al iniciar y Vite local usa `.env` |
| `rawEnv` | Reúne los valores resultantes | El resto de la aplicación usa un contrato único |
| `normalize()` | Convierte a texto limpio | Evita espacios y valores `undefined` |
| `getMissingEnvironmentVariables()` | Retorna nombres faltantes | Permite indicar al estudiante qué debe configurar |
| `isEnvironmentConfigured()` | Resume la validación como booleano | Simplifica la decisión de arranque |
| `replace(/\/+$/, "")` | Retira barras finales de la URL | Evita rutas con doble barra |
| `env.firebase` | Agrupa valores del SDK | Conserva cohesión y hace explícito su consumidor |

Las variables `VITE_*` son visibles en el navegador. Solo contienen
configuración pública de Firebase y la URL del gateway; nunca contraseñas de
bases de datos. `index.html` carga `runtime-config.js` antes de `main.jsx`
para que la configuración exista antes de inicializar Firebase.

## `src/config/firebase.js`

| Sentencia | Explicación |
|---|---|
| `getApps().length ? getApp() : initializeApp(...)` | Reutiliza Firebase durante React Refresh y evita inicializar dos aplicaciones |
| `getAuth(firebaseApp)` | Obtiene el servicio de autenticación asociado a la aplicación |
| `new GoogleAuthProvider()` | Configura el proveedor Google |
| `prompt: "select_account"` | Permite escoger cuenta en cada inicio interactivo |

## `features/auth/services/authService.js`

| Función | Qué hace | Razón |
|---|---|---|
| `loginWithEmail()` | Llama a Firebase con correo y contraseña | Mantiene el SDK fuera de los componentes |
| `loginWithGoogle()` | Abre el flujo de Google | Ofrece un segundo proveedor sin duplicar lógica visual |
| `logout()` | Cierra la sesión Firebase | El SDK limpia su estado persistido |
| `observeAuthState()` | Escucha restauración, login y logout | Firebase es la fuente real del estado de sesión |
| `getCurrentIdToken()` | Obtiene un token vigente del usuario actual | El gateway necesita ese token en cada solicitud |

La expresión:

```javascript
return auth.currentUser ? auth.currentUser.getIdToken() : null;
```

se lee: “si existe usuario actual, obtenga su ID token; de lo contrario,
retorne `null`”. Es un operador ternario: condición, valor verdadero y valor
falso.

## Estado de autenticación

### `authContext.js`

`createContext(null)` crea el contrato compartido. El valor inicial `null`
permite detectar que un componente intentó consumirlo fuera del proveedor.

### `AuthProvider.jsx`

| Bloque | Explicación |
|---|---|
| `useState(null)` | Inicia sin usuario hasta que Firebase responda |
| `useState(true)` | Impide decidir rutas mientras se restaura la sesión |
| `useEffect(..., [])` | Registra el observador una sola vez |
| `unsubscribe` | Cancela el observador al desmontar el proveedor |
| `useMemo()` | Conserva estable el objeto compartido cuando no cambian usuario o carga |
| `Boolean(user)` | Expone un indicador explícito de autenticación |
| `AuthContext.Provider` | Hace disponible el estado a todo el árbol |

### `useAuth.js`

`useContext(AuthContext)` obtiene el valor más cercano. Si es `null`, lanza
un error descriptivo porque la estructura de proveedores es incorrecta.

### `ProtectedRoute.jsx`

Primero muestra carga, después redirige a `/login` si no hay usuario y solo
entonces renderiza `Outlet`. El orden evita mostrar brevemente contenido
privado mientras Firebase restaura la sesión.

## `shared/services/httpClient.js`

| Sentencia o bloque | Qué hace | Por qué |
|---|---|---|
| `axios.create()` | Crea un cliente HTTP común | Centraliza URL, timeout y encabezados |
| `baseURL: env.apiUrl` | Apunta al gateway | El frontend no conoce servicios internos |
| `timeout: 15000` | Limita la espera | Evita solicitudes bloqueadas indefinidamente |
| Interceptor de solicitud | Se ejecuta antes de cada llamada | Evita repetir autenticación en cada módulo |
| `await getCurrentIdToken()` | Solicita un token vigente | Firebase puede renovarlo automáticamente |
| `Authorization = Bearer ...` | Adjunta el token | Es el contrato esperado por ambos gateways |
| `return config` | Continúa la solicitud | Axios necesita la configuración resultante |

## Servicios funcionales

`companyService.js` y `materialService.js` contienen únicamente llamadas
HTTP. Cada función espera la respuesta, retorna `response.data` y oculta Axios
a las páginas. Esto permite cambiar detalles de transporte en un solo lugar.

| Archivo | Endpoint | Operaciones |
|---|---|---|
| `companyService.js` | `/companies` | listar y crear |
| `materialService.js` | `/materials` | listar y crear |

`signal` permite cancelar lecturas cuando el usuario abandona una página.

## Formularios

### `CompanyForm.jsx`

- `INITIAL_FORM` evita repetir el estado vacío.
- `handleChange` usa el atributo `name` para actualizar cualquier campo.
- `preventDefault()` impide que el navegador recargue la página.
- `isSubmitting` bloquea envíos duplicados.
- `trim()` elimina espacios antes de entregar el caso de uso.
- `finally` vuelve a habilitar el formulario incluso cuando falla la API.
- Los atributos `required`, `type` y `autoComplete` aportan validación y
  accesibilidad, pero el backend vuelve a validar porque el navegador no es
  confiable.

### `MaterialForm.jsx`

Conserva `company_id` como texto porque proviene de un ObjectId de MongoDB.
`Number(form.quantity)` convierte la cantidad antes de enviarla. El estado
inicial `available` no se envía: el backend lo define para impedir que el
cliente elija estados no autorizados.

`formDisabled` desactiva el formulario durante el envío o cuando el usuario
todavía no tiene empresas.

## Páginas

### `CompaniesPage.jsx`

La página coordina el caso de uso. Limpia mensajes anteriores, llama
`createCompany()`, muestra éxito o traduce el error. Relanza el error para que
`CompanyForm` conserve su comportamiento de finalización.

### `MaterialsPage.jsx`

| Bloque | Explicación |
|---|---|
| Cuatro `useState` | Separan empresas, materiales, carga y retroalimentación |
| `AbortController` | Cancela solicitudes al desmontar la página |
| `Promise.all` | Consulta Empresas y Materiales en paralelo |
| `Array.isArray` | Evita romper el render si la API devuelve una forma inesperada |
| Verificación `ERR_CANCELED` | No muestra como error una navegación normal |
| `finally` | Finaliza carga solo si la página continúa montada |
| `handleCreateMaterial` | Crea, vuelve a consultar y actualiza la lista |

## Enrutamiento y composición

| Archivo | Responsabilidad |
|---|---|
| `App.jsx` | Une proveedores y enrutador |
| `AppProviders.jsx` | Instala `BrowserRouter` y `AuthProvider` |
| `AppRouter.jsx` | Declara rutas públicas, privadas y 404 |
| `AppLayout.jsx` | Presenta navegación, usuario, cierre de sesión y `Outlet` |

`lazy()` divide el JavaScript por páginas y `Suspense` muestra un indicador
mientras se descarga el módulo solicitado.

## Componentes compartidos

| Archivo | Propósito |
|---|---|
| `AlertMessage.jsx` | Mensajes accesibles de éxito o error |
| `LoadingSpinner.jsx` | Estado de carga con `aria-live` |
| `ModuleCard.jsx` | Acceso reutilizable a módulos |
| `PageHeader.jsx` | Encabezado visual homogéneo |
| `StartupError.jsx` | Diagnóstico previo al montaje |
| `NotFoundPage.jsx` | Respuesta visual para rutas inexistentes |
| `getErrorMessage.js` | Convierte errores de API, Firebase y red en texto legible |

## Archivos de soporte

| Archivo | Explicación |
|---|---|
| `index.html` | Contiene `#root` y carga `src/main.jsx` |
| `vite.config.js` | Activa React dentro de Vite |
| `eslint.config.js` | Define reglas estáticas de calidad |
| `global.css` | Estilos propios organizados por selector |
| `.env.example` | Contrato público de configuración |
| `package.json` | Scripts y dependencias directas |
| `package-lock.json` | Versiones transitivas reproducibles |
