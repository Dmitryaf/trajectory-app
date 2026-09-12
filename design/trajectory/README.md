# Trajectory visual study

Isolated, synthetic prototypes for Landing, Today, Week and History. The current study compares B1 Editorial Pure, B2 Warm Organic, B3 Atmospheric Editorial and B4 Reflective Journal. The direction selector retains historical A/B/C and the original B.

Open `index.html` directly or run `npm.cmd run dev -- --host 127.0.0.1 --port 4174` and visit `/design/trajectory/index.html`. Choose a surface, data completeness and viewport; the B1–B4 buttons switch the same review state. URL parameters preserve the selection, for example `?direction=b4&screen=week&data=full&viewport=mobile`. “Рядом” preserves four 390px canvases in a horizontal scroll region; desktop comparison preserves 1120px canvases. Choose a single variant on a phone. `canvas=1` hides review controls for captures.

The production entry does not import this directory; no app stores, IndexedDB, telemetry or auth are loaded. `warm-editorial.css`, fonts and preview pictures are local study assets, outside the production build.

The same templates and fixtures render all four B variants. Forms simulate a save; no data is persisted. Charts have keyboard tooltips and equivalent tables. Partial data stays missing. The minimum-four comparison rule is inherited from the earlier study, not a change to production analytics. All B variants add the same Landing product previews and the same History table filter. The filter changes only visible table rows and states that scope explicitly; it does not calculate new analytics. Historical A/B/C keep their prior content.

`previews/` contains actual 560 × 700 JPEG crops of the full synthetic Today, Week and History templates. They are illustrative excerpts; clicking opens the complete interactive surface. Regenerate the local evidence with `node qa/visual-direction/capture-warm.mjs` while the dev server listens on port 4174. This also verifies content parity, captures the 32 primary states, and writes the local gallery. Playwright Chromium and WebKit must be installed. The capture script and evaluation remain in the existing ignored QA directory.

Fonts are prototype-only local WOFF2 subsets (Cyrillic and Latin), downloaded from Google Fonts. Original licenses are in `fonts/*-OFL.txt`, exact source URLs and byte sizes in `fonts/sources.json`. No third-party font requests occur when viewing the study. Lora and Golos Text use SIL OFL 1.1. A uses system fonts. Existing production fonts and screenshots are unchanged.

The current internal evaluation and gallery are kept outside Git in `qa/visual-direction/warm-editorial/`; earlier A/B/C evidence remains in `qa/visual-direction/`. The prototypes support choosing a direction, not approval or implementation of a production redesign.
