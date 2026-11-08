"""Apply labels/icons without changing bundle ID or signing credentials."""
import json
import shutil
import sys
from pathlib import Path

hap, upstream = map(Path, sys.argv[1:])
for path, key in [
    ('AppScope/resources/base/element/string.json', 'app_name'),
    *[(f'electron/src/main/resources/{locale}/element/string.json', 'EntryAbility_label')
      for locale in ('base', 'en_US', 'zh_CN')],
]:
    target = hap / path
    data = json.loads(target.read_text())
    next(item for item in data['string'] if item['name'] == key)['value'] = 'multica'
    target.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
for name in ('app_icon.png', 'startIcon.png'):
    shutil.copyfile(upstream / 'apps/desktop/build/icon.png', hap / 'AppScope/resources/base/media' / name)
