# LinkedFly

A browser-based QWOP-inspired fruit fly flight experiment. Six flight keys mapped to ten neural channels stimulate real MaleCNS pathways, and the resulting modeled motor activity drives arcade wing forces. It is a small connectome-based prototype, not a whole-brain emulation or validated fly biomechanics model.

## Run

```sh
npm.cmd ci
npm.cmd run dev
```

Open http://localhost:3000. Choose Single player, click Prepare for takeoff, then hold **W + O** to power both wings.

| Left hand / left wing | Action                           | Right hand / right wing |
| --------------------- | -------------------------------- | ----------------------- |
| Q                     | Bank / wing stroke extent        | P                       |
| W                     | Paired power + recovery wingbeat | O                       |
| E                     | Yaw / wing pitch                 | I                       |

Hold W + O to climb gently; release both to descend. Q/P bank sideways and automatically level out after release. E/I rotate your heading; release stops rotation and opposite yaw corrects the heading. These physical keys stimulate existing circuit inputs: they do not directly set position. Stronger damping and gentle high-altitude lift reduction make recovery easier. Space pauses; Training pace runs flight at half speed.

Follow the winding mint lane around a closed kitchen circuit. Start and finish share one checkered line; complete **one forward lap** to finish. Reversing across the line does not grant a lap. Floating fruit disappears when collected and gives a 2.5-second speed boost; food is separate for each racer and resets for a new race. There are no mandatory gates. Obstacles and timed swatter/water hits knock the fly down for 1.2 seconds on the ground, with a 2-second recovery protection window. No death or respawn. Reset restarts the food, boost, stun and flight state.

Replay captures the latest approximately 12 seconds at one-third speed, interpolating every animation frame from recorded timestamps, including consumed food, boosts and stun state. In single player, blur or hidden tabs pause play. Multiplayer never pauses the room when a guest loses focus; released input is sent instead. The on-screen six-button deck supports pointer holds, and Flight school explains the same six controls.

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
npm.cmd test
npx.cmd tsc --noEmit
npm.cmd run build
```

Tests cover real pathway independence, connection ablation, launch, fatigue, kitchen collisions, one-lap progression, reverse/shortcut rejection, food refresh, replay interpolation, and innate attacks (direction, range, cooldown, recovery protection). A feedback pilot completes the lap using real neural worker outputs with key decisions every 0.4 seconds. Browser-only WebRTC and real network behavior also require the manual checks below.

Data: MaleCNS/FlyEM, HHMI Janelia Research Campus, Google Research and collaborators, CC-BY 4.0. Artificial muscle-action assignments and simulation constants are documented in-app.

Map concept, routes, hazards, modular assets and multiplayer scope: [Kitchen design](KITCHEN_DESIGN.md).

CMU logo stickers on selected kitchen props use the original image from [CMU Brand Standards](https://brand.cmu.edu/visual-identity/carnegie-mellon-trademarks/university-logo). The kitchen theme and existing colors are retained.

## Multiplayer demo (browser host, no separate game server)

The creator is the host. The host browser runs every racer's neural worker, authoritative 60 Hz race simulation, lap counting, countdown and attack checks. Guests send only key states; approximately 30 snapshots per second are shared. Opponent display positions are smoothed. There is no extra process to start, database, account, or server secret.

**Two connection modes (both players must select the same mode):**

- **Same website · LAN demo (recommended)** is selected automatically when the updated dev server is detected. The existing website forwards WebSocket messages on its own port; it does not simulate the race. This avoids browser-to-browser WebRTC/UDP restrictions and public room matching. Everyone must open the same website server. No Internet signaling service or extra command is needed after dependencies are installed. This relay is included in `npm run dev` only; it is not a production/Cloudflare backend.
- **WebRTC · direct connection** preserves the original browser-to-browser mode. Internet access to the [PeerJS public PeerServer](https://peerjs.com/client/getting-started) is required for room matching. PeerJS includes default STUN/TURN endpoints, but their availability is not guaranteed. Campus isolation, NAT, VPNs and UDP restrictions may still prevent a channel opening. Loading the website does not prove this separate path is reachable.

### One computer, two windows

1. Install Node 22.13+ and run `npm.cmd ci`, then `npm.cmd run dev` from this folder. On macOS/Linux use `npm` instead of `npm.cmd`. The `.cmd` form avoids PowerShell's `npm.ps1` execution-policy error without changing policy.
2. Open `http://localhost:3000` in **two separate browser windows**, positioned side by side. Keep the host visible and do not minimize it. Chrome/Edge are suitable; no camera or microphone permission is needed.
3. Window A: fill in the profile and choose an outfit → Multiplayer → keep Same website selected → Create room. Its eight-character code identifies the room, and the creator is automatically the host.
4. Window B: choose a different name and outfit → Multiplayer → select the same connection mode → enter A's code → Join room. Both windows should show both players. Only A sees Start race; it enables at two players.
5. Click Start race in A. Both should show the same 3-second countdown, then race timer. Click the window to control that racer; hold W + O to take off. One keyboard controls only the focused window; use this test for connection and synchronization, and two laptops for simultaneous play.
6. When the first player completes one lap, everyone immediately sees results and social cards; unfinished players are marked DNF. The host can choose Race again. A guest closing its window is removed from the room. Closing/reloading/leaving the host ends the room and guests see an error. Recreate a room to play again.

### Multiple computers: separate website on each computer (WebRTC only)

Each computer checks out the **same version**, runs `npm.cmd ci` and `npm.cmd run dev`, and opens its own `http://localhost:3000`. Both MUST change Connection mode to **WebRTC** before creating/joining a room. Separate local website servers have separate Same website room lists. This option requires the laptops to reach the public signaling service and each other; prefer the shared website method below if cross-device WebRTC times out.

### Multiple computers: shared website (recommended for the demo)

On the laptop serving the page:

```powershell
npm.cmd ci
npm.cmd run dev -- --hostname 0.0.0.0
ipconfig
```

Find the Wi-Fi IPv4 address, e.g. `172.26.101.153`. ALL players open `http://172.26.101.153:3000`, choose Multiplayer, and select **Same website · LAN demo**. One player creates a NEW room and shares its code; the others join. Use the actual current address/port printed by the dev command if different. After this update, restart the dev command and refresh every browser; old WebRTC codes are not LAN codes. If the Same website option is absent, confirm the updated server is running: `/__fly_room/status` should return `{"available":true,"protocol":3}`.

If Windows prompts, permit Node on the trusted **Private** network. Do not disable the firewall. The website needs to be reachable from each computer, including its WebSocket endpoint on the same port. The laptop serving the web page and the player creating the room need not be the same machine: the **Create room** player is always the simulation host. Keep both the website process and the host browser open. The development relay is an in-memory demo transport; restarting it removes its rooms.

No SSH is necessary. The Same website mode already uses the reachable website connection for game messages.

### Combat and race rules

- Six movement keys stay **Q W E / I O P**. **F** is a permanently available forward buzz attack, including an on-screen button. Hold to repeat every 1.5 seconds; no inventory or attack pickups.
- Hits reach up to 8 world units inside a forward cone (roughly ±49°), within 3 vertical units. They cannot hit behind you, during countdown, while stunned, or after finishing. The expanding golden wave indicates an attack; HITS increments on a successful hit.
- A hit drops the victim to the counter, then rests for 1.2 seconds. Recovery grants 2 seconds of immunity. Progress survives a hit. Food remains a speed boost, independent of combat.
- Finish times use the host's common race clock, including time spent waiting to launch or stunned. One lap wins and freezes the race for everyone. Late joins are rejected during a race; rooms allow 2–8 players.
- Single player retains pause, training pace and replay. Multiplayer has no local pause/slow-motion or replay that could desynchronize the match.

### Hackathon checklist and limitations

Before presenting, verify two names appear in both lobbies, countdown/timer agree, both flies move on both screens, F visibly stuns a nearby opponent, food boosts, one lap → shared results and social cards, and leaving the host reports that the room ended. Test invalid room codes and joining a race already in progress. Keep laptops plugged in and the host window visible: browser background throttling/sleep can slow the host simulation. The prototype has no host migration, reconnection into an active race, persistent rooms, or anti-cheat protection against the host. For a reliable live demo, use 2–4 laptops on the same tested hotspot; the eight-player cap is not a measured capacity guarantee.

If the room times out, first check the connection mode on BOTH computers. For Same website, check that both URLs reach the same updated dev process; restart it and recreate the room. For WebRTC, stage 1 means public matching, stage 2 means opening the ICE/data channel, and stage 3 means host admission. Switch BOTH players to Same website if stage 2 stalls. Negotiation allows 45 seconds, and the host's separate 10-second admission deadline now starts only after the channel opens. A failed guest negotiation no longer destroys the host room. If a campus network blocks access to the website itself, try a shared phone hotspot; the IP address will change.

Verified in this implementation: 36 automated tests, TypeScript checks, scoped lint and production build. The new relay test checks real WebSocket clients, large result payloads, room isolation and host departure; timer tests cover slow ICE negotiation and cancellation after admission. Browser QA on the actual LAN URL verified Same website create/join, two-player roster, host-only start, identical race clocks and host exit notification. The relay uses the `vite-flycircuit-v3` subprotocol so Cloudflare's dev plugin leaves its upgrade requests to this local plugin instead of also forwarding and closing them.

Earlier WebRTC QA verified create/join, host-only start, shared clock and host exit notification. A temporary test fixture also triggered the host finish state and verified that the guest received both profiles, customized appearances, recorded neural clips, winner statistics and DNF through the real connection. The fixture was removed after testing; normal finish detection is covered by the automated lap test. Simultaneous human flight/combat on separate physical laptops and eight-player load still need the checklist above.

## Profiles, outfits and post-race social cards

The first screen is a profile/outfit editor: optional display name, school/program/year, interests, short bio, profile website and connect link. Six preset body colors plus a custom color picker, four hat choices (none/cap/crown/wizard), and three shoe choices (none/sneakers/boots) use the same procedural 3D fly in the preview, race and card. Click Multiplayer or Single player to save and continue. Back returns to the editor.

Only your own profile is saved locally (`flycircuit-profile-v1` in browser storage). The profile you submit is shared with everyone in your room, so enter only information you want them to keep. This is not an account system. Profile/link strings and appearance options are bounded and sanitized by the host; only HTTP(S) links without embedded credentials are accepted. No profile files or image uploads are required.

The first one-lap finisher ends the race for everyone. Finishers get a host-clock race time (centiseconds); everyone else has DNF rather than a fabricated finish time. Social cards include the submitted profile, exact fly outfit, highest unstunned flight speed, and a gameplay signature called Neural Style. The label uses recorded turn rate, wing-output balance, and boost time; it is not an inference about someone's biological brain or personality. A same-tick finish is displayed as a tie.

Connect opens the player's supplied connect URL (for example LinkedIn) in a new tab; it does not silently send a message or create a friendship record. View Profile opens the full profile and its website link. Missing links are shown as unavailable. The cards remain on an already-loaded results screen if the host leaves; a rematch resets race statistics and recordings but keeps each player's profile/outfit.

Each host worker records up to 30 neural frames over the last approximately 3 seconds of racing, then freezes them at the finish. The card animates the recorded spike IDs and muscle outputs over a 2D projection of the real MaleCNS neuron skeletons. This is a compact visual replay, not a screen capture of the rotatable 3D brain mesh. Signals are never randomly fabricated. The standalone exports are:

- **Save PNG**: 960 × 720 card, using the most active recorded spike frame from the final clip.
- **Save GIF**: 640 × 480 animated card with the recorded signal timing, encoded locally with [gifenc](https://github.com/mattdesl/gifenc). A progress indicator appears while encoding. No recording means GIF is disabled; PNG still describes the available data.

Image exports include the player's links as readable text; interactive Connect/View Profile buttons belong to the website. Image downloads do not automatically publish anything. Test exports with a sample profile first; inspect text, full wings/hat/shoes, animation, missing-link behavior and DNF. Browser QA used an isolated synthetic profile with actual neural-worker signals and confirmed a 30-frame, 3-second GIF plus a readable PNG.
