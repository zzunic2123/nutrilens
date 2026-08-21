# NutriLens

NutriLens is a shared nutrition journal that helps a closed group understand meals, track goals, and compete on protein-efficient eating.

## Language

**Player**:
An allowlisted NutriLens user with a profile who automatically participates in the shared leaderboard.
_Avoid_: Competitor, leaderboard user

**Protein Efficiency**:
The protein grams logged by a Player per 1,000 calories logged during a Competition Period.
_Avoid_: Protein score, protein count

**Competition Period**:
A shared Europe/Zagreb calendar window: one local day, a Monday-to-Sunday week, or a calendar month.
_Avoid_: Rolling window, user-local period

**Leaderboard**:
The ordered view of all Players for one Competition Period, ranked by Protein Efficiency.
_Avoid_: Rankings, scoreboard

**Eligible Player**:
A Player who has logged meals on at least four distinct days in a weekly Competition Period or fifteen distinct days in a monthly Competition Period. Daily leaderboards require only positive logged calories.
_Avoid_: Qualified user, active user

**Current Leader**:
The highest-ranked Player in an open Competition Period. The position is provisional until the period closes.
_Avoid_: Current Champion, winner

**Champion**:
The highest-ranked Eligible Player when a weekly or monthly Competition Period closes. The declaration is stored permanently and cannot be changed by later meal edits or deletion; exact ties produce co-Champions.
_Avoid_: Current leader, first place

**Champion History**:
The permanent collection of weekly and monthly Champion declarations, including the winning score and period.
_Avoid_: Leaderboard history, past rankings

**Public Meal View**:
The view of another Player's meal names, logged times, nutrition totals, and food components. It excludes free-text notes, favourite state, AI metadata, and email addresses.
_Avoid_: Public profile, shared diary
