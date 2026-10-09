# Painter integration

Upstream https://github.com/manycore-maas/Painter
Commit 43e43ca712724a3df5cd28d2ee1c4fd9f3f5f8b2, downloaded 2026-10-09.
Copied components/painter and root Apache-2.0 LICENSE. Original helpers retained.

Modified files: painter.js and lib/pen.js, lib/downloader.js, lib/wx-canvas.js convert ESM imports/exports to CommonJS. lib/pen.js no longer loads string-polyfill.js, which overrides native String substr/substring globally. The unused file is retained for provenance; this integration leaves native semantics intact. Painter's own toPx conversion helper remains in use.

Application uses static text/rect palettes, no network images, QR invitations, interactive editing or LRU image cache. Uses imgOK/imgErr callbacks and the non-2D canvas path. wx.saveImageToPhotosAlbum requires device acceptance. No upstream scripts executed.
