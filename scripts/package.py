"""Build a ready-to-install archive without local environments or user data."""
from pathlib import Path
import hashlib
import json
import zipfile

root=Path(__file__).resolve().parents[1]
release=root/'release';release.mkdir(exist_ok=True)
version=json.loads((root/'package.json').read_text())['version']
target=release/f'comfyui-media-library-{version}.zip'
files=['__init__.py','library.py','metadata.py','generation.py','routes.py','README.md','LICENSE','NOTICE.md',
       'requirements.txt','requirements-dev.txt','pyproject.toml','package.json','package-lock.json',
       'tsconfig.json','vite.config.ts','playwright.config.ts','.gitignore',
       'docs/api.md','docs/gallery-overview.png','docs/gallery-video.png','docs/directory-compact-icons.png',
       'scripts/package.py','example_workflows/media_library_path.json']
directories=['frontend','web','vendor','tests']
paths=[root/name for name in files]
for name in directories:
    paths.extend(p for p in (root/name).rglob('*') if p.is_file() and '__pycache__' not in p.parts and p.suffix!='.pyc')
with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED) as z:
    for p in sorted(set(paths)):
        z.write(p,Path('comfyui-media-library')/p.relative_to(root))
with zipfile.ZipFile(target) as z:
    assert z.testzip() is None
    names=z.namelist()
    assert any('/web/dist/assets/' in n and n.endswith('.js') for n in names)
    assert 'comfyui-media-library/web/extensions/media_library.js' in names
    assert not any('/node_modules/' in n or '/.venv/' in n or 'catalog.sqlite' in n for n in names)
digest=hashlib.sha256(target.read_bytes()).hexdigest()
(release/'SHA256SUMS').write_text(f'{digest}  {target.name}\n')
print(f'{target}\n{target.stat().st_size:,} bytes; {len(names)} files\nSHA256 {digest}')
