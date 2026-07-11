# Asistente de mejora de prompts

Panel flotante independiente del historial principal. Usa las credenciales del **proveedor activo** y el **mismo modelo** seleccionado en la cabecera.

## Qué hace el prompt de sistema del coach

La instrucción (`PROMPT_COACH_SYSTEM` en `renderer/prompt-coach.js`) está pensada para:

- Tratar cada envío como un **paquete de contexto estructurado** (no como chat libre): sistema, datos, última salida, temperaturas, historial del coach y metadatos de truncado.
- Relacionar la petición del usuario con **intención**, **systemInstruction vs mensaje de usuario**, **salida reciente** (si existe) y **muestreo** (temperatura en [0,2]).
- Priorizar **cambios accionables** (qué tocar en Sistema, Datos o temperatura) y citar fragmentos cuando el usuario se refiere a un texto concreto.
- Manejar **texto truncado**: si aparece el marcador de truncado, el modelo no debe inventar el contenido omitido.
- Responder siempre en **español**, con formato Markdown fijo: **Diagnóstico**, **Cambios recomendados**, **Temperatura**, **Snippets** (opcional), **Comprobación rápida**.

## Contexto de datos que recibe el modelo (payload)

Además de lo que ves en la UI, el mensaje de usuario que se envía al **proveedor y modelo activos** incluye:

- **Metadatos del paquete** — origen de la llamada, reglas de truncado, límite del historial del asistente.
- **Historial reciente del asistente** (hasta ~10 mensajes).
- **Contexto del probador** — proveedor y modelo en los selectores de la cabecera y temperatura actual del slider.
- **Instrucción del sistema** y **datos** tal cual en los editores (posiblemente truncados).
- **Última respuesta del historial principal** con la temperatura y el modelo con los que se generó, o una nota si aún no hay respuestas.
- **Nueva petición** del usuario en el panel flotante.

## Llamada al modelo

- El asistente llama al proveedor activo vía `callLLM` (mismo proveedor y modelo que el probador principal).
- Usa **temperatura 0,35** en su propia petición para recomendaciones más estables.
- Código: `renderer/prompt-coach.js` (`PROMPT_COACH_SYSTEM`, función `buildCoachPayload`, `sendCoachRequest`).


## Atajos

- **Escape** con el panel abierto: cierra el panel del asistente.
- **Enter** en el textarea del asistente: envía (Shift+Enter permite salto de línea).
