#!/usr/bin/env python3
"""Build the owner-authorized, self-contained GitHub Pages snapshot."""
from pathlib import Path
import hashlib
import json
import re
import shutil
import tempfile

landing = Path(__file__).resolve().parents[1]
output = landing / 'site'
manifest = json.loads((landing / 'media-manifest.json').read_text())['files']
script = (landing / 'scenes.js').read_text()
gallery = script.split('const CLIPS = [', 1)[1].split('];', 1)[0]
full_ids = set(re.findall(r"\['([^']+)'", gallery))
# v7: only files the page actually requests. The gallery builds poster/preview paths from CLIPS and the
# title film from audience-01 source thumbnails; there is no full-clip dialog any more, so no final.mp4.
pages = ''.join((landing / n).read_text() for n in ['index.html', 'scenes.js', 'scenes.css', 'landing.css'])
def used(path):
    p = Path(path)
    if path in pages:
        return True
    if p.parent.name in full_ids and p.name in ('preview.mp4', 'poster.jpg'):
        return True
    return p.name == 'source-thumb.jpg' and p.parent.name.startswith('full-audience-01-m')
selected = [item for item in manifest if used(item['path'])]
with tempfile.TemporaryDirectory(prefix='.pages-build-', dir=landing) as temp:
    stage = Path(temp)
    for name in ['index.html', 'soon.html', 'scenes.js', 'scenes.css', 'landing.css']:
        shutil.copy2(landing / name, stage / name)
    for item in selected:
        source = landing / item['path']
        if not source.is_file():
            source = output / item['path']
        with source.open('rb') as stream:
            digest = hashlib.file_digest(stream, 'sha256').hexdigest()
        if digest != item['sha256']:
            raise ValueError(f'Media changed since manifest snapshot: {item["path"]}')
        destination = stage / item['path']
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
    for name in ['fonts/geologica-cyrillic.woff2', 'fonts/geologica-latin.woff2', 'vendor/gsap.min.js']:
        source = landing / name
        if not source.is_file():
            source = output / name
        destination = stage / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
    (stage / '.nojekyll').touch()
    publication = {
        'version': 'v7',
        'sourceBranch': 'feature/landing-motion-v5',
        'mediaFiles': len(selected),
        'mediaBytes': sum(item['bytes'] for item in selected),
        'authorization': 'Owner authorized GitHub publication with a working landing on 2026-11-05; v6 adds two more real results of the same fitness recording; v7 drops the full-clip dialog, so only previews/posters actually shown are published (2026-11-06).'
    }
    (stage / 'release.json').write_text(json.dumps(publication, ensure_ascii=False, indent=2) + '\n')
    if output.exists():
        shutil.rmtree(output)
    shutil.copytree(stage, output)
print(json.dumps(publication, ensure_ascii=False))
print(f'Built {output} (no symlinks; source/shared media unchanged)')
