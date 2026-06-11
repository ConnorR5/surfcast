export const meta = {
  name: 'surfcast-memories',
  description: 'Author the SurfCast MEMORIES knowledge base in depth from an authoritative brief',
  phases: [
    { title: 'Author', detail: '7 agents write the in-depth memory documents' },
    { title: 'Verify', detail: 'fact-check every doc against the brief; fix drift' },
  ],
}

const DEST = '/Users/connorrydel/Development/surfcast-MEMORIES'

// ─────────────────────────────────────────────────────────────────────────────
// AUTHORITATIVE BRIEF — the single source of truth. Agents must use ONLY facts
// from here (plus clearly-labeled general knowledge). No invented project
// specifics. No secret VALUES anywhere — env var names only.
// ─────────────────────────────────────────────────────────────────────────────
const BRIEF = [
  'SURFCAST — AUTHORITATIVE PROJECT BRIEF (everything true as of 2026-06-11).',
  '',
  'IDENTITY',
  '- SurfCast: a personal surf + tide + marine-weather tracker web app for Connor Rydel',
  '  (iOS/mobile dev; surfs Stone Harbor, NJ). Started 2026-06-11. Posture: "take the reins,',
  '  build it, then iterate" — everything negotiable; Connor cares a LOT about design taste',
  '  (warm/analog, NOT sleek/techy).',
  '- Deployable repo: /Users/connorrydel/Development/surfcast. This MEMORIES folder is at',
  '  /Users/connorrydel/Development/surfcast-MEMORIES (OUTSIDE the repo; never deployed).',
  '- It is a PWA (add-to-home-screen, opened in Chrome/Safari), NOT a native iOS app. Deploys to Vercel.',
  '',
  'STACK (verified versions — do not assume older)',
  '- Next.js 16.2.9 (App Router, src/ dir, import alias @/* -> src/*), React 19.2.4, Tailwind CSS v4,',
  '  TypeScript. Turbopack is the default bundler. Node v22, npm 11.',
  '- Twilio (SMS), @supabase/supabase-js (alert store), sharp (devDep, icon generation).',
  '',
  'CORE UX (what Connor asked for and what was built)',
  '- Tides drawn as ONE continuous scrollable WAVY SVG line (never a table), flowing past->future,',
  '  horizontally scrollable across a ~15-day window.',
  '- A week date strip on top (day pills with weekday + day number + a tiny surf-rating dot), with',
  '  left/right paging and arrow-key day navigation; selecting a day syncs the chart + the detail panel.',
  '- Clicking a day shows a breakdown below: surf score + rating + reasons, peak wave, period,',
  '  "Highest at" (clock time of the day peak wave), water temp, UV (0-11 severity), air hi/lo, wind,',
  '  the day tide times, and an hourly surf breakdown (HourlySurf) so you can see surf evolve.',
  '- Default location Stone Harbor; you can search any town (persists in localStorage and reloads).',
  '- Units: feet / Fahrenheit / mph (US).',
  '',
  'DATA SOURCES (all FREE, NO API key, validated live 2026-06-11)',
  '- TIDES: NOAA CO-OPS datagetter (api.tidesandcurrents.noaa.gov/api/prod/datagetter).',
  '  Params: product=predictions, application=surfcast, datum=MLLW, station=<ID>, time_zone=lst_ldt,',
  '  units=english, format=json, begin_date/end_date=YYYYMMDD, interval=hilo (labeled extremes) OR',
  '  interval=h (hourly heights for the smooth curve). Returns predictions:[{t,v,type}]; times are local,',
  '  heights in feet (MLLW). Default station 8535581 = "Stone Harbor, Great Channel, NJ".',
  '  Validated sample (Jun 11): H 3.905ft 05:11, L 0.182ft 11:24, H 4.914ft 17:55. Day range ~ -0.2 to 5.7 ft.',
  '- NEAREST STATION for arbitrary towns: NOAA mdapi stations.json?type=tidepredictions + haversine nearest.',
  '- WAVES / OCEAN TEMP: Open-Meteo Marine (marine-api.open-meteo.com/v1/marine). hourly=wave_height,',
  '  wave_period,wave_direction,sea_surface_temperature,swell_wave_height,swell_wave_period,wind_wave_height;',
  '  daily=wave_height_max,wave_period_max,wave_direction_dominant; length_unit=imperial (feet); timezone;',
  '  past_days; forecast_days. NOTE: sea_surface_temperature comes back in CELSIUS -> convert to F (F=C*9/5+32).',
  '  Validated: swell event building Jun 14-15 ~3.5 ft; water ~21-24 C (~70-75 F).',
  '- UV / AIR / WIND: Open-Meteo Forecast (api.open-meteo.com/v1/forecast). hourly=uv_index,temperature_2m,',
  '  wind_speed_10m,wind_direction_10m,wind_gusts_10m; daily=uv_index_max,temperature_2m_max,temperature_2m_min;',
  '  temperature_unit=fahrenheit, wind_speed_unit=mph. Validated: UV peaks ~7-8 midday.',
  '- GEOCODING: Open-Meteo geocoding-api.open-meteo.com/v1/search?name=&count=8&language=en&format=json.',
  '- WINDOW: PAST_DAYS=7, FORECAST_DAYS=7 (a ~15-day window). Marine models reliable ~7 days out.',
  '  Upstream responses cached server-side via fetch next:{ revalidate: UPSTREAM_REVALIDATE=1800 } (30 min).',
  '',
  'ARCHITECTURE',
  '- App Router. The client Dashboard reads /api/forecast (a server route that fetches NOAA + Open-Meteo',
  '  in parallel, buckets hourly rows by local date key, scores surf, and returns ONE unified',
  '  ForecastBundle, cached). Location persists in localStorage. SMS is driven by a Vercel Cron hitting',
  '  /api/cron/surf-alert. Times from the APIs are LOCAL-NAIVE ISO strings (already in the spot timezone),',
  '  so the first 10 chars are the local date key.',
  '- DATA FLOW: browser -> /api/forecast -> lib/data/forecast.buildForecast(location) -> [noaa.ts tides,',
  '  openMeteo.ts marine+weather, stations.ts nearest] -> assembled DayForecast[] + bundle-level tideCurve',
  '  + tideExtremes -> JSON to the client.',
  '- FILE TREE (src/):',
  '  app/ layout.tsx (fonts, metadata, anti-flash theme script, ThemeProvider), page.tsx (renders',
  '    <Dashboard/> in a centered max-w-[560px] column), globals.css (the design system), manifest.ts',
  '    (PWA, served at /manifest.webmanifest), api/forecast/route.ts, api/location/search/route.ts,',
  '    api/cron/surf-alert/route.ts, api/alerts/subscribe/route.ts.',
  '  components/ Dashboard.tsx, TideChart.tsx (the hero), WeekStrip.tsx, LocationSearch.tsx, DayDetail.tsx,',
  '    HourlySurf.tsx, ThemeProvider.tsx, ThemeToggle.tsx, AlertSheet.tsx.',
  '  hooks/ useForecast.ts (fetch bundle, reload, abort), useLocalStorage.ts (SSR-safe, cross-tab sync).',
  '  lib/ types.ts (all shared types + component prop contracts), config.ts (DEFAULT_LOCATION, endpoints,',
  '    PAST_DAYS/FORECAST_DAYS, LS keys, ALERT_SENSITIVITY, DAY_START_HOUR=6/DAY_END_HOUR=19),',
  '    format.ts (cn, dateKey, parseLocal, minutesOfDay, weekday/month/long date, clockTime, shortHour,',
  '    feet, temp, compass, addDays, nowLocalISO, todayKeyAt), surf.ts (scoring), sms.ts (Twilio),',
  '    supabase.ts (server client), subscriptions.ts (RPC wrappers), data/{noaa,openMeteo,stations,forecast}.ts.',
  '  Root: vercel.json (cron), .env.example, .env.local (gitignored), scripts/gen-icons.mjs, public/ icons.',
  '- KEY TYPES (lib/types.ts): Location{name,lat,lon,stationId,stationName?,timezone}; TideSample{time,height};',
  '  TideExtreme{time,height,type:H|L}; MarineHour; WeatherHour; SurfScore{score,rating,label,factors,reasons};',
  '  SurfHour; DayForecast{date,weekday,tideExtremes,tideSamples,marine,weather,surfByHour,seaSurfaceTemp,',
  '  uvMax,airTempMax,airTempMin,surf,isPast}; ForecastBundle{location,todayKey,nowLocalISO,rangeStart,',
  '  rangeEnd,days,tideCurve,tideExtremes}; PlaceResult; theme + component-prop types.',
  '',
  'DESIGN SYSTEM (the pivot is the story)',
  '- v1 shipped a dark "Deep Tide" OLED/glassmorphic premium look. Connor REJECTED it as too techy/',
  '  fintech/sterile ("techno brainiac"), and gave vintage-surf reference photos (60s Mustang + longboards',
  '  Kodachrome, pastel surfboards, golden-hour surfer, rocky shore + gulls). Direction: WARM, SUN-FADED,',
  '  60s/70s surf culture; analog, nostalgic, film-grain; NOT cold/neon/tech.',
  '- Implemented two warm themes, auto-switching by local hour (sunrise 06:00-19:00, else deeptide) plus a',
  '  manual toggle. Internal theme ids stay "sunrise"/"deeptide" (used by ThemeProvider/bootstrap/config —',
  '  do not rename), but they now render as:',
  '  LIGHT = "Sun-Faded": cream bg (#f1e4ca / base #f4ead4), peach top glow (#f8dcbb), seafoam edge (#d6e6d6),',
  '    warm paper cards, faded coral primary (#df6a4b), seafoam teal accent + tide line (#4f9d85), butter',
  '    (#e3ad48), sepia ink text (#43352a), muted (#8a6f56). good/fair/poor = seafoam/butter/terracotta.',
  '  DARK = "Golden Hour": warm dusk teal-brown (#182320 / base #151e1c) with an AMBER horizon glow',
  '    (#4b3324) — NOT cold navy. Sunset coral primary (#ef8a5d), faded teal accent (#6fb6a0), GOLD tide',
  '    line (#edb069) like sunset on water, warm cream text (#f3e4cc), soft warm glow.',
  '- Tailwind v4 mechanics: CSS-first. globals.css has @import "tailwindcss"; @custom-variant dark',
  '  (&:where(.dark, .dark *)); CSS vars on :root (light) + .dark (Golden Hour); @theme inline maps vars ->',
  '  utility tokens (bg-bg, bg-surface, text-text, text-muted, text-faint, text-primary, text-accent,',
  '  text-tide, text-good/fair/poor, border-border/hairline) so flipping .dark re-themes live. Custom',
  '  utilities: glass / glass-strong (warm paper cards), tide-glow, tabular, no-scrollbar, edge-fade-x.',
  '  Plus --surface-solid (opaque popover bg). Film-grain overlay via body::after (SVG fractalNoise, low',
  '  opacity, mix-blend). Anti-flash: a synchronous <script> in layout sets the theme class before paint.',
  '- Fonts (next/font/google): Fraunces (warm wonky serif) for the wordmark/headings/big numbers — often',
  '  italic; DM Sans for body/data/UI. CSS vars --font-fraunces / --font-dm-sans -> --font-display / --font-sans.',
  '- Theme system is extensible; two future themes Connor liked but we have NOT built: "Blueprint" (minimal',
  '  editorial) and "Tidewatch" (instrument/dive-computer).',
  '',
  'SURF SCORING (lib/surf.ts) — pure, no I/O, all thresholds grouped/commented for tuning',
  '- Exports: COAST_FACING_DEG=110 (Stone Harbor beach faces ~ESE; offshore wind from ~290 deg / WNW);',
  '  scoreHour({waveHeight,wavePeriod,windSpeed,windDirection,coastFacingDeg?}) -> SurfScore;',
  '  summarizeDay(hours) -> best daylight (06-19) hour SurfScore; ratingOf(score) -> rating.',
  '- Sub-scores: WAVE (weight 0.5): flat <1.5ft; sweet spot ~head-high (~4-5ft) peaks near 100; eases 6-7ft;',
  '  hard penalty >8ft (closeouts). PERIOD (0.2): <5s windslop low; rising 6/7/8s; 9-11s+ groundswell high.',
  '  WIND (0.3): offshore bearing = (coastFacingDeg+180) mod 360; cosine offshore->onshore falloff times a',
  '  magnitude curve; light-wind (<5mph) glassy override scores high any direction; strong onshore collapses',
  '  to near 0.',
  '- Gating keeps everyday NJ slop out of the good band: a sizeCeiling caps the total by wave height (a',
  '  glassy SMALL morning cannot ride wind+period into "good"); junky wind caps at 56; "epic" requires BOTH',
  '  head-high size (wave sub >=88) AND groundswell period (period sub >=82).',
  '- ratingOf: flat<20, poor<40, fair<60, good<78, else epic.',
  '- Calibration checks: dead flat->flat(12); onshore summer slop->poor(22); small clean windswell->fair(45);',
  '  clean chest-high AM->good(77); head-high groundswell->epic(96); oversized storm->poor(25). Goal: roughly',
  '  1-3 genuinely good mornings/week in a typical Stone Harbor summer (not daily, not monthly).',
  '- Research basis: NJ summer averages 0-2ft / 5-9s windswell; best on SE swell + NW (offshore) wind;',
  '  <10s = windswell, 10-12s = quality groundswell; beach breaks close out as size climbs. Sources:',
  '  swellinfo.com (Seaside Heights), deepswell.com (LBI), surf-forecast.com (Ocean City 8th St),',
  '  surfline.com (wave-period-explained, groundswell-vs-windswell).',
  '',
  'ALERTS / SMS (Twilio + Vercel Cron + Supabase)',
  '- composeAlert(day, location) -> short plain-text SMS (no markdown): wave emoji + verdict + location;',
  '  long date + label + score/100; peak wave @ period from compass(dir); "Best window" (a run of consecutive',
  '  well-scoring daylight hours); water temp + UV; tide times. sendText(to, body) and sendSurfText(body)',
  '  (to env ALERT_TO_NUMBER) use the twilio package via lazy import; they return {sent:false, reason} instead',
  '  of throwing when Twilio is unconfigured (the app must work without it).',
  '- /api/cron/surf-alert (export const dynamic="force-dynamic"): auth = open if CRON_SECRET unset, else',
  '  Authorization: Bearer <CRON_SECRET> (Vercel sends this) OR ?key=<CRON_SECRET> for manual testing.',
  '  Reads enabled Supabase subscriptions (mode "subscriptions"): builds ONE forecast per unique beach,',
  '  finds TOMORROW (addDays(todayKey,1)), and for each subscriber texts them when tomorrow score >=',
  '  their min_score AND last_alerted_date != tomorrow, then mark_alerted (dedupe). Fallback mode "env":',
  '  a single ALERT_TO_NUMBER at the ALERT_* env location when Supabase/subs are absent. Never throws to client.',
  '- vercel.json crons: path /api/cron/surf-alert, schedule "0 22 * * *" = 22:00 UTC = 6 PM EDT (summer).',
  '  DST caveat: in EST that is 5 PM; surf season is EDT so 6 PM holds. Vercel Hobby allows once-daily cron.',
  '- AlertSheet UI: a bell button (top-left of the centered header) opens a bottom sheet: phone input',
  '  (validated/normalized to E.164), sensitivity segmented control (Fair & up=45 / Good & up=62 / Only',
  '  epic=80, from config.ALERT_SENSITIVITY), a "sent ~6 PM the day before" note, Turn on / Update / Turn',
  '  off. Prefs persist to localStorage (LS_ALERTS) and POST to /api/alerts/subscribe. The bell shows a',
  '  green dot when enabled.',
  '- /api/alerts/subscribe: validates+normalizes phone; upserts to Supabase via the gated RPC (passing the',
  '  server CRON_SECRET); sends a one-time confirmation text so the wiring is verifiable. Returns',
  '  {ok, phone, persisted, confirmation:"sent"|"skipped", reason}.',
  '',
  'SUPABASE (alert store)',
  '- Project "SideProjects", ref vigbcnztxhgwduxexkwb, region us-east-2. It is in the claude.ai-connected',
  '  Supabase account (a different account than the other connected Supabase MCP). Shares its DB with',
  '  another app (StackMerge: public.stack_merge_scores / stack_merge_players), so SurfCast lives in a',
  '  DEDICATED schema named surfcast.',
  '- Table surfcast.subscriptions: id uuid pk (gen_random_uuid), phone text UNIQUE, enabled bool,',
  '  min_score int, location_name text, lat float8, lon float8, station_id text, timezone text,',
  '  last_alerted_date date, created_at, updated_at. RLS ENABLED with NO policies (locked; clients cannot',
  '  touch it directly).',
  '- Table surfcast.app_config(key,value): holds key cron_secret_sha256 = the SHA-256 hex of CRON_SECRET.',
  '- SECURITY MODEL: all access flows through public SECURITY DEFINER functions, each gated by',
  '  surfcast.check_secret(p_secret) which compares encode(extensions.digest(p_secret,sha256),hex) to the',
  '  stored hash. Functions: surfcast_upsert_subscription(p_secret, p_phone, p_enabled, p_min_score,',
  '  p_location_name, p_lat, p_lon, p_station_id, p_timezone); surfcast_active_subscriptions(p_secret) ->',
  '  setof rows; surfcast_mark_alerted(p_secret, p_phone, p_date). All have a fixed search_path and are',
  '  granted EXECUTE to anon, authenticated. anon also gets USAGE on schema surfcast (needed for the',
  '  composite return type) but NO table privileges. Net effect: even with the publishable key, nobody can',
  '  read phone numbers or insert spam without the secret.',
  '- App access: lib/supabase.ts builds a server-only client from env SUPABASE_URL + SUPABASE_PUBLISHABLE_KEY',
  '  (publishable key, format sb_publishable_...). The BROWSER NEVER talks to Supabase directly — only our',
  '  server API routes do. lib/subscriptions.ts wraps the RPCs (upsertSubscription{secret,...},',
  '  listActiveSubscriptions(secret), markAlerted(secret,...), rowToLocation).',
  '- Connor was seeded as a subscription: +14848853686, Stone Harbor, min_score 62, enabled.',
  '- Migrations applied: surfcast_alerts_schema (schema+tables+RPCs+grants+hash) then surfcast_gate_upsert',
  '  (added the secret gate to the upsert, closing a spam-insert vector the advisor flagged).',
  '- Supabase security advisor after hardening: the only findings on SurfCast objects are intentional INFO',
  '  (rls_enabled_no_policy on the deliberately-locked tables); all WARN findings belong to the pre-existing',
  '  StackMerge objects, not SurfCast.',
  '- End-to-end cron test result: {"mode":"subscriptions","subscribers":1,"sent":0,"results":[{"phone":',
  '  "...3686","checked":"2026-06-12","score":36,"sent":false,"reason":"below-threshold"}]} — proved the',
  '  full chain (auth -> gated Supabase read -> per-sub forecast -> threshold) without sending a text.',
  '',
  'ENVIRONMENT & SECRETS (values live ONLY in ~/Development/surfcast/.env.local; gitignored, chmod 600)',
  '- Twilio: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER. These were located in Connor\'s',
  '  other projects and copied file-to-file from casetracker/.env (a dev env); they MAY BE STALE and were',
  '  not yet validated with a real send. A safety classifier blocked bulk-dumping secrets across projects',
  '  into the transcript; the copy was done without printing values.',
  '- ALERT_TO_NUMBER = +14848853686 (Connor\'s cell). ALERT_LOCATION_NAME/ALERT_LAT/ALERT_LON/',
  '  ALERT_STATION_ID/ALERT_TIMEZONE (Stone Harbor defaults). ALERT_MIN_SCORE=62.',
  '- CRON_SECRET: generated 64-hex (openssl rand -hex 32 x... 64 chars). Its SHA-256 is stored in Supabase',
  '  app_config; if it ever rotates, that row must be updated too.',
  '- SUPABASE_URL (https://vigbcnztxhgwduxexkwb.supabase.co), SUPABASE_PUBLISHABLE_KEY (sb_publishable_...).',
  '  SERVER-ONLY (NOT NEXT_PUBLIC) — the browser never hits Supabase.',
  '- .env.example documents every var with placeholders (no values) for deploy.',
  '- localStorage keys (client): surfcast.location, surfcast.theme, surfcast.alerts.',
  '',
  'BUILD PROCESS & NEXT.JS 16 GOTCHAS',
  '- Scaffolded with create-next-app (Next 16). The foundation + every integration seam (types, config,',
  '  format, the globals.css design system, layout, manifest, vercel.json, icons) was hand-authored for',
  '  coherence. Then a multi-agent WORKFLOW built the leaf modules in parallel against the locked contracts',
  '  (8 build agents: surf scoring w/ web research; data layer + API routes; sms + cron; theme provider +',
  '  toggle; TideChart; WeekStrip + LocationSearch; DayDetail + HourlySurf; Dashboard + hooks + page), then',
  '  a VERIFY agent made next build pass (fixed a barrel import @/lib/data -> @/lib/data/forecast), then a',
  '  design-REVIEW agent fixed real bugs: compass() returned undefined on negative bearings; clockTime()',
  '  produced "5:NaN" on minute-less timestamps; WeekStrip arrow keys hijacked Cmd/Alt shortcuts; and a',
  '  janky first-mount auto-scroll "fly-in" on all three horizontal scrollers.',
  '- Verified live: /api/forecast returned 15 days, 360 hourly tide points, 57 extremes for Stone Harbor;',
  '  screenshots of both themes captured via Playwright at iPhone size.',
  '- Next.js 16 specifics that mattered (its bundled AGENTS.md warns it differs from training data; the real',
  '  docs ship in node_modules/next/dist/docs): params/searchParams/headers()/cookies() are ASYNC (await);',
  '  route handlers are route.ts exporting GET/POST etc., NOT cached by default (use fetch next:{revalidate}',
  '  or dynamic="force-static"); Tailwind v4 is CSS-first with @theme inline + @custom-variant dark (no',
  '  tailwind.config needed); Turbopack default; middleware renamed to proxy; revalidateTag now needs a',
  '  second cacheLife arg; cacheLife/cacheTag are stable; manifest.ts is served at /manifest.webmanifest;',
  '  RouteContext / PageProps global type helpers are generated by next typegen.',
  '',
  'TIMELINE (all 2026-06-11)',
  '1. Groundwork: located ~/Development as the dev folder; validated all 3 free APIs live for Stone Harbor;',
  '   found NOAA station 8535581; chose Next.js + Vercel + Twilio + Open-Meteo + NOAA.',
  '2. Asked 2 design questions: Connor chose auto light/dark (originally Sunrise + Deep Tide), and "build',
  '   SMS fully, add creds later".',
  '3. Hand-built the foundation; ran the build workflow -> working app, both themes, next build green.',
  '4. Connor pivoted the whole aesthetic to the warm sun-faded surf vibe (rejected the OLED look). Rebuilt',
  '   the design system (Sun-Faded + Golden Hour, Fraunces + DM Sans, film grain) — mostly CSS-var work',
  '   thanks to @theme inline, so components were not rewritten.',
  '5. Connor punch-list: fixed tide-chart label overlap (taller chart + height-banded labels: NOW tag ->',
  '   day header -> high labels -> curve -> low labels); centered the "SurfCast" wordmark; fixed the search',
  '   dropdown rendering behind everything (z-50 + opaque --surface-solid); added "Highest at" to the',
  '   overview; replaced the dead top-left wave button with an ALERT bell + the AlertSheet (phone + prefs).',
  '   Located Twilio keys in casetracker/.env and wired them.',
  '6. Connor: added his cell + asked to wire Supabase (SideProjects). Built the surfcast schema, secret-',
  '   gated RPCs, rewired cron + subscribe to the DB, hardened the upsert per the security advisor, ran the',
  '   advisor clean, and tested the cron end-to-end.',
  '',
  'OPEN ITEMS / NEXT STEPS',
  '- VALIDATE TWILIO with a real send (Connor can tap the bell -> "Turn on alerts" to get a confirmation',
  '  text). The casetracker keys may be dead; if so, drop in fresh ones.',
  '- DEPLOY to Vercel: push the repo (needs a git remote or the vercel CLI), set ALL .env.local vars in the',
  '  Vercel project settings, confirm the cron registers. Then add to the iPhone home screen.',
  '- ROADMAP: tune the surf thresholds with real-world feel; build the Blueprint / Tidewatch themes; add',
  '  Twilio STOP/opt-out compliance; a per-location alert picker in the UI; polish the Golden Hour theme;',
  '  the review agent\'s remaining nits (selected-day band faint in light, edge-fade clipping at strip ends,',
  '  WeekStrip pill width slightly under the 44pt touch target, disable floaty/pulse under reduced motion).',
].join('\n')

const RULES = [
  'RULES FOR EVERY DOCUMENT:',
  '- Write rich, deep, well-structured GitHub-flavored Markdown: a clear H1 title, sectioned with H2/H3,',
  '  tables where they help, and fenced code blocks for SQL / config / JSON / shell / TS snippets.',
  '- Use ONLY facts from the brief (plus widely-known general background, which you must clearly frame as',
  '  general context, not project specifics). DO NOT invent project specifics, file contents, numbers,',
  '  or names that are not in the brief.',
  '- NEVER write real secret values. Refer to credentials by ENV VAR NAME only; mask anything sensitive.',
  '- Cross-link sibling docs by their filename (e.g. see [09-supabase.md](09-supabase.md)).',
  '- Address the reader as "you"/"Connor" where natural; explain the WHY, not just the WHAT. Be the kind of',
  '  doc that, six months from now, lets someone rebuild or extend this confidently.',
  '- Write the file to the EXACT absolute path given. Return only a one-line confirmation of what you wrote.',
].join('\n')

const doc = (file, scope) =>
  agent([BRIEF, '', RULES, '', 'YOUR DOCUMENT: write ' + DEST + '/' + file, '', scope].join('\n'),
    { label: file, phase: 'Author' })

phase('Author')

await parallel([
  () => doc('01-vision-and-overview.md',
    'The vision + overview. What SurfCast is, who it is for, the problem it solves, the guiding principles ' +
    '(warm/analog not techy; phone-first; "is it worth paddling out?"), the headline feature set, and a ' +
    'short tour of how the pieces fit. Set the tone for the whole folder.'),
  () => doc('02-original-request-and-requirements.md',
    'Reconstruct Connor\'s original request and turn it into a clean, numbered requirements spec: functional ' +
    'requirements (tides as wavy scrollable lines, week strip, day detail, hourly surf, ocean temp, UV, ' +
    'wind, location search + persistence, good-day texts ~6pm day before via Twilio), non-functional ' +
    '(free/cheap APIs, PWA on Vercel, great warm design, mobile-first), and explicit deferrals/"negotiable ' +
    'later" items. Note what was delegated to judgment (e.g. the surf threshold).'),
  () => doc('03-decisions-and-tradeoffs.md',
    'A decision log. For each major decision, capture: the choice, the alternatives considered, and the ' +
    'reasoning. Cover: Next.js + Vercel; free APIs (NOAA + Open-Meteo) vs paid; proxying through our own ' +
    '/api/forecast vs calling APIs from the client; localStorage for the UI location vs a DB; the design ' +
    'pivot (OLED -> sun-faded) and why; auto theme by time of day; Supabase for the alert store + the ' +
    'secret-gated-RPC security posture vs service-role; env-config fallback vs DB-driven cron; the hand-' +
    'authored foundation + multi-agent build approach. Be honest about tradeoffs and what is still provisional.'),
  () => doc('04-architecture.md',
    'The architecture reference. Cover: the request/data flow (browser -> /api/forecast -> buildForecast -> ' +
    'NOAA + Open-Meteo -> unified ForecastBundle), the local-naive time model and date-key bucketing, the ' +
    'full src/ file tree with a one-line purpose for each file, the component map (Dashboard as integrator; ' +
    'TideChart/WeekStrip/DayDetail/HourlySurf/LocationSearch/AlertSheet/Theme*), the hooks, the API routes, ' +
    'and the key TypeScript types from lib/types.ts. Include an ASCII data-flow diagram and a directory tree.'),
  () => doc('05-data-sources-and-apis.md',
    'The data sources bible. For NOAA CO-OPS (tides), the nearest-station mdapi lookup, Open-Meteo Marine ' +
    '(waves + sea temp, Celsius->F note), Open-Meteo Forecast (UV/air/wind), and Open-Meteo geocoding: ' +
    'document the exact base URL, every parameter used, the response shape, units, the local-time behavior, ' +
    'the caching (revalidate 1800s), the 15-day window (PAST_DAYS/FORECAST_DAYS), and the validated sample ' +
    'values. Include copy-pasteable example request URLs (no secrets — these APIs need no keys).'),
  () => doc('06-design-system.md',
    'The design system + the pivot story. Tell the story (OLED v1 rejected -> warm sun-faded surf from the ' +
    'reference photos). Document both palettes (Sun-Faded light + Golden Hour dark) with the hex values and ' +
    'what each token means, the Tailwind v4 mechanics (@theme inline, @custom-variant dark, the CSS-var ' +
    'runtime theming, the custom utilities glass/glass-strong/tide-glow/tabular/no-scrollbar/edge-fade-x/' +
    '--surface-solid), the film grain, the anti-flash bootstrap, the fonts (Fraunces + DM Sans), the auto/' +
    'manual theme switching and the internal "sunrise"/"deeptide" ids, and the two future themes. Include a ' +
    'token table per theme.'),
  () => doc('07-surf-scoring.md',
    'The surf-scoring spec. Explain the philosophy (calibrated to a mid-Atlantic NJ beach break so good days ' +
    'are ~1-3 mornings/week). Document scoreHour\'s inputs, the three weighted sub-scores (wave 0.5 / wind ' +
    '0.3 / period 0.2) with their curves, COAST_FACING_DEG=110 and the offshore-bearing math, the gating ' +
    '(sizeCeiling, junky-wind cap, the epic gate), ratingOf thresholds, summarizeDay, the calibration ' +
    'scenarios table, and the research basis + sources. Make it tunable-from-this-doc.'),
  () => doc('08-alerts-sms-and-cron.md',
    'The alert pipeline end to end. composeAlert message anatomy (with an example), sendText/sendSurfText + ' +
    'graceful-no-op behavior, the AlertSheet UX (bell -> sheet -> phone + sensitivity + save), ' +
    '/api/alerts/subscribe (validate -> upsert -> confirmation text), and /api/cron/surf-alert (auth, the ' +
    '"subscriptions" vs "env" modes, per-beach forecast reuse, the tomorrow + threshold + dedupe logic). ' +
    'Document the vercel.json cron schedule and the 6pm/UTC/DST nuance. Reference [09-supabase.md] and ' +
    '[10-environment-and-secrets.md].'),
  () => doc('09-supabase.md',
    'The Supabase reference. Identify the project (SideProjects, ref, account, shared with StackMerge -> ' +
    'dedicated surfcast schema). Document the subscriptions + app_config tables, RLS-locked-no-policy posture, ' +
    'the SECURITY DEFINER + sha256-gated RPC model (check_secret, upsert/active/mark_alerted), the grants, ' +
    'and WHY this is secure even with a publishable key. Include the full migration SQL (reconstructed from ' +
    'the brief), how the app calls it (lib/supabase.ts + lib/subscriptions.ts, server-only), the seeded row, ' +
    'the advisor outcome, and the end-to-end cron test result. Note: rotating CRON_SECRET means updating the ' +
    'app_config hash.'),
  () => doc('10-environment-and-secrets.md',
    'The environment + secrets reference. A table of EVERY env var (name, purpose, example/placeholder, where ' +
    'used) for Twilio, the alert location, CRON_SECRET, and Supabase — NAMES ONLY, never values. Explain ' +
    '.env.local (gitignored, chmod 600) vs .env.example, the localStorage keys, how the Twilio keys were ' +
    'sourced (casetracker/.env, possibly stale, copied without printing; the classifier guardrail), and the ' +
    'secret-handling principles (server-only Supabase, hashed cron secret, masked logs). End with a deploy ' +
    'checklist of vars to set in Vercel.'),
  () => doc('11-build-process-and-nextjs16.md',
    'How SurfCast was actually built + the Next.js 16 gotchas. Describe the approach (hand-authored ' +
    'foundation/contracts, then the multi-agent workflow of 8 parallel build agents -> verify -> design ' +
    'review), the bugs the review caught and fixed, and the live verification (forecast counts, Playwright ' +
    'screenshots). Then a thorough Next.js 16 / React 19 / Tailwind v4 gotchas section (async request APIs, ' +
    'route.ts handlers + caching, @theme inline, Turbopack, middleware->proxy, manifest.webmanifest, the ' +
    'bundled docs in node_modules/next/dist/docs).'),
  () => doc('12-timeline-and-changelog.md',
    'A chronological narrative + changelog of the whole initialization (all 2026-06-11): groundwork -> design ' +
    'Qs -> first build -> the design pivot -> the punch-list fixes -> adding the cell + Supabase wiring + ' +
    'hardening. Present it both as a readable story and as a tidy versioned changelog (v0.1 scaffold, v0.2 ' +
    'first working build, v0.3 warm redesign, v0.4 punch-list, v0.5 Supabase alerts). Make it easy to see ' +
    'what changed and when.'),
  () => doc('13-deploy-and-next-steps.md',
    'The operational guide. How to run locally (PORT=3100 npm run dev; npm run build), how to manually test ' +
    'the cron (?key=CRON_SECRET) and the forecast API, the step-by-step Vercel deploy (push repo, set every ' +
    'env var, verify the cron registers, add to home screen), and the prioritized OPEN ITEMS / roadmap ' +
    '(validate Twilio, deploy, tune thresholds, future themes, opt-out compliance, multi-location alerts, the ' +
    'remaining polish nits). Make it a checklist someone can execute.'),
])

phase('Verify')

const verify = await agent([
  'You are the fact-checker + editor for the SurfCast MEMORIES knowledge base at ' + DEST + '.',
  'Thirteen documents (01-..13-..) plus 00-README.md were just written.',
  '',
  'Against the AUTHORITATIVE BRIEF below, do three passes and FIX issues in place:',
  '1. ACCURACY: flag + correct any statement that contradicts the brief or invents project specifics not in',
  '   it (wrong hex, wrong param, wrong ref, wrong file path, fabricated values). When unsure, soften to',
  '   match the brief rather than assert.',
  '2. SECRETS: ensure NO real secret values appear anywhere (only env var names). Redact any that slipped in.',
  '3. CONSISTENCY + LINKS: make sure cross-doc facts agree (station 8535581, ref vigbcnztxhgwduxexkwb,',
  '   thresholds, palette names), and that inter-doc links use the right filenames. Fix small Markdown breakage.',
  '',
  'Read every file under ' + DEST + ' and edit the ones that need it. Keep the depth; do not gut content.',
  '',
  'Report: a per-file line (OK or what you changed), and any contradictions you could not resolve.',
  '',
  '=== AUTHORITATIVE BRIEF ===',
  BRIEF,
].join('\n'), { label: 'fact-check', phase: 'Verify' })

return { verify }
