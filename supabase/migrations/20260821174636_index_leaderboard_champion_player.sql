-- Cover the Champion-to-Player foreign key used when authentication users are removed.

create index leaderboard_champions_player_idx
  on public.leaderboard_champions (player_id);
