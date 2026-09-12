'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  CircleHelp,
  Pause,
  Play,
  RotateCcw,
} from 'lucide-react';
import ProfileSetup from '@/components/ProfileSetup';
import Brand from '@/components/Brand';
import { normalizeProfile, type PlayerProfile } from '@/lib/profile';
import MultiplayerGame from '@/components/MultiplayerGame';
import BrainView, { type Circuit } from '@/components/BrainView';
import Link from 'next/link';
import RaceView from '@/components/RaceView';
import FlightTutorial, { LESSONS } from '@/components/FlightTutorial';
import { createFlightState, stepFlight } from '@/lib/simulation';
import { interpolateReplay, type ReplayFrame } from '@/lib/replay';
import { CONTROLS, muscleInputs } from '@/lib/controls';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

const keys = CONTROLS.map((c) => c.key.toUpperCase());
export function SoloGame({ profile }: { profile: PlayerProfile }) {
  const [help, setHelp] = useState(false);
  const [lesson, setLesson] = useState(0);
  const [guide, setGuide] = useState(false);
  const [sources, setSources] = useState(false);
  const [circuit, setCircuit] = useState<Circuit | null>(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [running, setRunning] = useState(false);
  const [started, setStarted] = useState(false);
  const [slow, setSlow] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const speedRef = useRef(1);
  const [replay, setReplay] = useState(false);
  const [pressed, setPressed] = useState<string[]>([]);
  const [spikes, setSpikes] = useState<string[]>([]);
  const [activations, setActivations] = useState<number[]>(Array(10).fill(0));
  const [flight, setFlight] = useState(createFlightState);
  const worker = useRef<Worker | null>(null);
  const flightRef = useRef(createFlightState());
  const runRef = useRef(false);
  const replayRef = useRef(false);
  const slowRef = useRef(false);
  const activationRef = useRef<number[]>(Array(10).fill(0));
  const held = useRef(new Set<string>());
  const history = useRef<ReplayFrame[]>([]);
  const recordingClock = useRef(0);
  const replayClock = useRef(0);
  const replayIndex = useRef(0);
  const lastSpikes = useRef<string[]>([]);
  const clearKeys = useCallback(() => {
    held.current.clear();
    setPressed([]);
    worker.current?.postMessage({ type: 'input', pressed: [] });
  }, []);
  const setKey = useCallback((key: string, down: boolean) => {
    if (!runRef.current || replayRef.current) return;
    if (down) held.current.add(key);
    else held.current.delete(key);
    setPressed([...held.current]);
    worker.current?.postMessage({
      type: 'input',
      pressed: muscleInputs([...held.current]),
    });
  }, []);
  const pause = useCallback(() => {
    runRef.current = false;
    setRunning(false);
    clearKeys();
    worker.current?.postMessage({ type: 'pause', paused: true });
  }, [clearKeys]);
  const start = useCallback(() => {
    if (!ready) return;
    replayRef.current = false;
    setReplay(false);
    runRef.current = true;
    setRunning(true);
    setStarted(true);
    worker.current?.postMessage({ type: 'pause', paused: false });
  }, [ready]);
  const reset = useCallback(() => {
    pause();
    replayRef.current = false;
    setReplay(false);
    setStarted(false);
    flightRef.current = createFlightState();
    setFlight({ ...flightRef.current });
    history.current = [];
    recordingClock.current = 0;
    replayClock.current = 0;
    activationRef.current = Array(10).fill(0);
    setActivations([...activationRef.current]);
    setSpikes([]);
    worker.current?.postMessage({ type: 'reset' });
  }, [pause]);
  const startReplay = () => {
    pause();
    if (!history.current.length) return;
    replayIndex.current = 0;
    replayClock.current = history.current[0].at;
    replayRef.current = true;
    setReplay(true);
  };
  useEffect(() => {
    let live = true;
    const w = new Worker('/neural-worker.js');
    worker.current = w;
    w.onmessage = (event) => {
      if (!live) return;
      const m = event.data;
      if (m.type === 'error') {
        setError(m.message || 'The neuron simulation could not start.');
        return;
      }
      if (m.type === 'ready') {
        setReady(true);
        return;
      }
      if (m.type === 'frame' && !replayRef.current) {
        activationRef.current = m.activations;
        lastSpikes.current = m.spikes;
        setActivations(m.activations);
        setSpikes(m.spikes);
      }
    };
    w.onerror = () =>
      setError('The neuron simulation stopped. Reload to reconnect.');
    fetch('/data/circuit.json')
      .then((r) => {
        if (!r.ok) throw Error('Circuit data is unavailable.');
        return r.json() as Promise<Circuit>;
      })
      .then((data) => {
        if (live) {
          setCircuit(data);
          w.postMessage({ type: 'init', circuit: data });
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
      w.terminate();
      worker.current = null;
    };
  }, []);
  useEffect(() => {
    let raf = 0,
      last = 0,
      accumulator = 0;
    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (replayRef.current) {
        const frames = history.current;
        replayClock.current += dt / 3;
        while (
          replayIndex.current + 1 < frames.length &&
          frames[replayIndex.current + 1].at <= replayClock.current
        )
          replayIndex.current++;
        const a = frames[replayIndex.current],
          b = frames[replayIndex.current + 1];
        if (a && b) {
          const frame = interpolateReplay(a, b, replayClock.current);
          setFlight(frame.flight);
          setActivations(frame.activations);
          setSpikes(frame.spikes);
        } else {
          replayRef.current = false;
          setReplay(false);
          setFlight(structuredClone(flightRef.current));
          setActivations([...activationRef.current]);
          setSpikes([...lastSpikes.current]);
        }
      } else if (runRef.current) {
        stepFlight(
          flightRef.current,
          activationRef.current,
          dt * (slowRef.current ? 0.5 : 1),
          speedRef.current,
        );
        recordingClock.current += dt;
        accumulator += dt;
        if (accumulator >= 0.04) {
          accumulator %= 0.04;
          const snapshot = structuredClone(flightRef.current);
          setFlight(snapshot);
          history.current.push({
            at: recordingClock.current,
            flight: snapshot,
            activations: [...activationRef.current],
            spikes: [...lastSpikes.current],
          });
          while (
            history.current.length > 1 &&
            history.current[0].at < recordingClock.current - 12
          )
            history.current.shift();
        }
        if (flightRef.current.crashed || flightRef.current.finished) {
          setFlight(structuredClone(flightRef.current));
          runRef.current = false;
          setRunning(false);
          held.current.clear();
          setPressed([]);
          worker.current?.postMessage({ type: 'input', pressed: [] });
          worker.current?.postMessage({ type: 'pause', paused: true });
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input,textarea,[role="dialog"]'))
        return;
      const key = e.key.toLowerCase();
      if (CONTROLS.some((c) => c.key === key)) {
        e.preventDefault();
        if (!held.current.has(key)) setKey(key, true);
      }
      if (e.code === 'Space') {
        e.preventDefault();
        if (!e.repeat) {
          if (runRef.current) pause();
          else if (
            ready &&
            !flightRef.current.crashed &&
            !flightRef.current.finished
          )
            start();
        }
      }
    };
    const up = (e: KeyboardEvent) => setKey(e.key.toLowerCase(), false);
    const blur = () => pause();
    const visibility = () => {
      if (document.hidden) pause();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [ready, start, pause, setKey]);
  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: unknown,
            options: { signal: AbortSignal },
          ) => unknown;
        };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const tools = [
      {
        name: 'read_flight_state',
        description:
          'Read the current flight, circuit readiness, and stimulated muscle channels.',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true },
        execute: () => ({
          ready,
          position: flightRef.current.position,
          checkpoint: flightRef.current.checkpoint,
          elapsed: flightRef.current.elapsed,
          running: runRef.current,
          pressed: [...held.current],
        }),
      },
      {
        name: 'reset_flight',
        description:
          'Stop the current flight and reset the fly to the launch position.',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false },
        execute: (input: unknown) => {
          if (!input || typeof input !== 'object' || Object.keys(input).length)
            throw Error('Expected an empty object.');
          reset();
          return { status: 'reset', position: flightRef.current.position };
        },
      },
    ];
    for (const tool of tools) {
      try {
        Promise.resolve(
          context.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(() => {});
      } catch {}
    }
    return () => lifecycle.abort();
  }, [ready, reset]);
  const speed = Math.hypot(
    flight.velocity.x,
    flight.velocity.y,
    flight.velocity.z,
  );
  const clock =
    String(Math.floor(flight.elapsed / 60)).padStart(2, '0') +
    ':' +
    (flight.elapsed % 60).toFixed(1).padStart(4, '0');
  return (
    <main className="flight-lab">
      <header className="topbar">
        <Link href="/" aria-label="LinkedFly home">
          <Brand />
        </Link>
        <div className="experiment-tag">
          <span className="live-dot" /> MALECNS / MUSCLE CONTROL EXPERIMENT
        </div>
        <button
          className="quiet-button"
          onClick={() => {
            pause();
            setHelp(true);
          }}
        >
          <CircleHelp size={17} /> Flight school
        </button>
      </header>
      <section className="title-row">
        <div>
          <h1>Single player</h1>
        </div>
        <span className="dataset-badge">
          30 REAL NEURONS <ArrowUpRight size={14} />
        </span>
      </section>
      {guide && (
        <FlightTutorial
          step={lesson}
          onStep={setLesson}
          flight={flight}
          onClose={() => setGuide(false)}
        />
      )}
      {error && (
        <div className="error-banner" role="alert">
          {error} <button onClick={() => location.reload()}>Retry</button>
        </div>
      )}
      <section className="room-card" aria-label="Single-player flight settings">
        <div className="room-speed">
          <div className="room-speed-heading">
            <span id="solo-flight-speed-label">Flight speed</span>
            <output>{speedMultiplier}×</output>
          </div>
          <Slider
            aria-labelledby="solo-flight-speed-label"
            min={1}
            max={5}
            step={0.25}
            value={[speedMultiplier]}
            disabled={running || replay}
            onValueChange={(value) => {
              const speed = Array.isArray(value) ? value[0] : value;
              speedRef.current = speed;
              setSpeedMultiplier(speed);
            }}
          />
          <div className="room-speed-heading">
            <span>1×</span>
            <span>5×</span>
          </div>
          <p>
            Adjust before takeoff or while paused. Reset keeps your selected
            speed.
          </p>
        </div>
      </section>
      <section className="workspace">
        <div className="race-panel">
          <div className="panel-top">
            <span>
              <span className="live-dot" /> KITCHEN COUNTER CHAOS
            </span>
            <div className="race-actions">
              <span>1 LAP SPRINT</span>
              <button
                aria-label={running ? 'Pause flight' : 'Resume flight'}
                title="Pause / resume · Space"
                className="icon-button"
                disabled={!ready || flight.crashed || flight.finished}
                onClick={() => (running ? pause() : start())}
              >
                {running ? <Pause size={13} /> : <Play size={13} />}
              </button>
              <button
                aria-label="Reset flight"
                title="Reset flight"
                className="icon-button"
                onClick={reset}
              >
                <RotateCcw size={13} />
              </button>
            </div>
          </div>
          <div className="scene-container">
            <RaceView state={flight} replay={replay} look={profile.look} />
            {!running && !replay && (
              <div className="race-overlay">
                <span className="eyebrow">
                  {flight.finished
                    ? 'LAP COMPLETE'
                    : flight.crashed
                      ? 'EVERY FLIGHT IS AN EXPERIMENT'
                      : started
                        ? 'TAKE A BREATH'
                        : 'KITCHEN COUNTER CHAOS / 1 LAP'}
                </span>
                <h2>
                  {flight.finished
                    ? 'Kitchen conquered!'
                    : flight.crashed
                      ? 'Back to the drawing board.'
                      : started
                        ? 'Flight paused.'
                        : 'Tiny fly. Big kitchen.'}
                </h2>
                <p>
                  {flight.finished
                    ? `Finish reached in ${clock}. A delicious little victory.`
                    : flight.crashed
                      ? 'A missed gate or a hard landing. Try steady holds and balance both wings.'
                      : started
                        ? 'Your fly is waiting. Pick up where you left off.'
                        : 'Hold W + O to launch. Complete one lap and return to the same checkered finish. Hits briefly stun you on the counter. Recover and keep flying.'}
                </p>
                <button
                  className="primary-button"
                  disabled={!ready}
                  onClick={() => {
                    if (flight.crashed || flight.finished) reset();
                    start();
                  }}
                >
                  <Play size={16} />
                  {!ready
                    ? 'Connecting neurons…'
                    : flight.crashed || flight.finished
                      ? 'Try another flight'
                      : started
                        ? 'Resume flight'
                        : 'Prepare for takeoff'}
                </button>
                {!started && (
                  <button
                    className="quiet-button"
                    onClick={() => setHelp(true)}
                  >
                    <CircleHelp size={16} /> Learn the controls
                  </button>
                )}
              </div>
            )}
            {running && !flight.launched && !replay && (
              <output className="race-overlay takeoff-guide">
                <span className="eyebrow">SAFE LAUNCH · NO TIME LIMIT</span>
                <h2>Bring both wings online.</h2>
                <p>
                  Hold W and O. Keep holding to build power; takeoff begins when
                  both wing pairs respond.
                </p>
                <div
                  className="launch-keys"
                  aria-label="Takeoff muscle readiness"
                >
                  {[1, 4].map((i) => (
                    <span
                      key={i}
                      className={
                        CONTROLS[i].channels.every((c) => activations[c] >= 0.5)
                          ? 'ready'
                          : ''
                      }
                    >
                      {keys[i]}
                    </span>
                  ))}
                </div>
              </output>
            )}
            <div className="hud-note">
              {replay
                ? 'REPLAY · ⅓ SPEED'
                : flight.stunRemaining > 0
                  ? 'STUNNED · RECOVERING…'
                  : flight.boostRemaining > 0
                    ? 'FOOD BOOST · GO!'
                    : running
                      ? !flight.launched
                        ? 'HOLD W + O · NO RAPID TAPPING NEEDED'
                        : slow
                          ? 'TRAINING PACE · ½ SPEED · SPACE TO PAUSE'
                          : 'FULL SPEED · SPACE TO PAUSE'
                      : 'MATCH BOTH WINGS. THEN EXPERIMENT.'}
            </div>
          </div>
          <div className="race-status">
            <span>
              ALTITUDE{' '}
              <b>
                {flight.position.y.toFixed(1)} <small>m</small>
              </b>
            </span>
            <span>
              SPEED{' '}
              <b>
                {speed.toFixed(1)} <small>m/s</small>
              </b>
            </span>
            <span>
              LAP{' '}
              <b>
                {flight.lap} <small>/ 1</small>
              </b>
            </span>
            <span>
              TIME <b>{clock}</b>
            </span>
          </div>
        </div>
        <aside className="brain-panel">
          <div className="panel-top">
            <span>
              <Activity size={15} /> NEURAL ACTIVITY
            </span>
            <span>{replay ? 'REPLAY' : 'LIVE CIRCUIT'} / 3D</span>
          </div>
          <div className="brain-scene">
            {circuit ? (
              <BrainView
                circuit={circuit}
                spikes={spikes}
                activations={activations}
                replay={replay}
              />
            ) : (
              <div className="brain-loading">
                <Activity size={32} />
                <p>Connecting to the neuron circuit</p>
                <span>MaleCNS v1.0 · actual neuron skeletons</span>
              </div>
            )}
          </div>
          <div className="brain-stats">
            <span>
              <b>{circuit?.neurons?.length ?? '—'}</b> NEURONS
            </span>
            <span>
              <b>20</b> ACTIVE EDGES
            </span>
            <div className="signal-row" aria-label="Muscle activity">
              {activations.map((a, i) => (
                <i
                  key={i}
                  style={{
                    height: 2 + a * 20,
                    background: i < 3 ? '#d2f970' : '#a99bff',
                  }}
                />
              ))}
            </div>
          </div>
          <div className="brain-toolbar">
            <label htmlFor="slow-flight">
              <Switch
                id="slow-flight"
                aria-label="Training pace at half speed"
                checked={slow}
                onCheckedChange={(v) => {
                  setSlow(v);
                  slowRef.current = v;
                }}
              />
              Training pace · ½ speed
            </label>
            <button
              className="quiet-button"
              disabled={!started}
              onClick={startReplay}
            >
              <RotateCcw size={12} /> Replay recent flight
            </button>
          </div>
          <div className="brain-caption">
            STIMULUS → NEURON ACTIVITY → MUSCLE FORCE
          </div>
        </aside>
      </section>
      <section className="control-deck">
        <div className="deck-heading">
          <div>
            <span className="eyebrow">YOUR MOTOR INTERFACE</span>
            <h2>Find the balance.</h2>
          </div>
          <p>
            Steady holds build power. Release to ease off.
            <br />
            W + O fly · Q / P bank · E / I yaw · release to stabilize.
          </p>
        </div>
        <div className="key-grid">
          {keys.map((key, i) => (
            <button
              className={
                'muscle-key' +
                (pressed.includes(key.toLowerCase()) ? ' pressed' : '') +
                (guide && LESSONS[lesson].keys.includes(key)
                  ? ' lesson-focus'
                  : '')
              }
              key={key}
              aria-label={`${CONTROLS[i].side} ${CONTROLS[i].label} · ${key}`}
              aria-pressed={pressed.includes(key.toLowerCase())}
              title={CONTROLS[i].description}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                setKey(key.toLowerCase(), true);
              }}
              onPointerUp={() => setKey(key.toLowerCase(), false)}
              onPointerCancel={() => setKey(key.toLowerCase(), false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  setKey(key.toLowerCase(), true);
                }
              }}
              onKeyUp={(e) => {
                if (e.key === 'Enter') setKey(key.toLowerCase(), false);
              }}
            >
              <span className="key-top">
                <kbd>{key}</kbd>
                <span>
                  {CONTROLS[i].side === 'Left' ? 'L' : 'R'} / 0{(i % 3) + 1}
                </span>
              </span>
              <strong>{CONTROLS[i].label}</strong>
              <div className="activation-track">
                <i
                  style={{
                    width: `${Math.max(...CONTROLS[i].channels.map((c) => activations[c])) * 100}%`,
                    background: i < 3 ? '#d2f970' : '#a99bff',
                  }}
                />
              </div>
              <span
                className="fatigue"
                style={{
                  width: `${Math.max(...CONTROLS[i].channels.map((c) => flight.fatigue[c])) * 100}%`,
                }}
              />
            </button>
          ))}
        </div>
        <div className="deck-footer">
          <span>
            Q W E <b>LEFT WING</b>
            <span className="divider" /> I O P <b>RIGHT WING</b>
          </span>
          <span>COORDINATION OVER SPEED</span>
        </div>
      </section>
      <footer className="footer">
        <span>
          MaleCNS v1.0 · HHMI Janelia, Google Research & collaborators · CC-BY
          4.0.
        </span>
        <button
          className="source-button"
          onClick={() => {
            pause();
            setSources(true);
          }}
        >
          Data & model notes <ArrowUpRight size={13} />
        </button>
      </footer>
      <Dialog open={sources} onOpenChange={setSources}>
        <DialogContent className="help-dialog">
          <DialogTitle>Real anatomy. Experimental controls.</DialogTitle>
          <DialogDescription>
            This is a selected motor circuit spanning descending neurons and the
            ventral nerve cord, not the entire fruit fly brain.
          </DialogDescription>
          <p>
            <strong>Measured data:</strong> 30 original neuron skeletons, 141
            connections among those neurons, and ten paths to labeled bilateral
            wing motor neurons. Twenty measured edges on those paths drive the
            game.
          </p>
          <p>
            <strong>Our model:</strong> key stimulation, positive synaptic
            dynamics, firing thresholds, muscle action assignments, fatigue and
            flight physics. The full network and neurotransmitter signs are not
            modeled. Wing-pitch labels are game mappings, not established
            functions of these motor cells.
          </p>
          <p>
            <strong>Animation:</strong> activity comes from the same simulation
            as the controls. Traveling pulse speeds and paths are illustrative.
            Training pace slows biomechanics to half speed; neural activity
            stays real-time. Replay slows recorded flight and activity together.
          </p>
          <p>
            Source: MaleCNS v1.0 / FlyEM, HHMI Janelia Research Campus, Google
            Research and collaborators. Skeleton coordinates are centered and
            scaled together for display.
          </p>
          <div className="source-links">
            <a
              href="https://male-cns.janelia.org/download/"
              target="_blank"
              rel="noreferrer"
            >
              Official dataset ↗
            </a>
            <a
              href="https://creativecommons.org/licenses/by/4.0/"
              target="_blank"
              rel="noreferrer"
            >
              CC-BY 4.0 license ↗
            </a>
            <a href="/data/circuit.json" download>
              Download this circuit ↓
            </a>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent className="help-dialog">
          <DialogTitle>Flight school</DialogTitle>
          <DialogDescription>
            Five short lessons, from your first wingbeat to a complete race.
            Flight pauses while you read. You can pin a lesson beside your
            flight to practice.
          </DialogDescription>
          <FlightTutorial step={lesson} onStep={setLesson} />
          <button
            className="primary-button"
            onClick={() => {
              setGuide(true);
              setHelp(false);
            }}
          >
            Pin lesson & practice
          </button>
          <p>
            Full speed is the default. Turn on Training pace for optional
            half-speed practice. Space pauses; the circular-arrow button resets
            your flight.
          </p>
        </DialogContent>
      </Dialog>
    </main>
  );
}

export default function Home() {
  const [mode, setMode] = useState<'single' | 'multi' | null>(null);
  const [profile, setProfile] = useState(() => normalizeProfile(null));
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let live = true;
    queueMicrotask(() => {
      if (!live) return;
      try {
        setProfile(
          normalizeProfile(
            JSON.parse(localStorage.getItem('flycircuit-profile-v1') || 'null'),
          ),
        );
      } catch {}
      setLoaded(true);
    });
    return () => {
      live = false;
    };
  }, []);
  if (mode === 'multi')
    return <MultiplayerGame profile={profile} onBack={() => setMode(null)} />;
  if (mode === 'single')
    return (
      <>
        <button
          className="mode-back quiet-button"
          onClick={() => setMode(null)}
        >
          Edit profile / Modes
        </button>
        <SoloGame profile={profile} />
      </>
    );
  if (!loaded)
    return (
      <main className="flight-lab">
        <p>Preparing your fly…</p>
      </main>
    );
  return (
    <ProfileSetup
      initial={profile}
      onStart={(mode, profile) => {
        setProfile(profile);
        setMode(mode);
      }}
    />
  );
}
