# Publicar una release en GitHub

La carpeta `release/` contiene binarios pesados y **no** va al repositorio. Los adjuntas en la sección **Releases** de GitHub.

## 1. Preparar la versión

- Actualiza `version` en `package.json` si corresponde.
- Actualiza `CHANGELOG.md` con la fecha y los cambios.
- Haz commit y push de los cambios de código y documentación.

## 2. Generar artefactos

En cada sistema, tras `npm install`:

| Plataforma | Comando |
|------------|---------|
| Windows x64 | `npm run dist` |
| macOS | `npm run dist:mac` |
| Linux x64 | `npm run dist:linux` |

Para Windows obtendrás, entre otros:

- `release/Prompt Tester-Setup-<versión>-x64.exe` (instalador)
- `release/Prompt Tester-Portable-<versión>-x64.exe` (portable)

Sube a la release los archivos que quieras ofrecer (y los `.blockmap` solo si usas actualizaciones automáticas con electron-updater; esta app no las configura por defecto).

## 3. Crear la release en GitHub (interfaz web)

1. **Releases** → **Draft a new release**.
2. Etiqueta: por ejemplo `v1.0.0` (debe coincidir con el tag que crees).
3. Título: por ejemplo `Prompt Tester 1.0.0`.
4. Descripción: copia o resume la sección del `CHANGELOG.md` de esa versión; lista mejoras y requisitos (Windows 10+, etc.).
5. Arrastra los binarios desde tu carpeta `release/`.
6. Publica.

## 4. Opcional: GitHub CLI

Con [GitHub CLI](https://cli.github.com/) instalado y autenticado:

```bash
gh release create v1.0.0 --title "Prompt Tester 1.0.0" --notes-file CHANGELOG.md
gh release upload v1.0.0 "./release/Prompt Tester-Setup-1.0.0-x64.exe" "./release/Prompt Tester-Portable-1.0.0-x64.exe"
```

Ajusta rutas y versión. En Windows PowerShell usa comillas si el nombre del archivo lleva espacios.

## macOS y Linux

Si no tienes runners de esas plataformas, puedes usar **GitHub Actions** para construir en `windows-latest`, `macos-latest` y `ubuntu-latest` y subir los artefactos como adjuntos de release (flujo aparte; no está incluido en este repo por defecto).
