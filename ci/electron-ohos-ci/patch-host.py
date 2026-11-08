"""Select the native toolchain by Node host ABI, not the container kernel name."""
import sys
from pathlib import Path

root = Path(sys.argv[1])
old = 'return"HarmonyOS"===os_1.default.type()'
new = 'return process.platform==="openharmony"||"HarmonyOS"===os_1.default.type()'
paths = [
    root / 'hvigor' / name / 'node_modules/@ohos/hvigor-common/src/util/system-util.js'
    for name in ('hvigor', 'hvigor-ohos-plugin')
]
for path in paths:
    text = path.read_text()
    if text.count(old) != 1:
        raise SystemExit(f'Unexpected host detection implementation: {path}')
    path.write_text(text.replace(old, new))
