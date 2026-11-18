# Captain Canonical Visual Identity · Migration Audit (2026-11-18)

Founder decision (2026-11-18): **the illustrated Captain is Capiday's one canonical character identity.** The 3D Captain is a legacy implementation kept only during migration. Every Captain scene will become the illustrated Captain.

## 1. Identity rules

- **Character**: grey long-haired cat; amber / golden eyes; slightly wedge-shaped, a little pointed face; visibly full coat; triangular ears; never a round chibi face; gentle watercolour / editorial illustration.
- **Sources**:
  - **Identity source of truth = real photos of Captain.** The Founder shared two on 2026-11-18. They are not stored in the repo because they are personal photos; the written identity spec is in section 1b.
  - **Art direction = the approved references**: `docs/visual/captain-scenes-v1.png` and `docs/visual/botanical-board-v1.png`.
  - **If the two disagree**: the real Captain's shape wins, and the reference controls the drawing style.
- **Not allowed**: redrawing Captain ourselves, SVG versions, or stand-ins in another style. A missing asset is marked **NEEDS CHARACTER ASSET**.
- **No mixing**: during migration, a module that has switched to the illustrated Captain never also shows the 3D Captain. Modules not migrated yet may stay 3D for now.
- **User data is kept**. Nothing below changes or resets these fields:
  - `keeper.enabled`, `invite`, `animal`, `name`, `mode`, `outfit`, `lastStage`, chat history and the growth data in `state.keeper`;
  - the device log `little-days.captain-stamps`;
  - Playroom preferences.
- **Outfit mapping**: an existing `outfit` (e.g. `lemon`, `yarn`) stays stored even while illustrated outfit art is missing. Later it maps as `outfit` → the illustrated accessory asset with the same id.

## 1b. Identity from the real photos (Founder, 2026-11-18)

The Founder shared two real photos of Captain: a close-up of the face, and Captain lying on its back in a lap. **They are not stored in the repo**: they are personal photos and the lock-screen shot carries personal details. These notes are the written identity spec.

- **Coat**: long, silky, dense, with an obvious ruff. A cool blue-grey with a silver sheen on the hair tips. The chest and belly are fluffier and a little lighter, with a faint warm-beige undertone deep in the fur.
- **Face**: a slight wedge; straight nose bridge; dark slate-grey nose leather; shorter fur on the muzzle. Not round: the cheeks are soft, but the face is not chibi.
- **Eyes**: large and almond-to-round; golden amber (pale gold to yellow-amber), with a thin darker rim at the edge.
- **Ears**: medium to large, upright, triangular, grey, with paler soft tufts inside.
- **Whiskers**: long, white / silver.
- **Paws**: big, grey, with fluffy fur between the toes.
- **Character**: a calm, slightly serious gaze; curious and wide-eyed when surprised.

**Comparison with the approved illustrations** (`captain-scenes-v1`):
- **Already right**: grey long-haired cat, amber eyes, full coat, triangular ears, a slightly pointed face.
- **For future assets** (real shape wins, the reference only sets the style):
  - **Coat colour** a little cooler: blue-grey with a silver sheen, rather than the warmer brown-grey in some scenes.
  - **Eye colour** nearer to pale gold.
  - **Face shape** keeps the wedge.
- **No change to the current approved assets**. They stay APPROVED; the notes above are briefing for the next Asset Pack.

## 2. Captain Illustrated Asset Pack v1 (what exists / what is needed)

Updated 2026-11-18 (evening): the Founder supplied four Pack v1 sheets (transparent PNGs). They are stored in `docs/visual/captain-pack-v1/source-*.png` and cut by `tools/cut_captain_pack.py` into `docs/visual/captain-pack-v1/cut/` with `manifest.json`.
- They are **STAGED**: not in `Public/`, not in the link, not in the iOS shell, until the Founder confirms where each one goes. `tests/test_captain_pack.py` checks this.
- The cut only crops, trims and scales down. Stray pixels with alpha < 10 are cleared; they were invisible anyway. Nothing is redrawn or recoloured.

| Group | Item | Asset now | Pixels | Clear up to (3x) | Status |
|---|---|---|---|---|---|
| Base pose | sitting (with books and seal) | `captain-sit` (scenes v1) | 540×371 | 180 pt | APPROVED · shipped |
| Base pose | sitting, looking up (no props) | `captain-sit-up` (Pack v1) | 540×647 | 180 pt | APPROVED · staged |
| Base pose | lying down, awake, paws forward | `captain-lie` (Pack v1) | 540×640 | 180 pt | APPROVED · shipped V10.90 (welcome card-edge peek) |
| Base pose | sleeping | `captain-sleep` (scenes v1) | 540×306 | 180 pt | APPROVED · shipped |
| Base pose | looking at journal (sprig beside) | `captain-reading` (README: `poses/reading-journal.png`) | 739×514 | 246 pt | APPROVED · staged |
| Base pose | preparing stamp / pressing stamp | `captain-ready` / `captain-stamp` | 540×372 / 540×342 | 180 pt | APPROVED · shipped |
| Base pose | peeking over a card edge | candidate: `captain-lie` (paws forward could rest on the card's top edge) | — | — | Founder to confirm |
| Expression | calm / happy / curious / sleepy | `expr-calm` / `expr-happy` / `expr-curious` / `expr-sleepy` (busts) | 360×422–474 | 120 pt | APPROVED · staged |
| Small format | avatar / bust (28–64 pt) | `captain-face` (front bust) | 360×386 | 120 pt | APPROVED · staged (readable at 28 pt) |
| Accessory | lemon hat | `acc-lemon-hat` (separate piece) | 436×374 | 145 pt | APPROVED · staged; wearing it = layering, see 2b |
| Accessory | yarn ball | `acc-yarn` | 300×276 | 100 pt | APPROVED · staged |
| Interaction | greeting | stand-in: `captain-sit-up` | | | Founder to confirm |
| Interaction | gentle reminder | stand-in: `expr-curious` | | | Founder to confirm |
| Interaction | stamp moment | `captain-stamp` | | | APPROVED · shipped |
| Interaction | weekly recap | entry: `captain-reading`; page: `captain-recap` (lying by an album of landscapes, looking up; README: `interactions/weekly-recap.png`) | 758×613 | 252 pt | APPROVED · staged |
| Interaction | idle | `captain-sit` / `captain-sleep` / `captain-lie` | | | APPROVED |
| Playroom | yarn play, no hat, 4 frames (watch → paw up → paw on ball → ball rolled away) | `play-watch` / `play-reach` / `play-bat` / `play-rolled` (the four 768×512 quadrants of the v1 sheet) | 768×512 each | 256 pt | APPROVED · staged |
| Playroom | yarn play wearing the lemon hat, 4 frames (notice → reach → nudge → settle) | `play-hat-1…4` (Addendum v1.1) | 768×512 each | 256 pt | APPROVED · staged |
| Playroom | hug, no hat, 4 frames (notice the heart cushion → lean in → hug → settle) | `hug-1…4` (Addendum v1.1) | 768×512 each | 256 pt | APPROVED · staged |
| Playroom | hug wearing the lemon hat | — | | | NEEDS CHARACTER ASSET (lemon is the default look) |

## 2b. Pack v1 review notes (2026-11-18)

- **Clarity**: all 13 cuts are APPROVED at their planned size, with no upscaling on a 3x iPhone:
  - avatar 64 pt;
  - busts 96 pt;
  - poses 120–150 pt;
  - Playroom 220 pt.
- **Colour**: the coat is a little darker and slightly warmer than scenes v1. Average fur RGB:
  - scenes v1 `captain-sit` ≈ (159, 141, 127);
  - Pack v1 ≈ (132–146, 110–124, 97–111).
  - Both are warmer than the real-photo spec in section 1b (cool blue-grey with a silver sheen).
  - Not recoloured. Founder decides whether this is fine, or whether the art should be revised.
  - Within one page only one set is used, so the slight difference never sits side by side.
- **Lemon hat**: the hat is a separate piece. Two ways to show `outfit: lemon`:
  - (a) layer `acc-lemon-hat` over each pose with a fixed position per asset; no redrawing, but it is a composition the Founder must approve (see the mockup preview);
  - (b) the Founder supplies hatted variants.
  - Until decided, places that show the outfit stay 3D.
- **Playroom frames**: the yarn ball is painted into each frame. Today's Playroom lets you drag the ball, so with these frames the ball would follow a fixed sequence (tap → the 4 frames play), unless the free ball `acc-yarn` is placed beside a ball-less pose. Founder to choose.
- **Lost capability**: the 3D Home Captain's eyes follow your finger (`data-keeper-follow`). A painted picture cannot do that. Per the rule "remove 3D rendering only when the illustrated set fully replaces each capability", the Founder must accept dropping eye-follow, or keep it 3D.

**Asset specs** for new art:
- Transparent PNG, or paper background (we cut it out).
- At least 3× the display width: a scene about 540 px wide; a bust or avatar at least 200 px.
- One consistent character across all assets, same palette and brush.

## 2c. Playroom Asset Addendum v1.1 (Founder, 2026-11-18)

Received as `Captain-Playroom-Asset-Addendum-v1.1.zip`. Stored in `docs/visual/captain-pack-v1.1/`; the Founder's own notes are in `README-founder.md`. Cut with the pack by `tools/cut_captain_pack.py` into `docs/visual/captain-pack-v1/cut/`. **Staged, not shipped.**

- **Frames**: 8 transparent PNGs, 768×512, on one shared canvas and origin.
  - Within each sequence Captain's left edge and baseline do not move (checked by bounding box).
  - The cut keeps the whole canvas: no trim, no resize. The stray near-invisible specks (alpha < 10) are cleared.
  - The four v1 no-hat yarn frames are now cut the same way, as the exact 768×512 quadrants of `source-play.png`. They were trimmed to 708–720 px before, which would have made the sequence jitter.
- **Playback (Founder)**:
  - One tap plays one round and stops on the last frame; tapping again replays it.
  - Timings: yarn 160 / 130 / 130 / 360 ms; hug 180 / 150 / 220 / 420 ms.
  - Fixed container size and alignment, `contain`, no per-frame crop, scale or re-alignment.
  - The lemon hat is painted into the hat frames. No-hat yarn play uses v1 `playroom/01–04`.
- **Clarity**: 768 px is sharp up to 256 pt on a 3x iPhone.
  - Today's Playroom stage is square, up to about 330 pt wide.
  - Holding the frame box at ≤ 256 pt keeps the frames APPROVED. Filling the whole stage width would be about 1.3× upscale (LIMITED SIZE, a little soft).
- **Frame-to-frame variation**: the art itself differs slightly between frames even in still areas (tail, about 6–7 levels on average). Our quantization adds about 0.3. The fur may "breathe" a little between frames; that comes from the art, not the cut.

**Mapping to today's 3D Playroom** (`keeperPlayHTML`, `library.json` → `keeperPlay`):

| Today (3D) | With v1 + v1.1 | Gap |
|---|---|---|
| Lemon look (default): idle photo; drag or tap the separate yarn ball → Captain catches → 6-frame hug-with-hat animation (×2) | Tap → `play-hat-1…4`, stops on frame 4 | The ball is painted into the frames, so **dragging the ball goes away** (the README asks for tap-to-play) |
| Lemon look: poke Captain → the same hug-with-hat animation | Poke → `hug-1…4` | **The hug frames have no hat**: with the default lemon look, the hat would vanish during the hug → NEEDS CHARACTER ASSET (hug wearing the lemon hat) |
| Yarn look: idle picture only, a small hop when poked | Tap → `play-watch…play-rolled`; poke → `hug-1…4` | none |
| Reduced motion: shows the still frame | Show the last frame directly | none |
| Idle (before any tap) | Frame 1 of the sequence | none |

**Files the Founder's README refers to that we never received** (only four sheet images of Pack v1 reached us, not a structured pack):
- `poses/reading-journal.png` and `interactions/weekly-recap.png`: received later the same day in the chat, as transparent WebP (768×547, 768×640). Stored as `source-reading-journal.webp` and `source-weekly-recap.webp` and cut to `captain-reading` and `captain-recap`. The original PNGs would be slightly better: the chat delivers WebP, about 1 level of difference elsewhere.
- `poses/card-edge-peek.png`: stand-in in use is `captain-lie`, cut from the lying sheet.
- `expressions/happy.png`: stand-in in use is `expr-happy`, cut from the expressions sheet.
- `playroom/01–04.png`: stand-in is the quadrants of the play sheet (the same art).

If the Founder sends the structured v1 pack, the cuts are swapped for the exact files.

## 3. Where Captain appears today (audit)

Status values:
- **READY TO MIGRATE**: the approved asset exists and there is no outfit or animation dependency.
- **NEEDS CHARACTER ASSET**: blocked only by missing art.
- **KEEP TEMPORARILY**: stays 3D until its phase.
- **BLOCKED**: depends on another system being migrated first.
- **MIGRATED**: already illustrated.

| # | Screen / component (code) | Now | Interaction dependency | Outfit dependency | Animation dependency | Phase | Illustrated asset needed | Safe now? | Status |
|---|---|---|---|---|---|---|---|---|---|
| 1 | My Books · Captain / My Cat default cover (`personal-ui.mjs` capiday-captain → `coverArt("captain")`) | Illustration `captain-sit` | none | none | none | 1 | — | — | **MIGRATED** |
| 2 | Stamp page · empty month (`stampsPage` `.sp-empty-art`) | Illustration `captain-sit` | none | none | none | 1 | — | — | **MIGRATED** |
| 3 | Botanical decorative vignettes (`botanicals.mjs` `captainVignette`) | Illustration | none | none | none | 1 | — | — | **MIGRATED** |
| 4 | Home · Captain invitation card (`keeperInviteHTML`, Captain still off) | Illustration `captain-sit` | buttons only | none (Captain not chosen yet) | none | 1 | greeting (stand-in: sit) | — | **MIGRATED** |
| 5 | First-stamp moment pill (`stampMoment` `.sm-captain`) | Illustration `captain-stamp` | none | 3D version showed the outfit; now no outfit (state kept) | `captain-press` CSS (works with the picture) | 2 | (lemon-hat variant later) | — | **MIGRATED** |
| 6 | First-page card after the first page (`fp-art`, `keeperArt("happy")`) | Illustration `expr-happy` (V10.89) | close button only | shows outfit | none | 1 | `expr-happy` (staged) or `captain-stamp` | yes | **MIGRATED** |
| 7 | Captain onboarding · intro (`openKeeperOnboarding` `.keeper-intro`, `keeperImage` idle) | Illustration `captain-sit-up` (V10.89) | none (static) | none (before choosing) | none | 1 | greeting / sitting | yes (`captain-sit` now, or `captain-sit-up` once confirmed) | **MIGRATED** |
| 8 | Home guide (3-step tour) · Captain steps (`.hg-captain`, welcome / invite) | Illustration: welcome `captain-sit-up`, invite `expr-happy` (V10.89) | none | shows outfit if chosen | none | 1 | greeting / happy (stand-in: sit) | yes for the large picture (`captain-sit`) | **MIGRATED** |
| 9 | Home guide · small avatar (`.hg-avatar`, ~28 pt) | Illustration `captain-face` (V10.89) | none | shows outfit | none | 1 | avatar / bust: `captain-face` (staged) | yes once confirmed (outfit not shown until the lemon-hat decision) | **MIGRATED** |
| 10 | Page-save stamp burst (`keeperStamp`, happy + ✓) | Illustration `captain-stamp` (V10.89) | none | shows outfit | pop-in CSS | 2 | stamp moment (`captain-stamp`) | yes, but outfit no longer shown (state kept) | **MIGRATED** |
| 11 | Home · Captain on the today card (`keeperPerchHTML`, peek) | 3D peek | tap → panel; speech bubble; Captain tag; growth line | shows lemon hat / yarn | `k-peek` entrance; eye follow (`data-keeper-follow`) | 2 | peek-over-card pose + calm / happy + lemon-hat variants | not yet: needs the Founder to confirm `captain-lie` as the perch pose, the lemon-hat way (2b), and dropping eye-follow | **WAITING ON FOUNDER DECISIONS** · KEEP TEMPORARILY |
| 12 | Captain panel header and notes (`kp-head`, `kp-note`: idle / happy) | 3D | panel navigation (Today / Organize / Memories / Looks / Play) | shows outfit | none | 2 | avatar / bust + calm / happy / curious | art exists (`captain-face`, `expr-*`); outfit display waits on the lemon-hat decision | **WAITING ON FOUNDER DECISIONS** · KEEP TEMPORARILY |
| 13 | Feedback reply sheet (`keeper-sheet-head`, encouraging) | Illustration `expr-happy` (V10.89; outfit not drawn, state kept) | sheet | shows outfit | none | 2 | happy / encouraging bust | art exists (`expr-happy`); outfit waits on the lemon-hat decision | **MIGRATED** |
| 14 | Reader · "Ask Captain" button art (`keeper-ask-art`, encouraging) | Illustration `captain-face` (V10.89; outfit not drawn, state kept) | button | shows outfit | none | 2 | small avatar | art exists (`captain-face`); outfit waits on the lemon-hat decision | **MIGRATED** |
| 15 | Bookshelf Captain (`keeperShelfHTML`, idle / sleepy at night) | 3D | tap → line | shows outfit | none | 2 | sitting + sleeping with outfit variants | sit / sleep / lie exist; outfit waits on the lemon-hat decision | **NEEDS CHARACTER ASSET** · KEEP TEMPORARILY |
| 16 | Settings · Captain card preview and Captain management profile (`keeper-card`, `keeper-profile`) | 3D idle | opens management | shows the chosen outfit (preview) | none | 2 | avatar / bust with outfit variants | art exists (`captain-face`); preview must show the outfit → lemon-hat decision | **WAITING ON FOUNDER DECISIONS** · KEEP TEMPORARILY |
| 17 | Reminders / guidance (Captain prompt bubble on Home; daily reminder notification) | Text only (bubble sits on the 3D perch) | — | — | — | 2 | gentle reminder | stand-in `expr-curious` if the Founder agrees | **NEEDS CHARACTER ASSET** (or stand-in) |
| 18 | Weekly recap (week card / week page; Captain panel look-back row) | No Captain today | — | — | — | 2 | weekly recap: `captain-reading` / `captain-recap` (staged) | needs the Founder to confirm the placement: a new placement, not a swap | **READY AFTER CONFIRMATION** (`captain-reading` for the week card entry, `captain-recap` for the week page) |
| 19 | Captain panel · Looks / dress-up chips (`keeperLooksHTML`) | 3D per outfit | choose outfit (writes `keeper.outfit`) | core | none | 3 | lemon hat + yarn for the chip pose | no | **BLOCKED** (accessories exist now; waits on the lemon-hat decision, then panel #12) |
| 20 | Playroom (`keeperPlayHTML`: play idle, hug animation frames, yarn ball) | 3D photos / frames | drag / tap yarn ball, poke → happy | lemon / yarn sets (`keeperPlay`) | sprite frames, reduce-motion fallback | 3 | Playroom frames + yarn ball in the illustrated style | no | **KEEP TEMPORARILY** · assets nearly complete (v1 + v1.1: yarn no hat, yarn with hat, hug no hat); missing: hug wearing the lemon hat; dragging the ball is replaced by tap-to-play (Founder README). Waits on the Founder to migrate Playroom now (it was planned last) |
| 21 | `keeperMiniHTML` (`.keeper-mini`) | 3D (defined, not rendered anywhere) | — | — | — | — | — | — | KEEP TEMPORARILY (dead code; remove once 3D rendering is retired) |

**V10.89 (Founder: 「可以放」, 2026-11-18)**:
- `captain-face`, `captain-sit-up` and `expr-happy` now ship in `Public/captain/`; the other 10 Pack v1 cuts stay staged.
- #6–#10 are migrated (Phase 1 complete).
- #13 and #14 are migrated too: they appear in the reader, next to the illustrated save stamp (#10) and first-stamp pill (#5), so the reader shows only one Captain.
- Outfits are not drawn in these places; `keeper.outfit` is untouched.
- Still waiting on the Founder: the lemon-hat approach, eye-follow, Playroom mode and coat colour (section 2b). Until then #11, #12, #15, #16, #19 and #20 stay 3D.

**V10.90 (Founder, 2026-11-18)**:
- The Home guide's welcome uses `captain-lie` as the card-edge peek: both front paws rest on the card's top edge, head and ears above it.
- The Founder named the file `poses/card-edge-peek.png`. No file by that name exists in the pack, so `captain-lie` (the paws-forward pose) is used for it.
- The invitation keeps `expr-happy`.

**Mixing check today**:
- Home without Captain shows only the illustrated invitation.
- Home with Captain on shows the 3D perch. The illustrated first-stamp pill can appear at the same moment, which is a known temporary mix; it ends with Phase 2 (#11).
- The empty-month page and the covers are illustrated only.
- V10.89: the reader is illustrated only (save stamp, first-stamp pill, Ask Captain, reply). Onboarding dialogs (first-page card, Captain intro) are illustrated only.
- Replaying the Home guide with Captain on shows the illustrated guide over the shaded Home, with the 3D perch dimmed behind it. This is the same temporary mix as above, and it ends with #11.

## 4. Migration order

1. **Phase 1, static scenes.** Done: #1–#4 (V10.88) and #6–#9 (V10.89).
2. **Phase 2, light interaction.**
   - Done: #5 (V10.88), #10, #13 and #14 (V10.89).
   - #11–#18 need peek / bust / expressions / reminder / recap art, plus lemon-hat variants for anything that shows the outfit today.
3. **Phase 3, last.** #19–#20 (outfits, expression animation, Playroom, yarn ball). Remove 3D rendering only when the illustrated set fully replaces each capability.
