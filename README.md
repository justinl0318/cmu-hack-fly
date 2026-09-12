# Fly Circuit

A browser-based QWOP-inspired fruit fly flight experiment. Ten keyboard channels stimulate real MaleCNS pathways, and the resulting modeled motor activity drives arcade wing forces. It is a small connectome-based prototype, not a whole-brain emulation or validated fly biomechanics model.

## Run

```sh
npm install
npm run dev
```

Open http://localhost:3000. Use Q/W/E/R/T for left-wing muscle channels and A/S/D/F/G for right-wing channels. Click Prepare for takeoff: the fly waits safely while you place your hands. Hold Q+W and A+S until all four output channels respond, which starts takeoff. Continue holding for lift; release to descend. Use T/G asymmetrically to bank and E/D or R/F for wing pitch. Space pauses. The on-screen keys support pointer/touch holds. Some keyboards limit simultaneous key presses; the four readiness indicators show which launch channels are responding.

Replay shows the latest ~12 seconds of captured flight/activity at one-third speed. Full-speed flight is the default, with faster cruise thrust. Optional Training pace slows biomechanics to half speed while keeping neural activity real-time. Blur and hidden tabs pause the game. Once launched, releasing all muscles eventually causes a crash; the preparation support is no longer active.

## Flight school

Open Flight school for five lessons: takeoff, altitude, banking, wing pitch, and a complete race. Previous/Next navigate lessons. Pin lesson & practice keeps instructions and live flight readings visible, highlights relevant muscle keys, and preserves the current flight; resume or prepare when ready.

- Hold Q+W+A+S to launch and build lift; briefly release to descend.
- While powering the wings, add T to bank toward screen-left or G toward screen-right in the chase view. Release early and counter with the other wing to limit drift.
- Add E+D for more thrust, R+F for braking. Keep managing the four lift muscles. Braking reduces thrust without producing reverse thrust.
- Start with the first two centered gates, then coordinate wing extent for the offset gates.

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

Tests cover real pathway independence, connection ablation, safe launch, reset, fatigue, physics, ordered gates, and complete flights with key decisions only every 0.6, 0.8, or 1.0 seconds. A simultaneous all-key hold must fail. Browser rendering/interaction QA was not run because no browser was available in this session. Optional WebMCP read/reset tools are feature-detected; a supported WebMCP validation context was unavailable, so those tools are not verified.

Data: MaleCNS/FlyEM, HHMI Janelia Research Campus, Google Research and collaborators, CC-BY 4.0. Artificial muscle-action assignments and simulation constants are documented in-app.
