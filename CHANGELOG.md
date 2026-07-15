# Historial de cambios

El formato sigue una idea cercana a [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/).

## [Unreleased]

### Corregido

- Limpiar proveedor / credenciales: `providers:clear` y `creds:clear` ahora eliminan de verdad API keys y ajustes guardados (`clearProviderSettings`), en lugar de fusionar `{}` y dejar la clave intacta. También se evita mutar el `DEFAULT_CONFIG` compartido al leer config ausente.
- Gemini: respuestas bloqueadas o sin texto (`promptFeedback.blockReason`, candidatos vacíos, `finishReason` SAFETY/RECITATION) ya no se tratan como éxito silencioso.
- OpenAI, Groq, DeepSeek, Mistral, Anthropic y MiniMax: respuestas HTTP 200 sin texto útil (`choices`/`content` vacíos) ya no se marcan como éxito silencioso.

### Añadido

- Soporte multi-proveedor: OpenAI, Anthropic, Google Gemini, MiniMax, Mistral, Groq y DeepSeek.
- Selector de proveedor en la cabecera y modal **«Proveedores y API Keys»** para API keys (Gemini: API key o service account JSON en `credentials.json`).
- Lista de modelos por proveedor vía API, con modelos de respaldo si la consulta falla o no hay credenciales.
- Coste estimado por llamada y sesión usando catálogo LiteLLM (caché en `pricing-cache.json` y defaults embebidos).
- Tests con `node:test` en `tests/providers/*.test.js` y workflow **CI** en GitHub Actions (`npm test` en push/PR a `main`).
- Detección de archivos locales dañados (`provider-config.json`, `credentials.json`, `saved-prompts.json`) con avisos en la UI y bloqueo de escritura hasta corregirlos.

## [1.3.0] - 2026-05-20

### Cambiado

- El selector de modelos se rellena dinámicamente con todos los modelos de la API Gemini accesibles con tus credenciales (`generateContent`), en lugar de una lista fija.

## [1.1.0] - 2026-03-26

### Añadido

- Asistente de mejora de prompts: panel flotante independiente, botón en la barra del historial y FAB; usa el mismo modelo y credenciales; contexto con instrucción del sistema, datos, última respuesta del historial y temperaturas.
- Documentación en `docs/PROMPT_ASSISTANT.md`.

### Cambiado

- Instrucción de sistema del coach (`PROMPT_COACH_SYSTEM`) y payload contextual ampliados para Gemini, truncado explícito y respuesta estructurada en español.
- `README` actualizado con el asistente de prompt.

## [1.0.0] - 2026-03-25

### Añadido

- App Electron con interfaz en español para probar modelos Gemini.
- Carga de credenciales por archivo JSON o pegado; persistencia local.
- Lista de modelos configurables en el proceso principal.
- Respuesta en Markdown (marked vía CDN) con fallback a texto plano.
- Presets de prompt y datos con persistencia JSON.
- Control de temperatura (0–2) con panel de ayuda al usuario.
- Metadatos de respuesta: tokens, tiempo, motivo de fin, coste estimado por llamada y total de sesión.
- Exportación del resultado a archivo Markdown.
- Empaquetado con electron-builder: Windows (NSIS + portable), macOS (DMG + ZIP) y Linux (AppImage + deb).
- Mitigaciones en Windows para conflictos de caché de Chromium y bloqueo de instancia única.

[Unreleased]: https://github.com/kscius/prompt_tester/compare/v1.3.0...HEAD
[1.3.0]: https://github.com/kscius/prompt_tester/releases/tag/v1.3.0
[1.1.0]: https://github.com/kscius/prompt_tester/releases/tag/v1.1.0
[1.0.0]: https://github.com/kscius/prompt_tester/releases/tag/v1.0.0
