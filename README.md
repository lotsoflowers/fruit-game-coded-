# Kawaii Fruit Merge

A Suika-style fruit-merging game built with Next.js 14, React, TypeScript, and Matter.js.
Move the cute cloud, drop fruits into the yellow container, and merge matching fruits to evolve them up the chain.

## File structure

```
.
├── app/
│   ├── globals.css      # All visual styles (sky, container, panels, modal, fx)
│   ├── layout.tsx       # Root layout (loads Fredoka / Baloo 2 fonts)
│   └── page.tsx         # The full game component (single React component)
├── next-env.d.ts
├── next.config.js
├── package.json
├── tsconfig.json
└── README.md
```

## Install

```bash
npm install
# or: yarn / pnpm install
```

Dependencies installed:
- `next@14`, `react@18`, `react-dom@18`
- `matter-js@0.20` (physics)
- `typescript@5`, `@types/react`, `@types/node`, `@types/matter-js`

## Run

```bash
npm run dev
```

Open http://localhost:3000.

## Build for production

```bash
npm run build
npm start
```

## Controls

| Action          | Input                                      |
| --------------- | ------------------------------------------ |
| Move cloud      | Mouse / touch drag inside the play area    |
| Drop fruit      | Left click / tap                           |
| Drop fruit      | `Space` / `Enter`                          |
| Move cloud      | `←` / `→`                                  |
| Undo last drop  | `Z` or the Undo button                     |
| Restart         | `R` or the Restart button                  |

## Features

- Matter.js gravity, friction, restitution, rolling, stacking
- Same-level fruits merge into the next level (chain reactions)
- Score, persisted high score, coin reward indicator
- One-step Undo restoring the pre-drop state
- Restart button + game-over modal
- Friend leaderboard panel + invite button
- 10-fruit evolution wheel showing the merge chain
- Session timer
- Responsive scaling (transforms to fit any window, designed for 1440x830)
- Hand-drawn kawaii faces on every fruit (canvas)
