# Trajectory visual study

Isolated, synthetic A/B/C prototypes for Landing, Today, Week and History. Open `index.html` directly or use the existing Vite dev server at `/design/trajectory/index.html`. Select a direction, surface, data completeness and viewport. URL parameters preserve a review state. The initial comparison shows mobile canvases side by side. Desktop comparison keeps each canvas at 1120px inside a horizontal scroll region; choose one direction for a full-width view. The production entry does not import this directory; no app stores, IndexedDB, telemetry or auth are loaded.

The same templates and fixtures render all directions. Forms simulate a save; no data is persisted. Charts have keyboard tooltips and equivalent tables. Partial data stays missing. The minimum-four comparison rule is a proposed semantic cleanup, not a change to production analytics.

Fonts are prototype-only local WOFF2 subsets (Cyrillic and Latin), downloaded from Google Fonts. Original licenses are in `fonts/*-OFL.txt`, exact source URLs and byte sizes in `fonts/sources.json`. No third-party font requests occur when viewing the study. Lora and Golos Text use SIL OFL 1.1. A uses system fonts. Existing production fonts and screenshots are unchanged.

Internal evaluation, screenshots and migration planning are kept outside Git in `qa/visual-direction/`.
