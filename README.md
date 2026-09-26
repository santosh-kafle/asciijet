# Jet Atlas

Fighters and bombers drawn entirely in ASCII, in the spirit of [gcdatlas](https://github.com/eshin087/gcdatlas).
26 aircraft, 84 weapons, tanks and pods, a live afterburner and loadouts you can change station by station.

Open `dist/index.html` in a browser. It is one self-contained file with no dependencies (Google Fonts is optional).

## What it does

| | |
| --- | --- |
| **ASCII renderer** | A software rasteriser draws each aircraft into 2 × 4 samples per character cell, then picks the glyph whose shape matches. Flat areas use a density ramp, edges use shaped characters. Runs at 60 fps on the CPU. |
| **Afterburner** | Throttle from idle through military power into reheat. Engines spool up over a few seconds; the burner lights quickly. The plume grows, the nozzle face glows, shock diamonds appear, and the floor lights up orange. |
| **Engine model** | Thrust per engine and total, fuel flow, specific fuel consumption, how long the fuel lasts at the current setting, afterburner zone, a thrust and fuel-flow curve. Sea-level static figures. |
| **Loadouts** | 4 to 5 real presets per aircraft (air superiority, strike, SEAD, anti-ship, nuclear, ferry). Every station can be changed. Racks (twin, triple ejector, multiple), conformal rows, semi-recessed wells and rotary launchers are drawn as arranged. |
| **Weapon bays** | Press **B**: the doors open, the skin is cut away and the stores inside are shown (F-22, F-35, Su-57, J-20, B-52, B-1B, B-2, Tu-160, Tu-22M3, Tu-95, Vulcan). |
| **Weight and balance** | Empty, crew, internal fuel, tank fuel and stores against maximum take-off weight, thrust-to-weight and wing loading. Heavy bomber presets trim fuel automatically to stay under MTOW, as real crews do before tanking in the air. |
| **Swing wings** | F-14, Tornado, B-1B, Tu-160 and Tu-22M3 have a sweep slider; pylons stay aligned with the airflow. |
| **Propellers** | The Tu-95's contra-rotating propellers spin as a blurred disc when running. |
| **Loadout sheet** | Press **O**: a stores loading chart from left wingtip to right wingtip, totals by category, every weapon the aircraft is cleared for, and a detail card with a rotating ASCII model of the weapon: guidance, range, top speed, warhead, propulsion, maker, year and which other aircraft carry it. |
| **Sound** | Press **M**. Synthesised live with Web Audio, no audio files: turbine whine and jet roar that follow the throttle and spool, afterburner light-off thump with rumble and crackle, the beating drone of the Tu-95's contra-rotating propellers, bay-door hydraulics and a latch click when stores change. Louder from behind the engines. |
| **Systems and history** | Radar, sensors, electronic warfare, unit cost, operators, combat record and variants for every aircraft. |
| **Visual detail** | Always drawn at maximum quality: about 340 character columns on a desktop screen and dense meshes. Canopies are seated on each fuselage's spine at their real height. Ink lines outline where parts meet and mark control-surface hinges and fuselage panel seams. Each aircraft wears its paint scheme (F-4 Southeast Asia camouflage, Su-35 blue splinter, Tornado and Vulcan green and grey, lighter undersides) and its national markings (US stars, Soviet and Russian red stars on wings and fins, French, British and Swedish roundels, Chinese stars). |
| **Landing gear** | Struts and wheels (**U**) from each aircraft's layout: the B-52's bicycle gear and outriggers, the A-10's wing pods, four-wheel bogies on the bombers. The floor sits at each aircraft's published height below the fin tip. |
| **Compare** | Add up to four aircraft (**C**) and compare them side by side. |
| **Store inspector** | Hover any weapon for its name, mass, size, guidance and range; click to highlight its station. |

## Controls

drag orbit · scroll / pinch zoom · **W/S** throttle · **A** afterburner · **1-6** views · **B** bays · **L** labels · **G** floor · **Space** orbit · **[ ]** loadouts · **← →** aircraft · **/** search · **C** compare · **O** loadout sheet · **M** sound · **U** gear

## Build

```sh
node build.mjs                 # writes dist/index.html, dist/artifact.html, dist/engine.cjs (Node 18+)
node tools/check.cjs           # data check: stores, stations, engine counts, every scene builds
node tools/ascii.cjs f16 150 20 1 0   # render an aircraft as text in the terminal (key yaw pitch throttle loadout)
node tools/smoke.cjs           # browser test over every aircraft (needs Playwright)
node tools/review.cjs f22,f35a # geometry review: top, side, front 3/4, rear 3/4 per aircraft -> tools/out/
node tools/contact.cjs         # all aircraft on contact sheets (top | side | front); SIDE=1 for large profiles
```

## Layout

| File | What it holds |
| --- | --- |
| `src/00-core.js` | math, materials, the mesh builder |
| `src/10-geom.js` | lofted bodies, airfoil panels, nozzles, propellers, swing-wing sweep |
| `src/20-stores.js`, `src/22-store-extra.js` | the weapons, tanks and pods, their meshes, speed, warhead and propulsion |
| `src/30-scene.js` | stations, rack arrangement, bay cut-outs, weight and engine model |
| `src/35-aircraft.js`, `src/36-bombers.js`, `src/37-details.js` | the aircraft, and their systems and programme details |
| `src/40-render.js`, `src/45-plume.js` | rasteriser, glyph resolve, floor, shadow, afterburner, propellers |
| `src/50-*.js` to `src/99-start.js` | the page: glyph matcher, sound, viewer loop, controls, panels, loadout sheet |

Files numbered below 50 have no DOM, so `dist/engine.cjs` runs in node.

## Adding an aircraft

Copy an entry in `src/35-aircraft.js`. Geometry is written in metres aft of the nose (`s`), up (`y`) and to starboard (`z`):

- `fus` / `pod` / `canopy`: lofted bodies through stations `[s, halfWidth, top, bottom, yCentre, n]`; `n` 2 is an ellipse, higher is boxier. `rake: { bot, out }` sweeps an intake lip back; `box: true` makes it a sharp rectangular duct.
- `{ t: 'ploft' }`: faceted, flat-shaded bodies for stealth shaping, through stations `[s, ring, yCentre]`. `hexa(w, top, bottom, chineY)` gives a chined cross-section, `duct(...)` a trapezoid intake with a raked lip.
- `wing` / `surf`: airfoil panels through sections `[sLeadingEdge, y, z, chord, thickness]`; `trap()` and `vfin()` build them from sweep and span.
- `noz`: one per engine; the check fails if the count does not match `eng.n`.
- `stations`: on a named wing (`on`, span fraction `f`) or at a point (`at`); `kind` is pylon, rail, conf, semi or bay.

Then `node build.mjs && node tools/check.cjs`.

## Accuracy

Dimensions, weights, thrust and performance are public figures for the variant named. Values that only exist as open-source estimates (most of the J-20 and Su-57, some fuel loads) are marked **EST** in the page. Shapes are simplified from three-view dimensions, not surveyed models. Thrust and fuel flow are sea-level static; fuel flow uses typical specific fuel consumption for the engine type unless a figure is given.
