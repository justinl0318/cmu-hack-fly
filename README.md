# Fly Circuit

A browser-based QWOP-inspired fruit fly flight experiment. Ten keyboard channels stimulate real MaleCNS pathways, and the resulting modeled motor activity drives arcade wing forces. It is a small connectome-based prototype, not a whole-brain emulation or validated fly biomechanics model.

## Run

```sh
npm install
npm run dev
```

Open http://localhost:3000. Click Prepare for takeoff, then hold **W + O** to power both wings.

| Left hand / left wing | Action | Right hand / right wing |
| --- | --- | --- |
| Q | Bank / wing stroke extent | P |
| W | Paired power + recovery wingbeat | O |
| E | Yaw / wing pitch | I |

Hold W + O to climb gently; release both to descend. Q/P bank sideways and automatically level out after release. E/I rotate your heading; release stops rotation and opposite yaw corrects the heading. These physical keys stimulate existing circuit inputs: they do not directly set position. Stronger damping and gentle high-altitude lift reduction make recovery easier. Space pauses; Training pace runs flight at half speed.

Follow the extended 384-unit winding mint lane through the cartoon kitchen to the checkered finish. Floating fruit disappears when collected and gives a 2.5-second speed boost. There are no mandatory gates. Obstacles and timed swatter/water hits knock the fly down for 1.2 seconds on the ground, with a 2-second recovery protection window. No death or respawn. Reset restarts the food, boost, stun and flight state.

Replay captures the latest approximately 12 seconds at one-third speed, interpolating every animation frame from recorded timestamps, including consumed food, boosts and stun state. Blur or hidden tabs pause play. The on-screen six-button deck supports pointer holds, and Flight school explains the same six controls.

The neural panel includes the public MaleCNS brain and VNC neuropil shells, aligned with the original skeleton coordinate transform. Local surface glow projects nearby simulated spike pulses onto the shell; this is an illustrative visualization, not measured cortical electrical activity. See [data/PROVENANCE.md](data/PROVENANCE.md) for sources and transformation details.

## Data and model

30 actual MaleCNS v1.0 skeletons, 141 measured connections in the export, and ten selected two-hop paths containing 20 simulated measured edges. The remaining edges are not simulated. Original morphology is centered and uniformly scaled; no invented neuron geometry. See [data/PROVENANCE.md](data/PROVENANCE.md) for source, attribution, and limits.

Use uv to reproduce the data asset:

```sh
uv run scripts/build_circuit.py --weights /tmp/fly-weights.feather
```

Download raw annotations and weights as documented in the provenance file first. Raw research files and Python environments are ignored by Git; the extracted game asset is committed.

## Architecture

- `public/neural-worker.js`: LIF neuron simulation; keyboard inputs only stimulate input neurons. Only actual modeled output spikes generate muscle activation.
- `lib/simulation.ts`: deterministic arcade biomechanics and kitchen collisions and finish detection.
- `components/BrainView.tsx`: Three.js actual morphology, selection, orbit, and illustrative event pulses.
- `components/RaceView.tsx`: Three.js course, fly, and chase camera.
- `app/page.tsx`: controls, worker lifecycle, pause/reset, replay and display.

## Verification

```sh
node --experimental-strip-types --test lib/simulation.test.ts
npx tsc --noEmit
npm run build
```

Tests cover real pathway independence, connection ablation, safe launch, reset, fatigue, physics, safe collisions, any-route finishes, kitchen hazards, and complete flights with key decisions only every 0.6, 0.8, or 1.0 seconds. The finish mode has no collision deaths. Kitchen rendering and the preparation UI were checked in the local browser. Optional WebMCP read/reset tools are feature-detected; a supported WebMCP validation context was unavailable, so those tools are not verified.

Data: MaleCNS/FlyEM, HHMI Janelia Research Campus, Google Research and collaborators, CC-BY 4.0. Artificial muscle-action assignments and simulation constants are documented in-app.

Map concept, routes, hazards, modular assets and multiplayer scope: [Kitchen design](KITCHEN_DESIGN.md).

CMU logo stickers on selected kitchen props use the original image from [CMU Brand Standards](https://brand.cmu.edu/visual-identity/carnegie-mellon-trademarks/university-logo). The kitchen theme and existing colors are retained.
