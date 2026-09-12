# Fly Circuit

A browser-based QWOP-inspired fruit fly flight experiment. Ten keyboard channels stimulate real MaleCNS pathways, and the resulting modeled motor activity drives arcade wing forces. It is a small connectome-based prototype, not a whole-brain emulation or validated fly biomechanics model.

## Run

```sh
npm install
npm run dev
```

Open http://localhost:3000. Use Q/W/E/R/T for left-wing muscle channels and A/S/D/F/G for right-wing channels. Begin with Q+W and A+S; pulse to maintain altitude. Use T/G asymmetrically to bank and E/D or R/F for wing pitch. Space pauses. The on-screen keys support pointer/touch holds. Many keyboards limit simultaneous key presses; try pulsing pairs if a chord is not registered.

Replay shows the latest ~12 seconds of captured flight/activity at one-third speed. Slow flight slows biomechanics to one-quarter speed while keeping neural activity real-time for training. Blur and hidden tabs pause the game.

## Data and model

30 actual MaleCNS v1.0 skeletons, 141 measured connections in the export, and ten selected two-hop paths containing 20 simulated measured edges. The remaining edges are not simulated. Original morphology is centered and uniformly scaled; no invented neuron geometry. See [data/PROVENANCE.md](data/PROVENANCE.md) for source, attribution, and limits.

Use uv to reproduce the data asset:

```sh
uv run scripts/build_circuit.py --weights /tmp/fly-weights.feather
```

Download raw annotations and weights as documented in the provenance file first. Raw research files and Python environments are ignored by Git; the extracted game asset is committed.

## Architecture

- `public/neural-worker.js`: LIF neuron simulation; keyboard inputs only stimulate input neurons. Only actual modeled output spikes generate muscle activation.
- `lib/simulation.ts`: deterministic arcade biomechanics and gate collision detection.
- `components/BrainView.tsx`: Three.js actual morphology, selection, orbit, and illustrative event pulses.
- `components/RaceView.tsx`: Three.js course, fly, and chase camera.
- `app/page.tsx`: controls, worker lifecycle, pause/reset, replay and display.

## Verification

```sh
node --experimental-strip-types --test lib/simulation.test.ts
npx tsc --noEmit
npm run build
```

Nine tests cover real pathway independence, connection ablation, reset, fatigue, physics, ordered gates, and an eight-gate flight driven by actual worker output. A simultaneous all-key hold must fail. Browser rendering/interaction QA was not run because no browser was available in this session. Optional WebMCP read/reset tools are feature-detected; a supported WebMCP validation context was unavailable, so those tools are not verified.

Data: MaleCNS/FlyEM, HHMI Janelia Research Campus, Google Research and collaborators, CC-BY 4.0. Artificial muscle-action assignments and simulation constants are documented in-app.
