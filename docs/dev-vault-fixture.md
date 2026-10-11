# Gridlock Tables -- dev fixture

Use this note to manually verify Live Preview and Reading view behavior.
Copy it into your Obsidian vault as `gridlock-dev-fixture.md`.

## Narrow table (fits in readable column)

| ID | Status | Owner |
|----|--------|-------|
| 1  | Open   | Alice |
| 2  | Closed | Bob   |
| 3  | Open   | Carol |

## Wide table (should break out of readable column, not scroll until past pane)

| Feature | Phase | Priority | Owner | Status | Notes | ETA | Reviewer | Ticket | Branch |
|---------|-------|----------|-------|--------|-------|-----|----------|--------|--------|
| Auto-size columns | 1 | High | Alice | In progress | CSS only first | 2026-Q1 | Bob | #12 | feat/auto-size |
| Overflow scroll | 1 | High | Bob | Done | Per-table only | 2026-Q1 | Alice | #13 | feat/scroll |
| Drag resize | 2 | Medium | Carol | Planned | LP + RV parity | 2026-Q2 | Alice | #20 | feat/resize |
| Auto-fit on dbl-click | 2 | Medium | Alice | Planned | ch units | 2026-Q2 | Bob | #21 | feat/auto-fit |
| Pin widths (HTML comment) | 2 | Medium | Bob | Planned | portable | 2026-Q2 | Carol | #22 | feat/pin |

## Overflow table (wider than pane -- should scroll inside itself)

| Col A | Col B | Col C | Col D | Col E | Col F | Col G | Col H | Col I | Col J | Col K | Col L | Col M | Col N | Col O |
|-------|-------|-------|-------|-------|-------|-------|-------|-------|-------|-------|-------|-------|-------|-------|
| alpha with a moderately long value here | beta with a moderately long value here | gamma with a moderately long value here | delta with a moderately long value here | epsilon with a moderately long value here | zeta with a moderately long value here | eta with a moderately long value here | theta with a moderately long value here | iota with a moderately long value here | kappa with a moderately long value here | lambda with a moderately long value here | mu with a moderately long value here | nu with a moderately long value here | xi with a moderately long value here | omicron with a moderately long value here |
| 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 |
