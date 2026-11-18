"""Captain Illustrated Asset Pack v1 stays staged until the Founder confirms."""
import json
from pathlib import Path
import unittest

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CUT = ROOT / 'docs/visual/captain-pack-v1/cut'


class CaptainPackTests(unittest.TestCase):
    def setUp(self):
        self.assets = json.loads((CUT / 'manifest.json').read_text(encoding='utf-8'))['assets']

    def test_every_cut_matches_its_manifest_entry(self):
        self.assertEqual(len(self.assets), 13)
        for entry in self.assets:
            with Image.open(CUT / f"{entry['name']}.png") as img:
                self.assertEqual(img.size, (entry['width'], entry['height']), entry['name'])
            self.assertIn(entry['status'], {'APPROVED', 'LIMITED SIZE', 'NEEDS HI-RES'})
            self.assertTrue((ROOT / entry['source']).exists(), entry['source'])

    def test_planned_sizes_are_clear_on_a_3x_iphone(self):
        for entry in self.assets:
            self.assertLessEqual(entry['plannedPt'] * 3, entry['width'] * 1.2, entry['name'])

    def test_staged_pack_is_not_shipped_before_confirmation(self):
        for entry in self.assets:
            self.assertFalse(entry['shipped'])
            for folder in ('Public', 'Native/Sources/LittleDaysUI/WebApp'):
                self.assertEqual(list((ROOT / folder).rglob(f"{entry['name']}.png")), [], f"{entry['name']} in {folder}")


if __name__ == '__main__':
    unittest.main()
