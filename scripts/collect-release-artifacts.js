const fs = require('fs');
const path = require('path');

const out = path.join(process.cwd(), 'artifacts');
const releaseDir = path.join(process.cwd(), 'release');
fs.mkdirSync(out, { recursive: true });

const exts =
  process.platform === 'win32'
    ? ['.exe']
    : process.platform === 'darwin'
      ? ['.dmg', '.zip']
      : ['.AppImage', '.deb'];

const files = fs.readdirSync(releaseDir).filter((f) => {
  const src = path.join(releaseDir, f);
  return fs.statSync(src).isFile() && exts.some((e) => f.endsWith(e));
});

for (const f of files) {
  fs.copyFileSync(path.join(releaseDir, f), path.join(out, f));
}

console.log('Artifacts:', files.join(', ') || '(none)');
if (files.length === 0) process.exit(1);
