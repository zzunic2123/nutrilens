# Store immutable Champion declarations

Weekly and monthly Champions are stored as database snapshots when a Competition Period closes instead of being recomputed from mutable meals. Each declaration preserves the Player's display name, score, nutrition totals, logged-day count, and period, but does not copy meal details. This keeps earned trophies stable after meal edits, deletion, renaming, or allowlist removal without permanently duplicating sensitive food history.
