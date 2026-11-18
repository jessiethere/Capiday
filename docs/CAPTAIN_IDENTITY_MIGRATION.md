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

| Group | Item | Asset now | Status |
|---|---|---|---|
| Base pose | sitting | `captain-sit` (540×371) | APPROVED |
| Base pose | lying down (awake) | — | NEEDS CHARACTER ASSET |
| Base pose | sleeping | `captain-sleep` (540×306), asleep on the books | APPROVED |
| Base pose | looking at journal | — | NEEDS CHARACTER ASSET |
| Base pose | preparing stamp | `captain-ready` (540×372) | APPROVED |
| Base pose | pressing stamp | `captain-stamp` (540×342) | APPROVED |
| Base pose | peeking over a card edge (Home today card) | — | NEEDS CHARACTER ASSET |
| Expression | calm | — (no consistent expression set; `captain-sit` is calm / looking up, but it is a scene) | NEEDS CHARACTER ASSET |
| Expression | happy | — | NEEDS CHARACTER ASSET |
| Expression | curious | — | NEEDS CHARACTER ASSET |
| Expression | sleepy | — (only the full sleeping scene) | NEEDS CHARACTER ASSET |
| Small format | avatar / bust (panel header, guide, settings, small buttons; 28–64 pt) | — | NEEDS CHARACTER ASSET |
| Accessory | lemon hat (for every pose and expression used) | — | NEEDS CHARACTER ASSET |
| Accessory | yarn ball | — | NEEDS CHARACTER ASSET |
| Interaction | greeting | — (stand-in until it exists: `captain-sit`) | NEEDS CHARACTER ASSET |
| Interaction | gentle reminder | — | NEEDS CHARACTER ASSET |
| Interaction | stamp moment | `captain-stamp` | APPROVED |
| Interaction | weekly recap | — (looking at the journal) | NEEDS CHARACTER ASSET |
| Interaction | idle | `captain-sit` / `captain-sleep` | APPROVED |
| Playroom | idle, play and hug frames, yarn-ball play | — | NEEDS CHARACTER ASSET |

**Asset specs** for new art:
- Transparent PNG, or paper background (we cut it out).
- At least 3× the display width: a scene about 540 px wide; a bust or avatar at least 200 px.
- One consistent character across all assets, same palette and brush.

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
| 6 | First-page card after the first page (`fp-art`, `keeperArt("happy")`) | 3D happy | close button only | shows outfit | none | 1 | happy expression or `captain-stamp` | yes, with `captain-stamp` (no happy expression yet) | **READY TO MIGRATE** |
| 7 | Captain onboarding · intro (`openKeeperOnboarding` `.keeper-intro`, `keeperImage` idle) | 3D idle | none (static) | none (before choosing) | none | 1 | greeting / sitting | yes (`captain-sit`) | **READY TO MIGRATE** |
| 8 | Home guide (3-step tour) · Captain steps (`.hg-captain`, welcome / invite) | 3D idle / happy | none | shows outfit if chosen | none | 1 | greeting / happy (stand-in: sit) | yes for the large picture (`captain-sit`) | **READY TO MIGRATE** |
| 9 | Home guide · small avatar (`.hg-avatar`, ~28 pt) | 3D idle | none | shows outfit | none | 1 | avatar / bust | no (a scene at 28 pt is unreadable) | **NEEDS CHARACTER ASSET** |
| 10 | Page-save stamp burst (`keeperStamp`, happy + ✓) | 3D happy | none | shows outfit | pop-in CSS | 2 | stamp moment (`captain-stamp`) | yes, but outfit no longer shown (state kept) | **READY TO MIGRATE** (Phase 2) |
| 11 | Home · Captain on the today card (`keeperPerchHTML`, peek) | 3D peek | tap → panel; speech bubble; Captain tag; growth line | shows lemon hat / yarn | `k-peek` entrance; eye follow (`data-keeper-follow`) | 2 | peek-over-card pose + calm / happy + lemon-hat variants | no | **NEEDS CHARACTER ASSET** · KEEP TEMPORARILY |
| 12 | Captain panel header and notes (`kp-head`, `kp-note`: idle / happy) | 3D | panel navigation (Today / Organize / Memories / Looks / Play) | shows outfit | none | 2 | avatar / bust + calm / happy / curious | no | **NEEDS CHARACTER ASSET** · KEEP TEMPORARILY |
| 13 | Feedback reply sheet (`keeper-sheet-head`, encouraging) | 3D | sheet | shows outfit | none | 2 | happy / encouraging bust | no | **NEEDS CHARACTER ASSET** |
| 14 | Reader · "Ask Captain" button art (`keeper-ask-art`, encouraging) | 3D | button | shows outfit | none | 2 | small avatar | no | **NEEDS CHARACTER ASSET** |
| 15 | Bookshelf Captain (`keeperShelfHTML`, idle / sleepy at night) | 3D | tap → line | shows outfit | none | 2 | sitting + sleeping with outfit variants | sit / sleep exist; outfits do not | **NEEDS CHARACTER ASSET** · KEEP TEMPORARILY |
| 16 | Settings · Captain card preview and Captain management profile (`keeper-card`, `keeper-profile`) | 3D idle | opens management | shows the chosen outfit (preview) | none | 2 | avatar / bust with outfit variants | no | **NEEDS CHARACTER ASSET** · KEEP TEMPORARILY |
| 17 | Reminders / guidance (Captain prompt bubble on Home; daily reminder notification) | Text only (bubble sits on the 3D perch) | — | — | — | 2 | gentle reminder | no | **NEEDS CHARACTER ASSET** |
| 18 | Weekly recap (week card / week page; Captain panel look-back row) | No Captain today | — | — | — | 2 | weekly recap / looking at journal | no | **NEEDS CHARACTER ASSET** |
| 19 | Captain panel · Looks / dress-up chips (`keeperLooksHTML`) | 3D per outfit | choose outfit (writes `keeper.outfit`) | core | none | 3 | lemon hat + yarn for the chip pose | no | **BLOCKED** (accessory assets, then panel #12) |
| 20 | Playroom (`keeperPlayHTML`: play idle, hug animation frames, yarn ball) | 3D photos / frames | drag / tap yarn ball, poke → happy | lemon / yarn sets (`keeperPlay`) | sprite frames, reduce-motion fallback | 3 | Playroom frames + yarn ball in the illustrated style | no | **BLOCKED** · KEEP TEMPORARILY (migrates last) |
| 21 | `keeperMiniHTML` (`.keeper-mini`) | 3D (defined, not rendered anywhere) | — | — | — | — | — | — | KEEP TEMPORARILY (dead code; remove once 3D rendering is retired) |

**Mixing check today**:
- Home without Captain shows only the illustrated invitation.
- Home with Captain on shows the 3D perch. The illustrated first-stamp pill can appear at the same moment, which is a known temporary mix; it ends with Phase 2 (#11).
- The empty-month page and the covers are illustrated only.

## 4. Migration order

1. **Phase 1, static scenes.** Done: #1–#4. Ready now: #6, #7 and #8 (large picture). #9 needs an avatar.
2. **Phase 2, light interaction.**
   - #5 is done; #10 is ready.
   - #11–#18 need peek / bust / expressions / reminder / recap art, plus lemon-hat variants for anything that shows the outfit today.
3. **Phase 3, last.** #19–#20 (outfits, expression animation, Playroom, yarn ball). Remove 3D rendering only when the illustrated set fully replaces each capability.
