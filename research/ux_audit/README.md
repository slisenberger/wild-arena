# Mobile UX audit (Oct 27, 2026)

Owner's ask: "full mobile ux audit with screenshots. Make this game snappy to replay and navigate. Not clumsy."

**How it was measured.** `node research/ux_audit/audit.js <before|after> [index.html]` walks every flow in Playwright
on a 412×915 phone (DPR 2.6, touch), a 360×780 phone and a 1200×900 desktop, with `Math.random` fixed so both phases
deal the same boards. A scripted thumb taps each control and scrolls only when the control is off screen (or under
the sticky header or action bar), so it counts taps and scroll distance. The deploy drag uses real touch events
through CDP. `before/` is the `origin/main` build, `after/` is this branch. Screenshots are `<device>_<step>.png`
(`_full` = the whole page). `node research/ux_audit/modes_check.js` checks the hidden modes, the daily, and share links
end to end through the new bar.

## Core loop: before → after

Taps / scroll distance (px). Fight = the first time the animals are released; result = the banner is showing.

| Step | 412 phone | 360 phone | Desktop |
|---|---|---|---|
| Open → first fight | 6 / 2,929 → **5 / 495** | 6 / 3,931 → **5 / 681** | 6 / 1,717 → **5 / 449** |
| … → see the result | 7 → **6** (16× → Skip) | 7 → **6** | 7 → **6** |
| … → play again, same board | 8 → **7**, no extra scroll | 8 → **7** | 8 → **7** |
| Result → new board → fight | 7 / 8,744 → **5 / 1,116** | 7 / 9,749 → **5 / 1,402** | 7 / 4,721 → **5 / 1,030** |
| Wait for a full 5:00 fight's result | 150 s at the default 2×; 19 s at 16× → **instant** (Skip) | same | same |

The remaining scroll is the cards themselves (picking 3 animals from 12). Every "next step" button is now on screen
at all times. Other checks, after: no page errors on any device; horizontal overflow at 360 px went from 3 px to 0;
the shared link `#g=1,m:river,b:1234` opens the draft on that board; `?five=1` and `?migration=1` both play through.

## Findings, ranked by impact on "snappy to replay and navigate"

1. **No one-tap replay from the result (fixed).** The result banner only had "Copy link". "Rematch, new seed" sat
   under the canvas, and a new board took Draft step → scroll ~2,500 px to "Deal a new board" → scroll back up to the
   cards → scroll ~3,000 px down to "Set formation" → "Release". *Before:* `before/phone_07_result_full.png`.
   *Fix:* the banner now has **Play again** (same board and team, new fight seed; the daily keeps today's seed),
   **Change team** and **New board**, and the action bar shows the same three. *After:* `after/phone_07_result.png`.
2. **The primary action is always below the fold on a phone (fixed).** "Draft your team" sat at y = 1,099 on a
   915 px screen. "Set formation" sat at y = 3,310, below all the cards and the detail panel. "Release the animals"
   sat below the map on 360 px. *Before:* `before/phone_01_arena_full.png`, `before/phone_02_draft_full.png`.
   *Fix:* a **sticky bottom action bar** with the next step: arena → *Draft your team / Daily*; draft →
   *$ spent / picks · Formation · Fight*; deploy → *Auto · Release the animals*; fight → *Skip to result*; result →
   *Team · New board · Play again*. In Migration and 5 in a Row it mirrors the banner's own button ("Continue
   migration", "Retry this board"). It hides on the Migration hub and in the Lab. The inline copies of the three
   primary buttons hide while the bar is up, so nothing shows twice. *After:* `after/phone_03_draft_picked.png`.
3. **The formation step was mandatory (fixed).** Most players never drag, and auto formation is already the default
   placement. *Fix:* **Fight** goes straight from the draft (auto formation). **Formation** stays one tap away in the
   bar and in the steps.
4. **No way to skip to the result (fixed).** The default speed is 2×, so a full 5:00 fight is 2.5 minutes of
   watching; 16× still takes 19 s. *Fix:* a **Skip to result** button (in the bar and beside Pause). The speed you
   pick is now remembered (`wa-speed`, per device).
5. **Arena screen too tall (fixed).** Four terrain cards with long blurbs pushed the page to 1,283 px. *Fix (phones):*
   the cards show just the swatch and the name, and the picked terrain's blurb sits under the grid. Height went from
   1,283 to 915 px, so the whole screen fits. *After:* `after/phone_01_arena.png`.
6. **Deploy puts the map below the instructions (fixed).** On 360 px the map started 650 px down. *Fix (phones):* the
   map comes first, then the buttons, the mount picker, and the instructions. *After:* `after/phone_04_deploy.png`.
7. **Small tap targets (mostly fixed).** The checkboxes were 13 px. The speed buttons were 37×34 px. Buttons were
   42 px tall. The scrub bar was 16 px. The credits link was 18 px, the stats summary 22 px, the "replay" links 16 px,
   and the mount chips 40 px. *Fix:* all of these are now ≥ 44 px (the scrub bar is 30 px). The fight screen went from
   20 under-44 px controls to 10. *Left:* the step pills are 38 px. Making them taller would grow the sticky header,
   and the action bar now does their job.
8. **The draft jumped under your thumb (fixed).** The first pick swapped the "No animals drafted yet" line for the
   team chips, which shifted the card you tapped by 4–20 px. *Fix:* after each pick the tapped card stays put on
   screen (measured 0 px shift on all three devices).
9. **Header too tall, and the budget wrapped at 360 px (fixed).** At 360 px the "/ $1,200" text caused the 3 px
   horizontal scroll. *Fix (phones):* the title is smaller, the meter cells are narrower and "/ $1,200" is hidden
   (the meter and the bar still show it). Title and budget now share one row.
10. **Draft cards are long (partly fixed).** Each card is ~280–300 px tall, so 12 cards make a 3,500 px page.
    *Fix (401–560 px):* the face sits beside the name. Cards are ~45 px shorter and the draft is 3,503 → 3,188 px.
    Narrower phones keep the stacked layout, because names like "Fighting Bull" broke mid-word. *Left for the owner:*
    see "Needs a call".
11. **Coming back to the draft lost your place (fixed).** Every screen change scrolled to the top. *Fix:* returning to
    the same board restores where you were in the draft (Team / Change team after a fight).
12. **Image credits table cut off on phones (fixed).** Columns now wrap instead of scrolling sideways.

Fine as they were: the touch drag on the deploy map works and doesn't scroll the page. Loading takes ~0.4–0.6 s.
Screen changes have no transitions to wait on. Share links open straight into the draft with a notice. The Lab has
no phone issues.

## Needs a call (owner)
- **Compact draft cards on phones.** Hide the four stat bars behind the detail panel and show one line (mass ·
  speed · signature). That would cut the draft roughly in half. It drops information from the cards, so it's your
  call. Recommendation: try it behind a flag.
- **Detail panel placement.** Tapping a card updates the detail panel at the very bottom of the draft, out of sight
  on a phone. Option: a long-press on a card opens it as a bottom sheet.
- **Default playback speed.** It stays 2×, but the last speed you picked is now remembered. Option: default to 4× on
  phones.

## Code
CSS: the "mobile UX pass" block in `template.html`. JS: the "action bar + one-tap replay" section in `ui.js`. Hooks
elsewhere are small: `go()` saves and restores the draft scroll and calls `renderActBar()`, the result banner's button
row gained three buttons, `renderAll()` and the frame loop call `renderActBar()` (it re-renders only when its state
key changes), and the arena fills `#terrainDesc`. No sim.js or rules changes.
