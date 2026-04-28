# Project notes — kawaii-fruit-merge

## Commit conventions (REQUIRED)

When the user asks me to commit / push / "update the git", every commit
message must be a real changelog entry — not a one-liner. The user
explicitly asked for this on 2026-04-28.

**Format:**

1. **First line: imperative summary, ≤ 72 chars.**
   "Replace canvas-drawn fruits with pixel-art PNG sprites" — not
   "fruit update".

2. **Blank line, then a body.** Multi-paragraph. Cover:
   - What changed (user-facing behavior, in plain English).
   - Why it changed (the bug it fixes or feature it adds).
   - Notable technical details that future-me would want to know
     (caches, refs, threshold values, perf trade-offs, files touched
     beyond the obvious).

3. **One commit per coherent feature/fix.** If I batched several
   unrelated tweaks, the body should call out each one with its own
   short paragraph, not bury them.

4. **Trailing Co-Authored-By line:** always include
   `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.

5. **Use the heredoc form for multi-line messages**:

   ```bash
   git commit -m "$(cat <<'EOF'
   Subject line under 72 chars

   Paragraph explaining the change…

   Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
   EOF
   )"
   ```

**Don't:**
- "fix" / "update" / "wip" — useless.
- Cram unrelated changes into one commit without separate paragraphs.
- Skip the body even on small commits — at minimum say *why*.

**Do — examples that match the bar:**
- `Log scores to a local leaderboard, raise the death line, speed up render`
- `Replace canvas-drawn fruits with pixel-art PNG sprites`
- `Move controls under EVO wheel and clear out fake leaderboard`

## Other project facts

- **Repo:** `git@github.com:lotsoflowers/fruit-game-coded-.git`
  (`origin/main`)
- **Deploy:** Vercel auto-deploys on push to `main`. Project name on
  Vercel collides with `fruit-game-coded` (trailing dash gets
  stripped) — use a different name on import if creating a new one.
- **SSH key:** `~/.ssh/id_ed25519` (no passphrase), pushed under GitHub
  user `lotsoflowers`.
- **Local dev:** Node lives at
  `C:\Users\awrad\.node-portable\node-v22.11.0-win-x64\` because the
  system has no Node on PATH. `.claude/launch.json` already points
  there, but it's gitignored — anyone else cloning needs to install
  Node themselves.
- **Build gotcha:** any unused functions referencing removed
  `FruitDef` fields (`color`, `highlight`, `outline`, `decoration`)
  will pass `next dev` but break `next build` (Vercel). Delete dead
  drawer code, don't just leave it.
- **HMR cache trap:** rapid edits sometimes leave Next's `.next/` in a
  state where the engine `useEffect` silently never runs and the canvas
  stays blank. Fix: stop the dev server, `rm -rf .next`, restart.
- **Perf:** fruit PNGs are 600×600. They MUST be drawn from the
  `fruitSprites` per-level offscreen-canvas cache (built in
  `buildFruitSprite`) so the per-frame draw is a 1:1 blit, not a 600→
  on-screen-size downscale. Same applies to any future image-based
  drawing.
