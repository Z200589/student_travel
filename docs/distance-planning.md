# Offline recommendations and distance drafts

Added 2026-10-08. Entry: Create Trip → destination/dates/budget → desired places and recommendation list → preview → explicit save.

## Coverage and data provenance

The initial catalog contains 13 places: Hangzhou (6), Beijing (4), Chengdu (3). Names and broad themes were checked against the following primary visitor/tourism sources. Short recommendation descriptions are original editorial summaries, not copied passages.

- Hangzhou tourism: https://wgly.hangzhou.gov.cn/art/2022/12/1/art_1229696389_58943150.html
- Lingyin: https://wgly.hangzhou.gov.cn/art/2023/12/1/art_1229734028_58951314.html
- Hangzhou suggested cultural routes (West Lake, Xixi, Hefang Street): https://wgly.hangzhou.gov.cn/module/download/downfile.jsp?classid=0&filename=c3ccb4250d3143a09047ee20fbe1170c.pdf
- Beijing tourism: https://s.visitbeijing.com.cn/line/130 and https://english.visitbeijing.com.cn/special/c39c7eb55eb456634e3922f5d96a727f/685ee2e3b67e1a4685a5c4fe8e44d13871724655734911820
- Chengdu historical streets: https://cd3000y.cccic.org.cn/views/3DMuseum/OldStreet.aspx
- Wuhou Shrine visitor information: https://daolan.wuhouci.net.cn/intro.html

Coordinates are manually approximated geographic area anchors for this draft feature, NOT coordinates verified by these sources or attraction entrances. All are marked approximate. Suggested visit durations and time buffers are product assumptions, not official hours. No live opening hours, prices, availability, popularity or reservations are provided. No map request or API key is used.

## Algorithm and limits

- City-scoped exact names and aliases; punctuation-separated input; deduplicate by place ID.
- Recommendation score prioritizes matching travel style, then proximity to selected places. No popularity claim.
- Haversine straight-line distances; nearest-neighbour route tried from each starting place; retain the shortest candidate relative to input order. This is a heuristic, not a globally optimal road route.
- Split the ordered stops across requested days. Relaxed/normal/packed allow at most 2/3/4 stops and 6/8/10 planning hours per day, including suggested visit duration, a draft transfer buffer (straight-line km / 15 km/h plus 20 minutes), and a 60-minute lunch allowance when needed. This buffer is not a traffic ETA. Long visits spanning midday retain a 09:00 start and include a break.
- No hotel start/end, airport transfers, transport-mode routing, opening-hour constraints, tickets, budget optimization or multi-city routing. Times are drafts. Distance shown excludes accommodation return journeys.
- Unknown places and capacity overflow stay visible and are persisted as unplannedPlaces. Unsupported cities cannot get fabricated routes; manual creation remains available. Limit 1–30 days.
- Preview never writes storage. Editing form inputs invalidates or rejects stale preview; only explicit save creates a trip. Primary generate button uses route preview when desired places are entered, avoiding an unrelated random example.
- Saved trips use the normal editable itinerary format. Manual edits do not automatically recalculate the route; the UI says so.

## Validation

10 planner tests cover catalog constraints, aliases, deduplication, geographic distance, zigzag reduction, recommendation ranking, day count, overflow, unknown city/date errors, and preview/save persistence with stale-preview rejection. Run npm.cmd test for the full suite (1449 original assertions + 27 regression/planner tests).

Next iteration: verified POI/entrance coordinates via a chosen licensed provider, user hotel/start point, actual road/transit duration matrices, hours/reservation constraints, then replan existing trips. Check current provider licensing and costs before connecting; keep credentials on a backend. Simulator visual interaction remains to be verified separately.

## Real-place example generation

Both Create Trip's example action and Profile's Hangzhou example now call example-trip-service.generateExample, which selects real catalog locations and reuses the distance planner. The creation page no longer calls mock-ai-service. Unsupported cities fail explicitly, with no generic landmark substitution. Old saved examples remain unchanged; the opt-in profile example uses the new hangzhou-real-places-v2 key. Empty dates have no fabricated activities.

Validation updated to 1449 original assertions plus 28 tests, including all-city catalog identity checks and unsupported-city rejection; all 22 WXML templates compile. Live hours and entrance coordinates are still not verified.
