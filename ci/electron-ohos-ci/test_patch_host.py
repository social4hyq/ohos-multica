import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).with_name('patch-host.py')
OLD = 'return"HarmonyOS"===os_1.default.type()'
NEW = 'return process.platform==="openharmony"||"HarmonyOS"===os_1.default.type()'


class HostPatchTests(unittest.TestCase):
    def fixture(self, root, text):
        paths = []
        for name in ('hvigor', 'hvigor-ohos-plugin'):
            path = root / 'hvigor' / name / 'node_modules/@ohos/hvigor-common/src/util/system-util.js'
            path.parent.mkdir(parents=True)
            path.write_text(text)
            paths.append(path)
        return paths

    def run_patch(self, root):
        return subprocess.run([sys.executable, str(SCRIPT), str(root)], capture_output=True, text=True)

    def test_patches_both_copies_only(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            paths = self.fixture(root, 'function isHarmony(){' + OLD + '}')
            result = self.run_patch(root)
            self.assertEqual(result.returncode, 0, result.stderr)
            for path in paths:
                self.assertEqual(path.read_text(), 'function isHarmony(){' + NEW + '}')

    def test_rejects_unexpected_implementation(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            self.fixture(root, 'function isHarmony(){return false}')
            result = self.run_patch(root)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('Unexpected host detection', result.stderr)

    def test_rejects_ambiguous_marker(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            self.fixture(root, OLD + ';' + OLD)
            self.assertNotEqual(self.run_patch(root).returncode, 0)


if __name__ == '__main__':
    unittest.main()
