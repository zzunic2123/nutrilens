# Leaderboard

## Problem Statement

NutriLens users share the app with friends but cannot compare their logging performance or learn from one another's meals. Settings also occupies a primary navigation position even though Profile already opens the same page. The group wants a playful competition that rewards protein-efficient eating, declares durable weekly and monthly Champions, and lets Players inspect the meals supporting a ranking without exposing private profile or note data.

## Solution

Replace the duplicate Settings navigation item with a Leaderboard. The Leaderboard automatically includes every allowlisted Player with a profile, ranks the current Zagreb day, week, or month by protein grams per 1,000 calories, and gives gold treatment only to first place. Selecting a Player opens a period-scoped Public Meal View grouped by day. Closed weekly and monthly results declare immutable Champions stored in the database, with recent winners and complete trophy history shown on the page.

## User Stories

1. As a Player, I want Leaderboard in the primary navigation, so that competition is one tap away.
2. As a Player, I want Profile to remain the route to settings, so that account and goal controls stay available without duplicate navigation.
3. As a Player, I want to switch between Today, Week, and Month, so that I can compare different Competition Periods.
4. As a Player, I want every allowlisted friend with a profile to appear, so that nobody in the group is silently excluded.
5. As a Player, I want unscored friends shown at the bottom, so that the roster remains understandable before everyone logs food.
6. As a Player, I want Protein Efficiency explained in the UI, so that I know how rank is calculated.
7. As a Player, I want rankings based on unrounded data, so that display rounding does not change the winner.
8. As a Player, I want higher protein, more logged days, and then fewer calories to break score ties, so that ranking remains fitness-oriented.
9. As a tied Player, I want an exact unresolved tie to produce co-first place, so that an arbitrary name sort cannot decide a Champion.
10. As a Player, I want live rankings to include everyone who has logged positive calories, so that current progress is immediately visible.
11. As a weekly contender, I want Champion eligibility to require four logged days, so that one isolated meal cannot win a week.
12. As a monthly contender, I want Champion eligibility to require fifteen logged days, so that one isolated meal cannot win a month.
13. As a Player, I want the current first place visually celebrated, so that the competition feels playful.
14. As a lower-ranked Player, I want neutral styling, so that only first place is worshipped rather than creating a full podium.
15. As a Player, I want to click another Player and see their meal names, times, nutrition, and components, so that I can learn what they ate.
16. As a Player, I want another person's notes, email, favourite state, and AI metadata hidden, so that competition does not expose unrelated private data.
17. As a Player, I want the meal view limited to the active Competition Period, so that it does not become unrestricted history browsing.
18. As a Player, I want meals grouped by Zagreb calendar day, so that a week or month is easy to scan.
19. As a Player, I want the latest completed weekly and monthly Champions highlighted, so that the reigning winners are immediately visible.
20. As a Player, I want complete Champion History, so that previous victories remain part of the game.
21. As a Champion, I want my result locked after period close, so that later meal edits or deletion cannot take away the trophy.
22. As a former Player, I want earned trophies preserved after allowlist removal, while my meals and live ranking disappear, so that history remains accurate without ongoing data exposure.
23. As a historical-results viewer, I want a trophy to open only that Champion's winning period, so that old food data is exposed only in its competition context.
24. As an existing group, I want all eligible completed periods backfilled at launch, so that Champion History starts populated.
25. As a Champion, I want an in-app declaration and celebration, so that winning feels meaningful without requiring push notifications.
26. As a demo user, I want a representative three-player Leaderboard, so that the feature can be evaluated without production accounts.

## Implementation Decisions

- Use the canonical domain terms Player, Protein Efficiency, Competition Period, Current Leader, Champion, Champion History, and Public Meal View.
- Today is the current Europe/Zagreb local date. Week is Monday through Sunday. Month is the Zagreb calendar month. These are shared periods and do not use individual profile timezones.
- Protein Efficiency is `(protein grams / calories) × 1,000`. A Player with no positive calories has no score and sorts below scored Players.
- Rank by unrounded Protein Efficiency descending, total protein descending, distinct logged days descending, and calories ascending. Exact remaining ties share the same rank and can create co-Champions; display name is only a stable presentation sort.
- Weekly Champion eligibility requires at least four distinct logged days. Monthly eligibility requires at least fifteen. Daily rankings have no Champion declaration.
- Add immutable weekly/monthly Champion records containing period boundaries, nullable Player identity, display-name snapshot, score, protein, calories, logged days, and declaration time. Do not snapshot meals.
- Backfill every completed eligible weekly and monthly period represented by existing meal data. Future declarations are idempotent and materialized after period close; leaderboard reads provide catch-up if scheduled processing is delayed.
- Keep profile, meal, meal-item, allowlist, and Champion tables private under their existing or stricter policies. Add narrowly shaped security-definer read functions that validate the caller's allowlist membership and return only sanctioned cross-user fields.
- A Player is an allowlisted authentication user with a corresponding profile. Profiles belonging to failed or uninvited sign-ins are excluded.
- Public Meal View access is allowed only for the current selected period or a stored Champion's exact winning period. Removed Players immediately lose live/public visibility, but Champion snapshots remain.
- The current Leaderboard response contains all Players, aggregates, eligibility/provisional state, rank, and period boundaries. Champion History is returned from immutable snapshots.
- Replace the explicit Settings item in desktop and mobile primary navigation with Leaderboard. Keep the desktop profile chip and mobile Profile item routed to settings.
- Add a dedicated Leaderboard page with period tabs, first-place hero treatment, latest weekly/monthly Champion cards, a neutral ranked list, explanation copy, and a period-scoped Player detail modal.
- Provide deterministic demo Players, meals, rankings, and Champion snapshots without changing the signed-in demo profile model.
- Update architecture and setup documentation for the controlled cross-user read boundary and Champion lifecycle.

## Testing Decisions

- Prefer deterministic domain-helper tests as the highest reusable seam: shared Zagreb period boundaries, DST behavior, Protein Efficiency, eligibility, sorting, shared ranks, and day grouping.
- Add component tests at the page/navigation seam to verify the Settings replacement, period switching, first-place-only treatment, and opening a Player's period-scoped meals. Follow the existing Testing Library pattern that mocks the application context.
- Run a local Supabase reset and authenticated multi-user SQL smoke test. Verify an allowed caller can receive sanitized friend data, direct cross-user table reads remain blocked, an uninvited caller is rejected, removed Players disappear, and a stored Champion is unchanged after meal mutation.
- Verify migration backfill and idempotency by running declaration more than once and checking that Champion records are not duplicated.
- Run the complete repository typecheck, Vitest suite, production build, responsive visual check, and final two-axis Standards/Spec review.

## Out of Scope

- Opt-in or per-friend sharing controls.
- Email addresses or free-text notes in shared views.
- Arbitrary browsing of another Player's full history.
- Silver or bronze podium rewards, prizes, reactions, comments, challenges, or social feeds.
- Push notifications for Champion declarations.
- Per-food-component macro calculations.
- Fraud detection, nutrition verification, moderation, or manual administrator overrides.
- User-local competition calendars or competitions spanning multiple timezones.

## Further Notes

The feature is intended for a small allowlisted friend group but the read boundary, pagination, immutable snapshots, and database aggregation must remain suitable as membership grows. Champion wording must remain distinct from Current Leader so an open period never implies a final result.
