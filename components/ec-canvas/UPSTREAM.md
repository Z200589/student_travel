# ec-canvas integration

Upstream https://github.com/ecomfe/echarts-for-weixin
Commit 82e6cdfe5347265c04cced222bd6398dcb6eb279, downloaded 2026-10-09.
Only ec-canvas directory copied; imports in ec-canvas.js and default export in wx-canvas.js adapted to CommonJS and marked. The original bundled ECharts reports 5.3.3. Replaced it with the official same-version simple build (463284 bytes) from https://cdn.jsdelivr.net/npm/echarts@5.3.3/dist/echarts.simple.min.js to reduce size. The downloaded build is unmodified; its header is retained. No upstream install scripts executed.

LICENSE-adapter: repository BSD-3-Clause license.
LICENSE-echarts and NOTICE-echarts: from https://github.com/apache/echarts tag 5.3.3. The bundled file retains its copyright/license header.

Expense-charts uses lazy initialization, explicit sizing, latest ledger data and disposal. Supports native Canvas 2D when the WeChat library supports it; device rendering acceptance remains pending. Tests exercise real ECharts options against a recording Canvas API, not a real WeChat device. The simple build supports our pie/bar options but does not include the SVG renderer.

Before publication: measure uploaded package, review the chosen release and known issues, and consider a smaller pie/bar build or a subpackage. Do not silently replace this pinned build with an unverified version.
