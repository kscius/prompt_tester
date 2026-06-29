# AGENTS.md

## Cursor Cloud specific instructions

Prompt Tester is an **Electron desktop GUI app** (no web server, no backend service). It lets you test prompts against multiple LLM providers (OpenAI, Anthropic, Gemini, MiniMax, Mistral, Groq, DeepSeek). Standard commands live in `package.json` (`npm start`, `npm run dev`, `npm run dist*`) and the README.

Non-obvious notes for running it in this headless cloud VM:

- **Run it on the X display:** the desktop is on `DISPLAY=:1`. Launch with `DISPLAY=:1 npx electron . --no-sandbox`. The `--no-sandbox` flag is required because the Chromium sandbox cannot initialize inside this container.
- **Harmless startup noise:** `Failed to connect to the bus` (dbus) errors and GPU warnings are expected in this environment and do not indicate a problem. A successful launch logs `[pricing] Precios actualizados desde LiteLLM: <timestamp>` (pricing is fetched from the public LiteLLM catalog over the network on startup).
- **No tests or linter** are configured in this repo — there is no `test`/`lint` npm script. The only "run" target for development is `npm start` (Electron).
- **Provider API keys are required for the core flow** (entering a prompt and clicking "Enviar"/Send to call an LLM). No provider key is bundled; keys/credentials are entered through the in-app "Proveedores y API Keys" modal and are stored in Electron's `userData` dir, not in the repo. Without a key you can still exercise everything except the actual model call (e.g. presets, UI, model fallback list).
- **Local app data** (presets, credentials, cached pricing) lives under `~/.config/Prompt Tester/` (e.g. `saved-prompts.json`, `credentials.json`), since `productName` is "Prompt Tester". Delete that folder to reset app state.
