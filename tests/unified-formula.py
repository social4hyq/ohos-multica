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
        self.assertNotIn('resource "ohos-assets" do', text)
        self.assertNotIn('social4hyq/ohos-multica/archive/', text)
        self.assertNotIn('Formula["multica-ohos"]', text)
        self.assertNotIn('depends_on "multica-ohos"', text)
        self.assertIn('pkgshare.install "scripts/install-hap-ohos.sh" => "install-hap.sh"', text)
        self.assertIn('file "Patches/multica/0002-hap-packaging.patch"', text)
        self.assertNotIn('module.clean.json5', text)
        self.assertNotIn('apply-branding.py', text)

    def test_only_one_multica_formula_remains(self):
        self.assertEqual(["multica.rb"], sorted(p.name for p in formula.parent.glob("multica*.rb")))

    def test_installer_patch_matches_tested_script(self):
        patch = formula.parents[2] / "Patches/multica/0002-hap-packaging.patch"
        section = patch.read_text().split("diff --git a/scripts/install-hap-ohos.sh ", 1)[1]
        lines = [line[1:] for line in section.splitlines() if line.startswith("+") and not line.startswith("+++")]
        expected = pathlib.Path(__file__).resolve().parents[1] / "scripts/install-hap.sh"
        self.assertEqual(expected.read_text(), "\n".join(lines) + "\n")

    def test_dependency_install_is_frozen(self):
        text = formula.read_text()
        self.assertIn('"--frozen-lockfile"', text)
        self.assertNotIn('"--no-frozen-lockfile"', text)

    def test_no_project_specific_network_retry_policy(self):
        patch = formula.parents[2] / "Patches/multica/0001-desktop-ohos.patch"
        additions = "\n".join(line[1:] for line in patch.read_text().splitlines()
                              if line.startswith("+") and not line.startswith("+++"))
        for setting in ("fetchRetries:", "fetchRetryMintimeout:", "fetchRetryMaxtimeout:", "fetchTimeout:"):
            self.assertNotIn(setting, additions)

    def test_no_duplicate_workspace_maps(self):
        patch = formula.parents[2] / "Patches/multica/0001-desktop-ohos.patch"
        section = patch.read_text().split("diff --git a/pnpm-workspace.yaml ", 1)[1]
        additions = "\n".join(line[1:] for line in section.splitlines()
                              if line.startswith("+") and not line.startswith("+++"))
        self.assertNotIn("overrides:", additions)
        self.assertNotIn("patchedDependencies:", additions)
        package_section = patch.read_text().split("diff --git a/package.json ", 1)[1].split("\ndiff --git ", 1)[0]
        self.assertIn('"@tailwindcss/oxide": "npm:@ohos-npm-ports/tailwindcss-oxide@', package_section)
        self.assertIn('"lightningcss": "npm:@ohos-npm-ports/lightningcss@', package_section)

    def test_checks_both_products(self):
        text = formula.read_text().split('  test do', 1)[1]
        self.assertIn('multica --version', text)
        self.assertIn('multica --help', text)
        self.assertIn('system "unzip", "-tq", hap', text)
        self.assertIn('requestPermissions', text)


unittest.main()
