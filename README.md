# Prompt Tester

Aplicación de escritorio para probar modelos **Gemini** de Google con tus propios prompts: escribes la instrucción del sistema y los datos, eliges el modelo y ves la respuesta en Markdown. Sirve para iterar prompts sin montar un servidor aparte.

## Qué incluye

- Importación de credenciales tipo **service account** (JSON), guardadas solo en el almacenamiento local de la app.
- Selector de modelo y llamada a la API de Generative Language (`generateContent`).
- Dos áreas de texto: instrucción del sistema y datos del usuario.
- Resultado renderizado en Markdown, copiar al portapapeles y exportar a `.md`.
- Presets: guardar y cargar combinaciones de prompt + datos.
- Temperatura ajustable (0–2) con una nota breve sobre qué hace cada rango.
- Tras cada respuesta: tokens, tiempo, coste estimado (según tabla de precios en la app) y acumulado de la sesión.
- **Asistente de prompt**: panel flotante (botón redondo y acceso desde el historial) que usa Gemini con tu instrucción del sistema, datos, última respuesta del historial y temperaturas para sugerir cambios concretos en el prompt.

Los importes de coste son **orientativos**; comprueba siempre la facturación en Google Cloud / AI Studio.

## Requisitos

- [Node.js](https://nodejs.org/) 20 o superior (recomendado LTS).
- Una cuenta de servicio de Google Cloud con acceso a la API de Gemini y un archivo JSON de claves.

## Desarrollo

```bash
npm install
npm start
```

Para depurar el proceso principal:

```bash
npm run dev
```

## Empaquetado (binarios)

Los artefactos se generan en la carpeta `release/` (está en `.gitignore`: no se sube al repositorio; los binarios van a **GitHub Releases**).

| Sistema | Comando | Notas |
|--------|---------|--------|
| **Windows** (x64) | `npm run dist` | Genera instalador NSIS y ejecutable portable. Ejecutar en Windows. |
| **Windows** solo portable | `npm run dist:portable` | |
| **macOS** | `npm run dist:mac` | Ejecutar en macOS. DMG y ZIP para x64 y arm64. Firma y notarización son opcionales pero recomendables para distribución. |
| **Linux** (x64) | `npm run dist:linux` | AppImage y paquete `.deb`. Ejecutar en Linux o en CI con runner Linux. |

Solo carpeta sin instalador (útil para pruebas):

```bash
npm run pack
```

Publicar una versión en GitHub (texto del release, adjuntos) está descrito en [docs/RELEASING.md](docs/RELEASING.md).

## Seguridad y datos locales

- Las credenciales y los presets se guardan bajo el directorio de datos de usuario de Electron (`userData`), no dentro del repositorio.
- No subas nunca tu JSON de service account al repositorio ni lo pegues en issues públicos.

## Licencia

MIT. Ver [LICENSE](LICENSE).

## Contribuciones

Las pautas básicas están en [CONTRIBUTING.md](CONTRIBUTING.md).
