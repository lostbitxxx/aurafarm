# Shop and inventory plan

Review these files before any of this is built. Each phase is one file. Implement a phase only after the phase it depends on meets that file's "Done when".

This set does not replace [the study-session plan](../../PLAN.md). Study sessions, the Electron pet, and the Godot web mini-game stay as they are. Godot scenes and the Electron sprite are out of this set.

## Settled decisions

- The spendable balance is `profiles.points`. It is shown on every signed-in page. `/`, `/login`, `/register`, and `/privacy` stay without it.
- `study_scores.points` is a different number. A finished study session still stores 100 for focused and 40 for distracted. Those rows are not added to `profiles.points` in this set. Earning wallet points from a study session is a later project.
- Every shop pet costs 100. The starter `baby_slime` stays free and is not listed for sale.
- One `user_pets` row per pet type per user. Buying a type the user already owns is rejected.
- New accounts start with 100 points, enough to buy one pet. Adding the column also sets existing profiles to 100.
- The equipped row is the only source of truth. `aurafarm://session?code=…` does not name a user or a pet. The desktop pet loads `user_pets` where `is_desktop_active` is true, using that user's own session. Row-level security hides every other user's rows.
- Every new page requires a session. The proxy redirects an anonymous request to `/login`, and the page loader calls `getClaims()` and redirects before reading `profiles` or `user_pets`.
- The service-role key stays on the server. The desktop pet keeps using the publishable key and the signed-in user's session.

## Phases

| Phase | Plan | Depends on | Outcome |
| --- | --- | --- | --- |
| 0 | [RPG restyle](00-rpg-redesign.md) | current desk | The existing pages look like a modern 2D RPG menu |
| 1 | [Points and purchase](01-points-and-purchase.md) | 0 | `profiles.points`, a catalog, and one purchase transaction |
| 2 | [Points in the header](02-points-header.md) | 1 | Signed-in pages show the balance |
| 3 | [Shop](03-shop.md) | 1, 2 | `/shop` sells catalog pets for 100 points |
| 4 | [Inventory](04-inventory.md) | 1, 2 | `/inventory` lists owned pets and equips one |
| 5 | [Equipped pet on the session link](05-equipped-pet-on-session.md) | 4 | Opening a study session still shows that user's equipped pet |
| 6 | [Tests](06-tests.md) | 1–5 | `npm test` locks the wallet, the purchase, the guards, and the launch link |

Phase 0 is visual only. Phases 3 and 4 can be built in either order after phase 2. Phase 5 checks the desktop pet that already exists. It does not add a second session page.

## After the close-tab and pairing merges

Two merges landed after this set was drafted. They do not change the wallet, the 100-point price, or which pet a session shows. They do change three details:

- `0007_close_blocked.sql` already exists. The shop migration is `0008_pet_shop.sql`.
- `profiles.close_blocked` is updated by the signed-in user. A later grant must still allow that update and must still refuse an update of `points`.
- Pairing and the "pet is running" line are gone. The desk download panel stays. The pet still reloads the equipped row on its own 10 second timer. `claim_study_session` also returns that user's equipped pet. The launch link still carries only the code.
