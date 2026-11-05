# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Display preferences

- User-authorized immersive mode keeps visual particles and the core moving without requests. Generate these effects only in the renderer; keep captured events, logs and counters tied to real local data and label the display mode.
- In immersive mode, fill the central waterfall from past local logs and loop them as labeled history replay. Keep replay reads bounded and cached independently of live ingestion.
- Optimize high-quality mode for the user's 4K / 60 Hz display: native-pixel text, up to 60 FPS and a bounded 4K canvas budget. Preserve ECO, pause, reduced-motion and hidden-window controls.
