# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Display preferences

- The native lock password prompt has a close button and hides after two minutes without password input. Hiding clears partial input and keeps every screen covered. Return or a click on any covered screen restores the prompt and focuses password entry.
- The native desktop app reserves Command-L globally while running to lock all displays. Command-S stays app-local and uses the original layout.
- User-authorized immersive mode keeps visual particles and the core moving without requests. Generate these effects only in the renderer; keep captured events, logs and counters tied to real local data and label the display mode.
- In immersive mode, vary motion speed continuously with overlapping slow passages and shorter bursts. Keep linked screens in sync and leave live telemetry rates tied to real events.
- In immersive mode, fill the central waterfall from past local logs and loop them as labeled history replay. Keep replay reads bounded and cached independently of live ingestion.
- For long-running displays, expire old preview data gradually with time and count limits, replace history replay windows instead of appending, and release hidden/unmounted renderer resources. Keep original transcript files and lifetime capture counters independent of display-cache eviction.
- Optimize high-quality mode for the user's 4K / 60 Hz display: native-pixel text, up to 60 FPS and a bounded 4K canvas budget. Preserve ECO, pause, reduced-motion and hidden-window controls. Label the high-quality control `4K`, without the `/ HQ` suffix.
- Screen saver mode is a passive display: start in high-quality immersive mode at up to 60 FPS, omit the entire top-right toolbar and configuration controls, and keep configuration access in the desktop App. Apply this to both single and linked displays while retaining history-replay labels and real telemetry.
- Desktop App fullscreen covers every connected display with an app password gate; configure/change the password in Settings. After a screen saver, default to that gate once macOS authentication completes. Keep native password entry independent of the observer, persist only a salted verifier, and retain the user-requested ten consecutive clicks on the lock screen title as an intentional recovery bypass. This app cover does not replace macOS authentication. Validate with offscreen windows so the main display stays usable.
- Preserve the original single-screen design exactly: curved vertical log core, typography, colors, metrics, panels and their positions. The user rejected replacing it with a horizontal ribbon layout.
- Latest dual-screen direction: use `/Users/mac/Downloads/20261105-120416.jpeg` for ring detail, dense log texture and fine transmission lines. Build a shared Möbius ring dispatching streams toward both sides, with synchronized time and physical display coordinates. This dual-screen-only direction supersedes the earlier main-screen-plus-stream-extension proposal. Automatically use the original layout when only one display is connected.
- Package a native app with a freely draggable, resizable floating dashboard on the desktop. Hide/release the floating renderer during the screen saver or lock; restore it on return to the desktop only if it was open before locking. Keep a closed floating dashboard closed after unlocking. Keep rendering bounded and release screen saver resources at exit.
- Refine dual-screen geometry into a large, flattened horizontal figure-eight Möbius ribbon. Each lobe should occupy roughly half of its physical screen, with larger log glyphs, stronger inner threads and thicker transmission trails. Keep this geometry exclusive to dual-screen mode.
- Settings themes apply to single and dual screens: original mint, silver-white text / pale pink streams, and a monochrome white-dominant theme. The white theme retains a dark background and uses white, silver and gray lines with varied widths. Persist and synchronize themes across browser, floating window and screen saver while preserving the single-screen composition.
- The threads inside both figure-eight lobes must also animate: gently moving curves with clearly visible data-packet heads and short trails traveling along them. Preserve the reference's filament look rather than leaving a static web. Keep the combined inner/outer particle budget at 720.
- Settings offers English, Simplified Chinese and Traditional Chinese for product labels, controls, tooltips and native menus; retain English as the initial default. Persist and synchronize language preferences, and preserve captured logs and session names in their original language. Keep the top-right Console button removed; inspection remains available through sessions/events.
- In the floating desktop window, hide and unmount all four lower panels below 1120×700 native points; restore them when both dimensions meet the threshold. Keep full-screen and screen-saver layouts intact.
- The floating window should have no visible title or white title bar. Use discreet monochrome window controls that brighten on hover, retaining top-edge dragging, free resizing and keyboard/menu access.
- Keep visible test windows on the secondary 27B30H display; run builds and other verification in the background. Avoid activating or covering the user's primary display while they work.
- Include a checked-by-default Always on Top option in the menu-bar icon's context menu. Remember the choice; turning it off places the floating dashboard at the normal window level without affecting full-screen previews or the screen saver.
- Distribute a DMG with a self-contained App and bundled observer runtime. First launch configures user-level background services; login starts the menu bar quietly, with the floating window opened on demand. Leave screen-saver selection, password authentication and display sleep under macOS control.

## Brand

- The app icon is black and white: a white figure-eight Möbius ribbon on a dark squircle, built from the renderer's own centreline and half-twist. The sources and exports live in `macos/assets/`, the menu bar uses the template PNGs, and the favicon in `index.html` stays the same mark.
- Keep `AppIcon.icns` starting at 64 px. macOS 26 wraps the 16 and 32 px representations of a plain `.icns` in a gray frame, while omitting them makes the system scale the 64 px one cleanly. Check changes through `NSWorkspace.icon(forFile:)` at 16 and 32 px, since larger sizes do not show this.

## CI and releases

- `.github/workflows/ci.yml` runs on every push. CI must generate fictional logs with `scripts/ci-fixtures.mjs`, because the collector tests otherwise skip and still pass.
- To release, set `VERSION` in `macos/build.py`, add `docs/release-notes/v<version>.md`, merge to `main` and push the tag. The release publishes the DMG that CI verified.

## Documentation preferences

- The repository is public and the README is a short product showcase led by the app icon. Technical detail belongs in `docs/TECHNICAL.md`. Do not mention the password or fullscreen-lock feature in either file, and keep it out of README images.
- README images must come from fictional sample logs run through the real collector, with `HOME` pointed at a scratch directory. Never capture real transcripts, session names or local paths for anything published.
