# Agent Ops — visual and functional QA

final result: passed (web visual and native desktop/preview scope); authenticated lock/unlock cycle not exercised

Latest revision: language preferences, white-dominant monochrome theme and persistent Always on Top option, verified in background on 2026-11-05. Prior native floating-window interactions and physical dual-screen previews passed. The system screen saver is selected with a five-minute start delay and its extension rendered in System Settings. The authenticated lock/unlock cycle was not triggered. Earlier sections are historical baselines; later revisions supersede their design and acceptance status.

## Evidence and comparison conditions

- Source visual truth: `/Users/mac/.codex/attachments/bc0ef631-b915-4ff2-a24a-0be2f5b5c1d8/image-1.jpg`, 2444×1080 pixels.
- The reference is a photograph of a monitor. App content was approximately cropped to `(300, 0, 2155, 1030)` and normalized from 1855×1030 to 1840×1024. Monitor bezel, perspective distortion, reflections, photographic blur and room background are excluded from the app scope. This is not a pixel-identical photographic reproduction claim.
- Desktop implementation: `/Users/mac/Desktop/Agent_View/artifacts/dashboard-desktop.png`, CSS viewport and screenshot 1840×1024, browser device pixel ratio 1. Canvas internally caps backing scale at 1.25.
- Full comparison, inspected together: `artifacts/comparison-final.png` (920×512 per image, with a label strip).
- Focused comparisons, inspected together: `artifacts/comparison-header.png`, `artifacts/comparison-core.png`, `artifacts/comparison-panels.png`.
- Responsive evidence: `artifacts/dashboard-mobile.png` and `artifacts/console-mobile.png`. CSS viewport 390×844, DPR 1; full-page capture approximately 390×1056 includes scrolling content.
- Additional states: `artifacts/console-desktop.png`, `artifacts/idle-eco.png`.

The reference shows heavy traffic; the real machine had mostly one active Codex session and inactive Claude history. Session counts, log text, particle intensity and activity cannot be made identical without fabricating data, which the user forbids. The matching target is the app composition, terminal style, curved data band, port layout, stream direction and traffic-dependent motion. No test events were injected into the production source directories.

## Comparison history and resolved findings

1. **P2 — sparse, dim core content.** `artifacts/comparison-v2.png` shows a largely single-column, low-contrast log ribbon compared with the reference's bright text/table blocks. Added adjacent UTF-8 hex matrices derived from each real event preview, increased text contrast, matched band placement and improved curve sampling. The final full/core comparisons show the corrected two-part data blocks and thin mint rims. Matrix bytes are actual text encoding, not invented metrics.
2. **P2 — mobile canvas overlapped metrics.** `artifacts/dashboard-mobile-v2.png` shows port labels and log glyphs under statistics and session names. Moved the narrow-screen core to the right, removed mobile port labels, reduced canvas opacity and added opaque metric backing. `artifacts/dashboard-mobile.png` shows legible controls and no horizontal overflow at 390 CSS pixels.
3. **P2 — overly correlated packet placement.** The intermediate active screenshot showed aligned particle sheets caused by sharing the seed for lane, speed and delay. The final renderer independently hashes actual event IDs for lane, timing and speed, retaining the same bounded number of packets per real event.
4. **P1 — delayed macOS append observation.** Initial directory-only notifications fell back to 30-second reconciliation. Added bounded direct file watchers while retaining directory discovery and recovery. A real append was observed in approximately 124 ms; integration tests cover partial writes, deduplication and nested newly created subagent logs.

## Fidelity surfaces

- **Typography:** bundled IBM Plex Mono, weights 400/500/600; compact uppercase terminal headings, six numeric statistics and small log rows match the reference hierarchy. Chinese uses the system fallback. Exact source font cannot be identified from the blurred photograph; IBM Plex Mono is the closest selected terminal treatment. Full text is readable at a larger size in the event console.
- **Layout and spacing:** left masthead/statistics/session rail, three ingress/dispatch/egress ports, large curved core extending beyond the viewport, outgoing lanes, lower-right traffic state, and four sharp bordered bottom panels. Desktop and narrow-screen content remain within their viewport; the rail scrolls at short heights.
- **Colors and tokens:** near-black/blue-charcoal surfaces, muted mint borders, off-white log text and green activity marks. Photographic glare is intentionally omitted. Active traffic is brighter; idle routes remain subdued. No generic rounded cards or unrelated decorative imagery.
- **Assets and rendering:** the supplied image contains app text and a data visualization, not separate product photos or illustrations. Those surfaces are implemented as actual data-driven Canvas rendering, as required for live motion. UI icons use Phosphor; fonts are local. The pictured physical monitor and brand bezel are not recreated.
- **Copy and content:** original `AGENT OPS / DISPATCH CENTER` identity and terminal panel hierarchy retained; source labels and metrics adapted truthfully to Codex/Claude. No fabricated agent names, process counts, token rates or statuses. Historical records are explicitly marked and excluded from live counters.
- **Motion:** new records spawn bounded packets, velocity eases down when traffic ends and the band keeps a slow drift. Pause freezes movement while ingestion continues. System reduced-motion disables movement. Hidden-page scheduling is guarded in code and the stream disconnects; hidden-window CPU was not separately benchmarked.

## Functional verification

- Production UI served from the loopback Node server; Vite is not kept running.
- 252 local files discovered at verification: 106 Codex (including 7 archived) and 146 Claude (including subagents).
- Six integration tests passed, using real local record copies only in temporary directories: canonical I/O; native append/UTF-8 fragmentation/full-content equality; nested subagent discovery; rotation/truncation with stale-reference protection; historical/live separation and bounded buffers; HTTP/SSE/raw downloads and origin/method restrictions.
- Browser: connected status; Codex/Claude source filtering; console opening/closing; all 252 sessions available in the picker; Claude-only results; unmatched search empty state; clearing search; event selection; full text; raw JSON; pause/resume; settings; ECO toggle; 390-pixel console layout.
- ECO + inactive Claude source reached **6 FPS** with rate **0.0** and `IDLE / COASTING`. The source filter updates both sessions and visualization.
- Raw download byte-for-byte equality verified at the HTTP layer. Clipboard copy was not invoked to avoid replacing the user's clipboard. Fullscreen control was exercised and the page was verified out of fullscreen afterward; support depends on the embedding browser.
- Browser console errors/warnings: none observed in the checked runs.
- Temporary viewport overrides and performance instrumentation were removed. The in-app preview is retained as the deliverable; ECO is enabled.

## Performance evidence and limits

- `artifacts/performance.json`: 20 actual one-second collector samples, mean 0.665% CPU, peak 3.38%, RSS 28.98–35.70 MiB, maximum pending files 1. Observed process nice value: 10.
- `artifacts/browser-performance-final.json`: final build, 1840×1024, standard mode, approximately 50 seconds; main-thread task time 3.76%, script time 1.28%, JS heap 8.56 MiB. These browser measurements exclude GPU/compositor and other processes, and are not total system CPU figures.
- No model/network request interception, synchronous hooks, source writes or full-log database duplication. This restricts interference; it does not establish mathematically zero resource impact.
- Available content is limited to locally persisted records. Encrypted/undumped content cannot be recovered. Extreme traffic can omit browser previews/particles while original logs remain intact; see README for explicit budgets.

## Remaining polish (P3, non-blocking)

- Fine perspective and glyph texture differ from the photographed screen; the supplied still does not establish an exact rotation speed or motion trajectory.
- The exact high-traffic visual density was not reproduced during verification because production traffic was lighter. No synthetic traffic was used to make screenshots busier.

## Implementation checklist

- [x] Real local sources, read-only incremental ingestion and subagent discovery.
- [x] Curved live visualization, bounded resources, idle decay, pause and ECO.
- [x] Full-text/raw inspection and complete source-log download.
- [x] Desktop and mobile comparison, P1/P2 fixes, fresh captures.
- [x] Integration tests, production build, browser interactions and resource samples.
- [x] Local handoff, launch script and honest data/performance boundaries.

## Immersive / 4K / history replay revision

- The user explicitly authorized always-moving display effects and historical/mock text scrolling. Decorative particles are renderer-only; the center uses actual past local records labeled `HISTORY / REPLAY` and `REPLAY / provider / kind`. Live counters, event lists and throughput remain real.
- A separate replay reader takes bounded 128 KiB tails from up to three files per provider, caches results for 60 seconds and returns at most 128 previews. Rotation reuses the browser cache without per-frame log reads. The new integration test verifies exact real-record preview provenance, unchanged counters, no injected live events and unchanged source bytes.
- All seven integration tests passed with no skips. Production build passed after the final frame-cadence adjustment. The existing Sites handoff files remain intact; this is a local-only handoff.
- At verification, all-source history contained both Codex and Claude. With Claude selected and its live rate at **0.0**, the central text and particles continued moving. `artifacts/immersive-history-a.png` and `artifacts/immersive-history-b.png` show distinct text positions; a central-band image difference confirms motion. No production log records were fabricated.
- High-DPI verification: **1920×1080 CSS pixels, DPR 2**, canvas backing **3840×1666**. Screenshot output is normalized to 1920×1080 CSS pixels; `artifacts/immersive-history-preview.png` is a 1536×864 presentation copy. Earlier native-width testing also verified a 3840×1913 canvas at a 3840×2160 viewport. Rendering is capped at 3840×2160 backing pixels.
- Final history replay sample: **28.70 seconds**, observed **60 FPS**, main-thread task time **12.11%**, script time **6.74%**, JS heap **9.97 MiB**. Evidence: `artifacts/immersive-history-performance.json`. These are browser-main-thread measurements, exclude GPU/compositor and other processes, and do not establish total-system CPU or a guaranteed frame rate on every device.
- Verified immersive/high-quality persistence after reload, pause/resume, quality toggle and restored `IDLE / COASTING` when display mode is disabled. Final preview: immersive on, high quality on, ECO off, all providers selected.
- Responsive checks: 390×844 screenshot `artifacts/immersive-mobile.png`; no horizontal overflow and a 21-pixel separation between metrics and controls. At 800 pixels, controls sit below the title and to the right of metrics, without overlap.
- No console errors or warnings observed. Performance instrumentation and temporary viewport/device overrides were removed; the local preview remains open at http://127.0.0.1:4318/.

## Initial dual-screen Möbius / native app revision (historical)

**Web design final result: passed. Native interactive acceptance: pending manual Mac unlock.**

### Direction and fidelity

- Latest source: `/Users/mac/Downloads/20261105-120416.jpeg`, a 1080×2430 photographed display. The user requested its dense curved log texture and fine transmission lines in a dual-screen Möbius composition, while preserving the existing single-screen design. Phone controls, glare, monitor bezel and perspective distortion are outside the app scope.
- Compared the source crop and implementation together in `artifacts/mobius-reference-comparison.png`, including the ring at readable detail; complete composition in `artifacts/mobius-panorama.png` (3840×1080 CSS pixels, DPR 1). `artifacts/mobius-panorama-preview.png` is a downsampled presentation copy.
- Typography: original IBM Plex Mono and terminal labels retained. Real preview text forms variable-length blocks; adjacent matrices encode real UTF-8 bytes. Log strings differ from the photograph because the local data is real.
- Layout: tall central half-twisted strip with continuous rim, outward left/right streams and fine inner return paths. Original masthead, metrics, sessions and terminal panels remain in the shared composition. Each physical screen sees its own crop, rather than two independently laid-out copies.
- Color: original charcoal/mint palette retained; brighter off-white glyph blocks and mint rim reflect the new reference. The source's photographed pink cast is not added to the existing palette.
- Assets/rendering: actual WebGL geometry and moving log texture implement the requested live visualization; no screenshot is used as a fake live surface. Raster asset generation is not applicable to this dynamic data graphic.
- Single-screen fidelity: all six measured original regions match the prior baseline exactly at 1920×1080: canvas `(0,0,1920,833)`, masthead `(24,16,421.828125,52.09375)`, rail `(24,76,320,742)`, panels `(14,839,1892,205)`, throughput `(1715,620,176,86)`, state `(1640,732,251,63)`. Evidence: `artifacts/single-layout-regression.json` and `artifacts/single-original-current.png`. Single-screen continues to use the original Canvas renderer.

### Resolved findings and final checks

1. **P2 — initial ring too dim and uniform.** Initial `mobius-panorama-v1.png` had a weak rim and uninterrupted text rows. Increased rim/glyph contrast and switched to variable log blocks with byte matrices. The final reference comparison shows readable density and separation, with fine return paths through the opening.
2. **P2 — excess JavaScript work for decorative particles.** Moved packet motion from per-frame CPU arrays to one immutable GPU seed buffer and shared clock uniforms. The final animation retains the same bidirectional dispatch while reducing the sampled browser main-thread load.
3. **P1 — differing display widths could disagree on canvas height.** Both views now derive the scene height and panel rows from the shared world size. A 1280+1920 layout gives both canvases height 833 and both panel grids y=839/width=3172. Evidence: `artifacts/mobius-mixed-display-geometry.json`.
4. Pausing freezes the ring exactly: the same core crop from `mobius-paused-a.png` and `mobius-paused-b.png` has no pixel differences. Paused render cadence falls to 1 FPS; resume returns to flowing display mode.
5. Right display at CSS 1920×1080 / DPR 2 uses canvas backing **3840×1666**, and showed 60 FPS. Evidence: `artifacts/mobius-right-4k.png`. Left slice: `artifacts/mobius-left-browser.png`. This browser test does not substitute for native mixed-refresh hardware acceptance.
6. Final sampled GPU packet implementation: **57.46 seconds**, **60 FPS**, browser main-thread task time **5.66%**, script time **1.49%**, JS heap **8.33 MiB** at 3840×1080 / DPR 1. Collector readout at the sample endpoint was **0.21% CPU / 32.5 MB**. Evidence: `artifacts/mobius-browser-performance.json`. Main-thread figures exclude GPU/compositor and other processes; the collector endpoint is not an average.
7. Production web build, optimized Swift host/extension build, deep/strict signature verification, 10 JavaScript tests, and native display-layout tests passed. PluginKit reports the installed extension. No browser errors or warnings appeared in the checked states. No real source logs were changed by tests.

### Native acceptance status at that revision (superseded below)

The installed App contains a resizable floating NSPanel, frame persistence, small-window page scaling, menu-bar restore, single/automatic full-screen previews, and renderer release on close/minimize/lock/screen-saver transitions. The screen saver extension remains separately registered.

The computer tool reported the Mac locked and automatic unlock paused due to physical input. Requested manual unlock and continued independent build/browser verification. **The new floating window has not yet been exercised through the native UI, the custom screen saver has not yet been selected in System Settings, and real lock/unlock cleanup is not claimed as verified.** These are the remaining acceptance steps after unlock; source code/build success alone is not proof of them.

## Final figure-eight / inner motion / themes revision

**Visual and native desktop/preview result: passed.** The remaining untested scenario is a complete authenticated lock/unlock cycle.

### Reference fidelity and resolved findings

- Sources: the same photographed display at `/Users/mac/Downloads/20261105-120416.jpeg`, the user's silver/pink theme reference, and the subsequent screenshot requesting movement inside the loop. The durable direction is a wider, flatter horizontal eight with each lobe occupying roughly half its physical screen, larger log glyphs and thicker transmission strokes. Original single-screen positions must remain unchanged.
- Final comparison inspected together: `artifacts/infinity-reference-comparison.png`. Full panorama: `artifacts/infinity-inner-b.png` (3840×1080 CSS, DPR 1); presentation copy: `artifacts/infinity-preview.png`. The paired depth-separated crossings create a continuous half-twisted eight. Both lobes contain curved filaments and visible packet heads; outer streams spread toward their corresponding screen edge.
- Typography and density: IBM Plex Mono retained, real log blocks enlarged to a 3072×384 text atlas with 17-pixel source glyphs. Real UTF-8 matrices supply the file-data texture; no fabricated event text or counters were introduced. Thin triangular ribbons provide reliably thicker strokes on Metal/WebGL implementations that clamp native line widths.
- Palette: Settings now contains accessible radio choices for the original mint palette and `银白光流`, with warm white glyphs, charcoal surfaces and pale pink streams matching the supplied reference. `artifacts/theme-settings.png` shows the selector; `artifacts/paper-single.png` verifies the original single-screen composition in the new colorway; `artifacts/infinity-mint.png` verifies the dual-screen mint variant. Theme-only changes leave single-screen geometry and positioning intact.
- **P2 resolved — static inner web.** 176 inner curves now drift smoothly; 208 file heads with short tails travel in mirrored directions across the two lobes. `artifacts/infinity-inner-a.png` and `artifacts/infinity-inner-b.png` are distinct animation frames. An interior-only region `(1120,370)-(1500,500)` changed at 30,805 of 49,400 pixels above an 8-level threshold, excluding the text ribbon. The rendered curves and heads were visually inspected, not inferred solely from the image difference.
- Inner and outer motion uses immutable GPU buffers and a shared clock; 512 outer + 208 inner packets keep the total at 720. History replay remains bounded/cached, and decorative movement never enters live traffic statistics. Pause, hidden-page suspension, reduced motion and the 60 FPS ceiling remain in place.

### Theme behavior and backend validation

- Browser radio selection, page reload persistence and both themes were exercised. The native Settings panel reflected the browser's mint choice (`artifacts/theme-native-synced.png`); choosing paper in the native app updated the shared preference. Both choices were verified; the latest local preference remains authoritative.
- A bounded, atomically saved theme setting lives outside the source transcripts. Only same-origin JSON `PUT /api/preferences` is writable; it accepts exactly one valid theme field and at most 1 KiB. Existing log interfaces remain read-only.
- All 12 JavaScript tests passed without skips, including persistent/serialized theme writes, invalid inputs, origin/method/body restrictions and a live SSE preference update. Production web build, native optimized build and signing passed. No checked browser console errors or warnings were observed.

### Native UI and physical displays

- The updated app is installed at `/Users/mac/Applications/Agent Ops Screen Saver.app`. Floating-window title-bar drag and corner resize were exercised. The resized 1914×1090-pixel capture is `artifacts/floating-native-resized.png`; the later app launch restored the saved window dimensions. Current paper floating state: `artifacts/floating-native-paper-final.png`.
- Native automatic preview used the actual 3840×1080 shared world: 27B30H at x=0 / DPR 1 and U27P10 at x=1920 / DPR 2. Verified full-screen captures: `artifacts/infinity-native-left.png` (1920×1080) and `artifacts/infinity-native-right.png` (3840×2160). They are separate capture times, not a frame-synchronized photographic seam test. The shared shader clock supplies cross-screen animation phase.
- **P2 resolved — app activation exited preview.** The reopen handler now retains an already visible full-screen preview. Native focus switching between the displays succeeded after rebuilding and installing this fix.
- At 14:42:18, pressing Escape returned to the floating panel. System lifecycle logs recorded two `renderer released` entries followed by one `floating renderer started`; the test left no full-screen preview covering the desktop.
- System Settings selected `Agent Ops · Continuous Link` and saved a five-minute delay (`artifacts/system-saver-enabled.png`). The actual extension process logged a two-screen viewport and rendered the live right-screen preview (`artifacts/system-saver-selected.png`). This verifies extension loading and selection, but does not claim a password-authenticated lock/unlock test. Existing password and display-sleep settings were unchanged.

### Final performance and handoff

- `artifacts/infinity-performance.json`: 62.32 seconds at 3840×1080 / DPR 1, immersive animation, observed 60 FPS; browser main-thread task time 5.86%, script time 1.73%, JS heap 7.03 MiB. Collector endpoint readout was 0.11% CPU / 30.7 MB, not a sampled average. GPU/compositor and other processes are excluded; these numbers are not whole-machine CPU or a universal frame-rate guarantee.
- Temporary browser viewport overrides and performance instrumentation were removed. The user closed the temporary IAB preview tabs during native testing; the installed app is left in floating mode. The loopback service remains running at `http://127.0.0.1:4318/` and the selected screen saver uses the same local service.
- No public deployment, source-log writes, hooks, proxy changes, fabricated metrics or uploaded log screenshots were introduced. The Sites handoff files remain unchanged.

## Compact floating window / English interface revision

- Removed the top-right Console button. Event and session inspection remain available through their existing entries.
- Floating desktop mode unmounts all four bottom panels when native width is below 1120 points or height below 700 points. Both dimensions must reach the threshold to restore the panels. This uses native dimensions before page zoom; browser and screen-saver layouts are unaffected.
- `artifacts/compact-breakpoints.json` verifies 1120×700 → four panels, 1119×700 → zero, 1120×699 → zero, 900×550 → zero, and 1600×900 → four. No vertical overflow or top Console button occurred. Native zoom also restored all four panel headings (`artifacts/floating-clean-expanded.png`); the restored small window contains none (`artifacts/floating-clean-final.png`).
- The native window uses full-size dark content without a visible title or traffic lights. Small monochrome controls sit in the native title-bar layer and brighten on hover; native Resize was exercised successfully. Top-edge dragging, native resizability and menu/keyboard access remain available. Product menus, labels, accessibility text, tooltips and errors are English; original session names and log content remain untouched.
- Native Settings showed English theme labels, display options and source information; close returned to the compact dashboard (`artifacts/settings-english.png`). The native capture also shows the discrete window controls. All 12 integration tests passed without skips; production web/native builds and strict code-sign verification passed.
- A final desktop-only inset reserves the native controls' width independently of page zoom, preventing overlap with the web toolbar. The final background browser check at 1178×620 found zero panels, no header/control overlap, and no console warnings/errors (`artifacts/floating-web-final.png`).
- After the user requested tests away from their primary work screen, native UI automation stopped. Remaining validation ran in a hidden browser tab, which was closed, and its temporary viewport override was reset. Future visible tests belong on the secondary 27B30H. The final web assets were copied into the installed runtime without restarting the current app or collector; the final spacing refinement loads when the floating renderer is next opened.

## Language / white signal / window level revision

- The user clarified that the new white theme means white, silver and gray light on a dark background, predominantly white, with varied stroke widths. `White Signal` implements that palette in both original single-screen and linked Möbius renderers. White single-screen connector widths use 1.15 / 0.6 px; dual-screen curves and file heads retain their existing varied weights. Neither original theme's layout changed. No full-frame filter, particle-budget increase or additional per-frame log reads was introduced.
- Settings now offers English, 简体中文 and 繁體中文, initially English. Product labels, settings, tooltips, event inspection and native menus use the chosen language; captured records and session names remain untouched. Theme and language are shared through the existing SSE snapshot. A bounded same-origin preference request can update either field or both; serialized partial writes preserve concurrent changes. Legacy theme-only preferences retain the theme and default to English.
- All three languages were exercised in an isolated preview on port 4320 with its own temporary preference file and real read-only local records. Switching the linked preview to English updated the separate single-screen tab. Reload preserved white / English. Evidence: `artifacts/settings-white-zh-cn.png`, `artifacts/white-single-zh-tw.png`, `artifacts/settings-white-final.png`, `artifacts/white-dual-final.png` and `artifacts/white-single-final.png`.
- Single-screen verification used 1920×1080 CSS pixels at DPR 2, with a 3840×1666 scene canvas and a 60 FPS readout. Dual-screen white preview used a 3840×1080 world and 3840×833 scene canvas; sustained observation returned 60 FPS after initial setup. These are render-counter observations, not a new total CPU/GPU benchmark. No checked console errors/warnings or horizontal overflow occurred.
- The menu-bar icon's context menu includes `Always on Top`, checked by default. Unchecking sets the floating panel to the normal window level; the choice persists in UserDefaults. A native test with prohibited app activation and no visible windows verified default state, level changes, persistence across preference instances, checkmarks and Simplified/Traditional Chinese menu labels. Native controls refresh their translated tooltips on hover; menu language refreshes on opening, without polling.
- All 14 JavaScript tests passed without skips, including preference migration/concurrent partial updates and translation-placeholder coverage. The native preference test, production web/Swift builds and installed deep/strict signature verification passed. A final CSS cleanup removed remaining mint accents from white-theme secondary labels and controls.
- The new App and runtime are installed. The observer service restarted to load the expanded preference schema; its snapshot preserves the user's existing mint theme with English, and discovers 256 session logs. Installed native executable, service modules and web entry match the final build. The running desktop App was not restarted or activated, so new native menu actions load on its next launch. The menu popup itself was not exercised on the user's primary screen. All new browser checks were hidden; temporary tabs, viewport/DPR overrides and the isolated preview process were removed. The production localhost observer remains running.

## Standalone DMG and user-managed installation

- Version 1.1.0 bundles the signed Node.js Foundation arm64 runtime, its license, the built web assets and the read-only server. First launch configures user-level observer and desktop LaunchAgents. Login starts the menu bar with no floating renderer or foreground activation. The DMG includes an Applications shortcut and installation notes; it requires Apple Silicon / macOS 26+ and remains an ad-hoc signed local build, not an Apple-notarized release.
- Fourteen existing JavaScript checks, five isolated installer checks, the hidden native preferences test, optimized App/extension builds, deep/strict signature checks and DMG checksums passed. Installer checks cover path escaping, quiet login arguments, unchanged-runtime reuse, preserved preferences, upgrade rollback and rejecting mounted/translocated App locations. They do not alter real LaunchAgents. Service shutdown now waits for launchd to finish removing the job before reusing its label.
- The mounted read-only DMG's own Node executable successfully served the packaged HTML/JS and read 257 genuine local session logs on temporary port 4332, with no development Node dependency. The temporary observer stopped and the image was detached. A real GUI first-launch/login cycle and authenticated lock/unlock cycle were not triggered, respecting the user's primary-screen constraint and request to install personally.
- At the user's request, the previously installed App, its LaunchAgent definition and runtime were moved to `~/.Trash/See-AgentFlow-20261105-160439`. The observer was stopped and the installed extension unregistered. Preferences and source transcripts remain in place. This supersedes earlier notes that the App or localhost observer was left installed/running; installation is now the user's next action.
