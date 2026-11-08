"""Source-contract checks before the unified formula's CI integration tests."""
import pathlib
import sys
import unittest

formula = pathlib.Path(sys.argv.pop(1))


class UnifiedFormula(unittest.TestCase):
    def test_cli_and_desktop_share_one_formula(self):
        text = formula.read_text()
        self.assertIn('class Multica < Formula', text)
        self.assertIn('std_go_args(output: bin/"multica"', text)
        self.assertIn('"multica-desktop-unsigned.hap"', text)
        self.assertIn('resource "ohos-assets" do', text)
        self.assertNotIn('Formula["multica-ohos"]', text)
        self.assertNotIn('depends_on "multica-ohos"', text)
        self.assertIn('pkgshare.install assets/"scripts/install-hap.sh"', text)

    def test_only_one_multica_formula_remains(self):
        self.assertEqual(["multica.rb"], sorted(p.name for p in formula.parent.glob("multica*.rb")))

    def test_checks_both_products(self):
        text = formula.read_text().split('  test do', 1)[1]
        self.assertIn('multica --version', text)
        self.assertIn('multica --help', text)
        self.assertIn('system "unzip", "-tq", hap', text)
        self.assertIn('requestPermissions', text)


unittest.main()
