# Publicar una release en GitHub

La carpeta `release/` contiene binarios pesados y **no** va al repositorio. Los binarios se publican en la sección **Releases** de GitHub.

## Flujo automático (recomendado)

Al hacer push de un tag de versión (`v*`), GitHub Actions compila en Windows, macOS y Linux y adjunta todos los artefactos a la release.

### Pasos

1. Actualiza `version` en `package.json` si corresponde.
2. Actualiza `CHANGELOG.md` con la fecha y los cambios.
3. Haz commit y push de los cambios a `main`.
4. Crea y sube el tag (la versión debe coincidir con `package.json`):

```bash
git tag v1.3.0
git push origin v1.3.0
```

5. En GitHub → **Actions** → workflow **Release**: verifica que termine correctamente.
6. En **Releases** aparecerá la nueva versión con los binarios adjuntos.

### Artefactos generados

| Plataforma | Archivos (ejemplo v1.3.0) |
|------------|---------------------------|
| Windows x64 | `Prompt Tester-Setup-1.3.0-x64.exe`, `Prompt Tester-Portable-1.3.0-x64.exe` |
| macOS x64 / arm64 | `Prompt Tester-1.3.0-x64-mac.dmg`, `Prompt Tester-1.3.0-arm64-mac.dmg`, ZIP equivalentes |
| Linux x64 | `Prompt Tester-1.3.0-x64-linux.AppImage`, `Prompt Tester-1.3.0-x64-linux.deb` |

Los builds de macOS en CI **no están firmados ni notarizados** (no hay certificado de Apple en el runner). Son válidos para descarga directa; para distribución amplia en Mac conviene firmar en un Mac con certificado de desarrollador.

### Probar el workflow sin publicar

En **Actions** → **Release** → **Run workflow** se compilan los tres sistemas y los artefactos quedan disponibles en la ejecución (pestaña **Artifacts**). No se crea release porque no hay tag.

## Flujo manual (opcional)

Si prefieres compilar en tu máquina:

| Plataforma | Comando |
|------------|---------|
| Windows x64 | `npm run dist` |
| macOS | `npm run dist:mac` |
| Linux x64 | `npm run dist:linux` |

Luego sube los archivos de `release/` a una release en GitHub (interfaz web o CLI):

```bash
gh release create v1.3.0 --title "Prompt Tester 1.3.0" --notes-file CHANGELOG.md
gh release upload v1.3.0 "./release/Prompt Tester-Setup-1.3.0-x64.exe" "./release/Prompt Tester-Portable-1.3.0-x64.exe"
```

En Windows PowerShell usa comillas si el nombre del archivo lleva espacios.
