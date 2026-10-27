# Alternative draft screens (prototype, Oct 27 2026)

Owner: "maybe we can try alternative draft interfaces? Idk not sure what I want exactly." So here are three playable
alternatives to compare. Each sits behind a URL flag. With no flag the game is unchanged: the default cards, and no switcher.

| Link | Design |
|---|---|
| `index.html?draftui=versus` | **Versus board**: your side and their side next to each other. Tap an animal to move it across. |
| `index.html?draftui=list` | **Compact list**: one row per animal, with sort and filter. The stat line opens inside the row. |
| `index.html?draftui=deck` | **Deck**: one big card at a time. Take or Leave with the buttons, or swipe. You can go back. |
| `index.html?draftui=1` | Opens whichever design you used last. |

With any `draftui` flag, the draft screen has a **Default · Versus · List · Deck** switcher. Your team stays the same when
you switch. The choice is saved (localStorage `wa-draftui`, and the URL), so a reload keeps it. The flag works alongside the
other flags, e.g. `?progressive=1&draftui=list` or `?five=1&draftui=deck`.

## What each one does

**Versus** (`shots/phone_versus_1_open.png`, `phone_versus_2b_long_team.png`, `desk_versus_2b_long_team.png`). This shows the
game's twist directly: anything you don't pick is against you. At the top is a scoreboard for each side: money, how many
animals, and a **measured value** bar. Measured value is the sum of `A.MEASURED`: how many seconds of survival each animal
added on your side, or cost you on theirs, in the pricing test fights. The page labels it as a rough guide, because the
values don't simply add up. Each tile shows the face, name, price, badges and signature move. ⓘ opens the full stat line in a
dialog. Animals you can't afford are dimmed. Tapping one shows "costs $X: $Y left".

**List** (`phone_list_1_open.png`, `phone_list_2b_long_team.png`). One row per animal, about 62 px tall: face, name, price,
signature (one line), map-fit badges, Rare / ×N, and your own record if you have one. Tap the row to add or remove that
animal. ▾ opens the full stat line inside the row. You can sort by Price ↓ / Price ↑ / Map fit / A–Z. Filter chips:
role (Chargers, Brawlers, Cats, Harriers, Kickers, Lurkers; only the roles on this board appear), "Good on <map>", and
"Affordable". The chips above the list show your team; tap one to drop that animal.

**Deck** (`phone_deck_1_open.png`, `desk_deck_1_open.png`). One big card at a time: portrait, name, price, style, badges,
the signature move in large type, stat bars, mass and speed, your record, and a link to the full stat line. You have
**‹ Back**, **Leave** and **Take $X**. Swipe right to take, left to leave. On a desktop, the ← and → keys do the same. The
buttons stay pinned above the action bar, so you can reach them without scrolling. A strip of faces at the top shows each
card's state: yours has a teal ring, left is grey, not for sale has a red ring. Tap a face to jump to that card. Once you've
seen the last card, a summary card appears.

All three use the same state and rules as the default cards. They change `S.team`, `S.mount` (the default ride is recomputed
the same way) and `S.focus`. Purchases go through `canAdd` or `M.canBuy`. Pack items, rares and the premium enemy behave as
before. Deploy, fight and the sticky action bar are unchanged.

### Progressive shop: all three can host it
- Versus: what you buy moves to your side. Under each of your tiles is its health bar and its own button: **Undo $X** (bought
  this visit), **Sell $X**, or **Heal $X**. The premium enemy sits on their side with a red border and "Not for sale".
  Tapping it opens its stat line. (`phone_versus_4_prog_premium.png`, `phone_versus_6_prog_carried.png`)
- List and Deck: the game's own shop team panel (undo, sell, heal) sits above the list or below the deck. The premium row
  or card says "Not for sale: it fights you". Its only action is Next. (`phone_list_*_prog_*.png`, `phone_deck_*_prog_*.png`)

## Taps and scroll to draft a full team

Measured by `node research/draft_ui/check.js`, using the scripted thumb from `research/ux_audit/audit.js`: it scrolls only
when the target is off screen or under a bar. `Math.random` is fixed, so every design gets the same board. There are two
target teams:
- **Short team**: the priciest affordable animal first. Here that's buffalo herd + gaur + fighting bull, 3 picks, $1,200.
- **Long team**: the cheapest first, 8 picks.

The default cards are the baseline. Each cell is taps / scroll in px.

| Design | 412 phone, short | 412 phone, long | 360 phone, short | 360 phone, long | Desktop, short | Desktop, long | Page height, 412 |
|---|---|---|---|---|---|---|---|
| Default cards | 3 / 707 | 8 / 2,925 | 3 / 943 | 8 / 4,508 | 3 / 411 | 8 / 2,013 | 3,452 |
| Versus | 3 / **0** | 8 / 775 | 3 / 243 | 8 / 1,642 | 3 / 0 | 8 / 335 | 1,989 |
| List | 3 / **0** | 8 / **625** | 3 / 305 | 8 / **1,618** | 3 / 0 | 8 / 562 | **1,697** |
| Deck | 3 / **0** | 12 / **0** | 3 / 0 | 12 / 0 | 3 / 0 | 12 / 0 | **1,297** |

Plus one tap on Fight in every design. Takeaways:
- **The list scrolls least of the "see everything" designs**: 80% less scroll than the default cards on a phone, and the page
  is half as tall.
- **Versus is close to the list on scroll.** Its value is the side-by-side picture of "everything I don't pick fights me". The
  scoreboard costs about 200 px at the top.
- **The deck never scrolls, but costs taps.** You have to Leave the cards you skip. A cheap team means walking past the
  expensive cards first: 12 taps instead of 8. With a short team it's the same 3 taps. It also never shows the whole board at
  once, which makes "what am I leaving them?" harder to judge. The face strip and the scoreboard partly make up for it.

## Checks (all pass)
`node research/draft_ui/check.js` (exits 1 on a failure) checks:
- Each design on all three devices, using real taps:
  - drafts both target teams;
  - starts the fight from the bar;
  - has no page errors and no sideways scroll at 412, 360 or 1200 px.
- In the progressive shop, for each design:
  - buying spends money, and Undo refunds it;
  - the premium enemy shows "Not for sale", and tapping it doesn't buy it;
  - heal and sell work on a wounded animal carried over from an earlier round;
  - Fight works from the bar.
- 5 in a Row and the daily open in each design and fight.
- The switcher keeps the team and remembers the choice.
- Deck: a real touch swipe (CDP touch events) left leaves the card and right takes it.
- With no flag, the default cards show and there is no switcher.

`node research/ux_audit/modes_check.js` (no flag) still passes.

## Code
- Everything is in one `DRAFT_UIS` block in `ui.js`, just above `// ---------- init ----------`, and its CSS is injected from
  there (`DUI_CSS`). That keeps `template.html` untouched while other branches edit ui.js.
- The only line outside the block is in `renderDraft`: `if (draftAlt()) return;`. It runs after the title and lede are set,
  so the five, daily and shop ledes and the hidden buttons work as before.
- The default `#tiers`, `#teamline` and `#detail` are hidden while a prototype is showing, and come back when you switch to
  Default.

## Needs the owner
Play each one, then say which to keep, merge or drop. A few things you could mix: the Versus scoreboard on top of the List;
the List as the phone layout with the default cards on desktop; the Deck as a "first game" tutorial mode. Nothing goes on
the main screen until you pick.
