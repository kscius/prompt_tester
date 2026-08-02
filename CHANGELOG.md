# Historial de cambios

El formato sigue una idea cercana a [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/).

## [Unreleased]

### Accesibilidad

- Ctrl/Cmd+Enter ya no dispara el envío principal mientras el modal de credenciales, el panel del Prompt Coach o la ayuda de temperatura están abiertos (evita llamadas LLM accidentales detrás de un overlay).
- Los toasts de la UI anuncian su mensaje a lectores de pantalla (`role="status"`, `aria-live="polite"`, `aria-atomic="true"`), insertando el nodo vacío antes del texto para que la región live se registre correctamente.

### Seguridad

- El historial y el Prompt Coach sanitizan el HTML de Markdown con DOMPurify (vendored) antes de `innerHTML`. Sin sanitizer disponible, se muestra texto escapado en lugar del HTML crudo de marked.

### Corregido

- Prompt Coach: el preflight al enviar ahora captura fallos de `providers:status` y distingue `credentialsCorrupt` (mismo aviso que el envío principal), en lugar de rechazos no capturados o el toast genérico de «configura la API key».
- Gemini: un `credentials.json` con solo `"type":"service_account"` (sin `private_key`/`client_email`) ya no se considera configurado; se usa `isValidServiceAccount` y se muestra el error de campos faltantes.
- Gemini: al guardar una API key, `credentials.json` (service account) solo se elimina después de persistir la config; antes un fallo de escritura (p. ej. `provider-config.json` dañado) podía borrar el SA dejando al usuario sin credenciales.
- DeepSeek: modelos de respaldo actualizados a `deepseek-v4-flash` / `deepseek-v4-pro` (los alias `deepseek-chat` / `deepseek-reasoner` se deprecán el 2026-07-24); se usa `reasoning_content` si `content` viene vacío y se omite `temperature` en `deepseek-reasoner`.
- OpenAI: modelos de razonamiento (`o1`, `o3-mini`, …) ya no envían `temperature` ni `max_tokens` (provocaban HTTP 400); usan `max_completion_tokens` y rol `developer` en lugar de `system`.
- MiniMax: guardar con Group ID vacío ahora elimina el `groupId` persistido (antes el merge de config lo dejaba intacto y seguía enviándose como `Group-Id`).
- Gemini: `credentials.json` dañado ya no se reporta como «no configurado» al listar modelos o generar; se propaga el mismo aviso de corrupción que el estado de proveedores.
- Limpiar proveedor / credenciales: `providers:clear` y `creds:clear` ahora eliminan de verdad API keys y ajustes guardados (`clearProviderSettings`), en lugar de fusionar `{}` y dejar la clave intacta. También se evita mutar el `DEFAULT_CONFIG` compartido al leer config ausente.
- Gemini: respuestas bloqueadas o sin texto (`promptFeedback.blockReason`, candidatos vacíos, `finishReason` SAFETY/RECITATION) ya no se tratan como éxito silencioso.
- OpenAI, Groq, DeepSeek, Mistral, Anthropic y MiniMax: respuestas HTTP 200 sin texto útil (`choices`/`content` vacíos) ya no se marcan como éxito silencioso.
- `provider-config.json` dañado: el estado de proveedores expone `configCorrupt` y la UI muestra toast, etiqueta en cabecera y avisos en el modal (antes solo se bloqueaba la escritura).

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
