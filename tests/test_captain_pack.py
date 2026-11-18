"""Captain Illustrated Asset Pack v1: only confirmed assets ship; the rest stay staged."""
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
        self.assertEqual(len(self.assets), 27)
        for entry in self.assets:
            with Image.open(CUT / f"{entry['name']}.png") as img:
                self.assertEqual(img.size, (entry['width'], entry['height']), entry['name'])
            self.assertIn(entry['status'], {'APPROVED', 'LIMITED SIZE', 'NEEDS HI-RES'})
            self.assertTrue((ROOT / entry['source']).exists(), entry['source'])

    def test_originals_are_used_whole(self):
        # Founder's Pack v1 zip: where an original exists it is used at its own size.
        for e in self.assets:
            if '/original/' in e['source']:
                with Image.open(ROOT / e['source']) as src:
                    self.assertEqual((e['width'], e['height']), src.size, e['name'])
        originals = {e['name'] for e in self.assets if '/original/' in e['source']}
        for name in ['captain-peek', 'expr-happy', 'play-watch', 'play-reach', 'play-bat', 'play-rolled', 'captain-reading', 'captain-recap']:
            self.assertIn(name, originals)

    def test_playroom_frames_share_one_canvas(self):
        # Founder addendum v1.1: each sequence plays on one 768x512 canvas and origin.
        frames = [e for e in self.assets if e['name'].startswith(('play-', 'hug-'))]
        self.assertEqual(sorted(e['name'] for e in frames), sorted(
            [f'play-hat-{i}' for i in range(1, 5)] + [f'hug-{i}' for i in range(1, 5)] +
            ['play-watch', 'play-reach', 'play-bat', 'play-rolled']))
        for e in frames:
            self.assertEqual((e['width'], e['height']), (768, 512), e['name'])
            self.assertEqual(e['sourceBox'][2] - e['sourceBox'][0], 768)

    def test_planned_sizes_are_clear_on_a_3x_iphone(self):
        for entry in self.assets:
            self.assertLessEqual(entry['plannedPt'] * 3, entry['width'] * 1.2, entry['name'])

    def test_only_confirmed_assets_ship(self):
        shipped = sorted(e['name'] for e in self.assets if e['shipped'])
        staged = sorted(e['name'] for e in self.assets if not e['shipped'])
        # V10.91: everything the interface uses ships; curious stays staged (unused).
        self.assertEqual(staged, ['captain-awake', 'captain-greeting', 'captain-half', 'captain-reminder', 'expr-curious'])
        self.assertIn('hug-4', shipped)
        for entry in self.assets:
            for folder in ('Public', 'Native/Sources/LittleDaysUI/WebApp'):
                found = list((ROOT / folder).rglob(f"{entry['name']}.png"))
                if entry['shipped']:
                    self.assertEqual(len(found), 1, f"{entry['name']} in {folder}")
                    self.assertEqual(found[0].read_bytes(), (CUT / f"{entry['name']}.png").read_bytes())
                else:
                    self.assertEqual(found, [], f"{entry['name']} in {folder}")

if __name__ == '__main__':
    unittest.main()
