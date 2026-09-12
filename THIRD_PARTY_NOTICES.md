# Third-party notices

## OpenRacer circuit

This project includes the `circuit.json`, `circuitScene.json`, and referenced
scene textures from [digi-chris/OpenRacer](https://github.com/digi-chris/OpenRacer).
Copyright (C) 2015 Chris Barnard.

OpenRacer is licensed under the GNU General Public License, version 3 or later.
The original scene data is retained in `public/assets/openracer/`; this project
is distributed under GPLv3 as well. The complete license text is in `LICENSE`.

The runtime loader in `components/RaceView.tsx` is a modern Three.js adaptation
written for this project. It reads the original scene data; it does not ship the
legacy OpenRacer JavaScript runtime.
