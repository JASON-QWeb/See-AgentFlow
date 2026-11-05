# Agent Ops — visual and functional QA

final result: passed

Latest revision: immersive display, 4K rendering and historical waterfall replay, verified 2026-11-05. The original-version sections below remain a baseline; the final revision section supersedes their standard-quality, no-display-effects and ECO-on handoff settings.

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
