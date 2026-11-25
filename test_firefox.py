"""Quiet Link Firefox/AMO build — acceptance tests (stdlib only).

TDD RED first: these fail while the Firefox build does not exist.
The XPI is a ZIP with the Firefox manifest at its root, so AMO can sign it
without any paid step. No file in this product makes a network call.
"""
import json
import unittest
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
XPI = ROOT / "dist" / "quiet-link-1.0.0-fx.xpi"
FX_MANIFEST = ROOT / "firefox_manifest.json"


class FirefoxBuild(unittest.TestCase):
    def _names(self):
        self.assertTrue(XPI.is_file(), "missing " + str(XPI))
        with zipfile.ZipFile(XPI) as z:
            return set(z.namelist())

    def test_xpi_exists(self):
        self.assertTrue(XPI.is_file(), "missing " + str(XPI))

    def test_manifest_source_exists(self):
        self.assertTrue(FX_MANIFEST.is_file(), "missing " + str(FX_MANIFEST))

    def test_xpi_has_manifest_at_root(self):
        self.assertIn("manifest.json", self._names())

    def test_manifest_is_v3_with_gecko_id(self):
        m = json.loads(FX_MANIFEST.read_text(encoding="utf-8"))
        self.assertEqual(m.get("manifest_version"), 3)
        gecko = m.get("browser_specific_settings", {}).get("gecko", {})
        self.assertTrue(gecko.get("id"), "gecko id required for AMO signing")
        self.assertTrue(gecko.get("strict_min_version"), "min Firefox version required")

    def test_no_host_permissions(self):
        m = json.loads(FX_MANIFEST.read_text(encoding="utf-8"))
        self.assertNotIn("host_permissions", m)
        allowed = {"activeTab", "storage", "contextMenus",
                   "notifications", "clipboardWrite", "scripting"}
        self.assertTrue(set(m.get("permissions", [])) <= allowed)

    def test_module_background_present(self):
        m = json.loads(FX_MANIFEST.read_text(encoding="utf-8"))
        bg = m.get("background", {})
        self.assertTrue(bg.get("scripts") or bg.get("service_worker"))

    def test_xpi_manifest_matches_source(self):
        m = json.loads(FX_MANIFEST.read_text(encoding="utf-8"))
        with zipfile.ZipFile(XPI) as z:
            self.assertEqual(json.loads(z.read("manifest.json")), m)

    def test_xpi_contains_runtime_files(self):
        need = {"background.js", "popup.html", "popup.js", "core/link.js",
                "icons/icon16.png", "icons/icon48.png", "icons/icon128.png",
                "LICENSE"}
        missing = need - self._names()
        self.assertFalse(missing, "missing from XPI: " + ", ".join(sorted(missing)))

    def test_no_remote_urls_in_manifest(self):
        text = FX_MANIFEST.read_text(encoding="utf-8")
        self.assertNotIn("http://", text)
        self.assertNotIn("https://", text)


if __name__ == "__main__":
    unittest.main(verbosity=2)
