# Historial de cambios

El formato sigue una idea cercana a [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/).

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

[1.1.0]: https://github.com/kscius/prompt_tester/releases/tag/v1.1.0
[1.0.0]: https://github.com/kscius/prompt_tester/releases/tag/v1.0.0
