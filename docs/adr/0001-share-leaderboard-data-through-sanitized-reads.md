# Share leaderboard data through sanitized reads

NutriLens automatically includes every allowlisted Player in the closed-group Leaderboard, but it does not relax the existing private table policies. Cross-user ranking and Public Meal View data are exposed only through authenticated, allowlist-aware database functions that omit email addresses, notes, favourite state, and AI metadata. This preserves one deliberate privacy boundary as the group grows while still supporting the shared competition.
