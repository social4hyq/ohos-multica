"""Verify HAP branding against an upstream Multica checkout."""
import json
import sys
from pathlib import Path

hap, upstream = map(Path, sys.argv[1:])
for path, key in [
    ('AppScope/resources/base/element/string.json', 'app_name'),
    *[(f'electron/src/main/resources/{locale}/element/string.json', 'EntryAbility_label')
      for locale in ('base', 'en_US', 'zh_CN')],
]:
    values = {item['name']: item['value'] for item in json.loads((hap / path).read_text())['string']}
    assert values[key] == 'multica', (path, values[key])
icon = (upstream / 'apps/desktop/build/icon.png').read_bytes()
for name in ('app_icon.png', 'startIcon.png'):
    assert (hap / 'AppScope/resources/base/media' / name).read_bytes() == icon, name
print('PASS: application/locale labels and official icon bytes')
