'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  Bug,
  CircleHelp,
  Pause,
  Play,
  RotateCcw,
} from 'lucide-react';
import BrainView, { type Circuit } from '@/components/BrainView';
import Link from 'next/link';
import RaceView from '@/components/RaceView';
import FlightTutorial, { LESSONS } from '@/components/FlightTutorial';
import {
  CHANNELS,
  createFlightState,
  RACE_SECTOR_COUNT,
  stepFlight,
  type FlightState,
} from '@/lib/simulation';
import { getCourseTarget, type RaceCourse } from '@/lib/openRacerCourse';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

const keys = ['Q', 'W', 'E', 'R', 'T', 'A', 'S', 'D', 'F', 'G'];
const labels = [
  'Downstroke',
  'Upstroke',
  'Pronation',
  'Supination',
  'Stroke extent',
];
export default function Home() {
  const [help, setHelp] = useState(false);
  const [lesson, setLesson] = useState(0);
  const [guide, setGuide] = useState(false);
  const [sources, setSources] = useState(false);
  const [circuit, setCircuit] = useState<Circuit | null>(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [courseReady, setCourseReady] = useState(false);
  const [running, setRunning] = useState(false);
  const [started, setStarted] = useState(false);
  const [slow, setSlow] = useState(false);
  const [autopilot, setAutopilot] = useState(false);
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
  const autopilotRef = useRef(false);
  const autopilotKeys = useRef('');
  const autopilotSteering = useRef(0);
  const activationRef = useRef<number[]>(Array(10).fill(0));
  const courseRef = useRef<RaceCourse | null>(null);
  const held = useRef(new Set<string>());
  const history = useRef<
    { flight: FlightState; activations: number[]; spikes: string[] }[]
  >([]);
  const replayIndex = useRef(0);
  const lastSpikes = useRef<string[]>([]);
  const clearKeys = useCallback(() => {
    held.current.clear();
    setPressed([]);
    worker.current?.postMessage({ type: 'input', pressed: [] });
  }, []);
  const onCourseReady = useCallback((nextCourse: RaceCourse) => {
    courseRef.current = nextCourse;
    setCourseReady(true);
  }, []);
  const setKey = useCallback((key: string, down: boolean) => {
    if (!runRef.current || replayRef.current || autopilotRef.current) return;
    if (down) held.current.add(key);
    else held.current.delete(key);
    setPressed([...held.current]);
    worker.current?.postMessage({ type: 'input', pressed: [...held.current] });
  }, []);
  const pause = useCallback(() => {
    runRef.current = false;
    setRunning(false);
    clearKeys();
    worker.current?.postMessage({ type: 'pause', paused: true });
  }, [clearKeys]);
  const start = useCallback(() => {
    if (!ready || !courseRef.current) return;
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
    activationRef.current = Array(10).fill(0);
    setActivations([...activationRef.current]);
    setSpikes([]);
    worker.current?.postMessage({ type: 'reset' });
  }, [pause]);
  const startReplay = () => {
    pause();
    if (!history.current.length) return;
    replayIndex.current = 0;
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
      accumulator = 0,
      replayClock = 0;
    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (replayRef.current) {
        replayClock += dt;
        if (replayClock >= 0.12) {
          replayClock = 0;
          const frame = history.current[replayIndex.current++];
          if (frame) {
            setFlight(frame.flight);
            setActivations(frame.activations);
            setSpikes(frame.spikes);
          } else {
            replayRef.current = false;
            setReplay(false);
            setFlight(structuredClone(flightRef.current));
          }
        }
      } else if (runRef.current) {
        if (autopilotRef.current) {
          const course = courseRef.current;
          const keys: string[] = [];
          const s = flightRef.current;
          const horizontalSpeed = Math.hypot(s.velocity.x, s.velocity.z);
          const target = course
            ? getCourseTarget(
                course,
                s.position.x,
                s.position.z,
                s.checkpoint,
                // At demo speed the fly needs to see much farther than the
                // next mesh segment. This gives it time to bank into the
                // OpenRacer hairpins instead of discovering them at a wall.
                Math.min(15, Math.max(4.5, 4.2 + horizontalSpeed * .8)),
              )
            : null;
          if (target) {
            // Demo flight is deliberately low: it should read the asphalt,
            // guide arrows and scenery instead of disappearing into the sky.
            const targetAltitude = 1.5;
            const projectedAltitude =
              s.position.y - (s.groundHeight ?? 0) + s.velocity.y * .48;
            const needsLift =
              !s.launched ||
              projectedAltitude < targetAltitude - .13 ||
              (projectedAltitude < targetAltitude + .04 && s.velocity.y < -.22);
            if (needsLift) keys.push('q', 'w', 'a', 's');

            const targetX = target.x - s.position.x;
            const targetZ = target.z - s.position.z;
            const targetYaw = Math.atan2(targetX, targetZ);
            const yawError = Math.atan2(
              Math.sin(targetYaw - s.yaw),
              Math.cos(targetYaw - s.yaw),
            );

            // Pronation/supination rotates the whole heading toward the
            // look-ahead point; extent adds a visibly physical bank. Smaller
            // thresholds make the demo commit to a turn before its lane ends.
            const yawCommand = yawError - s.angularVelocity.y * .34;
            if (yawCommand > .025) keys.push('e', 'f');
            if (yawCommand < -.025) keys.push('r', 'd');
            const cornering = Math.min(1, Math.abs(yawError) / .7);
            const targetSpeed = 14.5 - cornering * 6.5;
            if (needsLift && horizontalSpeed < targetSpeed && Math.abs(yawError) < .32)
              keys.push('e', 'd');
            const desiredRoll = Math.max(
              -0.62,
              Math.min(
                0.62,
                yawError * .58 + targetX * .055 - s.velocity.x * .12,
              ),
            );
            autopilotSteering.current +=
              (desiredRoll - autopilotSteering.current) * Math.min(1, dt * 7);
            if (autopilotSteering.current > s.roll + s.angularVelocity.z * 0.38 + 0.015)
              keys.push('t');
            if (autopilotSteering.current < s.roll + s.angularVelocity.z * 0.38 - 0.015)
              keys.push('g');
          }
          const nextKeys = keys.join('');
          if (nextKeys !== autopilotKeys.current) {
            autopilotKeys.current = nextKeys;
            worker.current?.postMessage({ type: 'input', pressed: keys });
          }
        }
        stepFlight(
          flightRef.current,
          activationRef.current,
          dt * (slowRef.current ? 0.5 : 1),
          courseRef.current ?? undefined,
        );
        accumulator += dt;
        if (accumulator >= 0.04) {
          accumulator = 0;
          const snapshot = structuredClone(flightRef.current);
          setFlight(snapshot);
          history.current.push({
            flight: snapshot,
            activations: [...activationRef.current],
            spikes: [...lastSpikes.current],
          });
          if (history.current.length > 300) history.current.shift();
        }
        if (flightRef.current.crashed || flightRef.current.finished) {
          setFlight(structuredClone(flightRef.current));
          runRef.current = false;
          setRunning(false);
          held.current.clear();
          setPressed([]);
          worker.current?.postMessage({ type: 'input', pressed: [] });
          worker.current?.postMessage({ type: 'pause', paused: true });
          if (autopilotRef.current) {
            autopilotRef.current = false;
            autopilotKeys.current = '';
            autopilotSteering.current = 0;
            setAutopilot(false);
          }
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
      if (CHANNELS.some((c) => c.key === key)) {
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
  const altitude = Math.max(0, flight.position.y - (flight.groundHeight ?? 0));
  const clock =
    String(Math.floor(flight.elapsed / 60)).padStart(2, '0') +
    ':' +
    (flight.elapsed % 60).toFixed(1).padStart(4, '0');
  return (
    <main className="flight-lab">
      <header className="topbar">
        <Link className="wordmark" href="/">
          <Bug size={25} />
          <span>
            FLY<span className="muted">CIRCUIT</span>
            <sup>01</sup>
          </span>
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
          <div className="eyebrow">A SMALL BRAIN. A DIFFICULT FLIGHT.</div>
          <h1>
            Learn to fly. <span>One muscle at a time.</span>
          </h1>
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
      <section className="workspace">
        <div className="race-panel">
          <div className="panel-top">
            <span>
              <span className="live-dot" /> FLIGHT CHAMBER
            </span>
            <div className="race-actions">
              <span>OPENRACER · CIRCUIT 01</span>
              <button
                aria-label={running ? 'Pause flight' : 'Resume flight'}
                title="Pause / resume · Space"
                className="icon-button"
                disabled={!ready || !courseReady || flight.crashed || flight.finished}
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
            <RaceView state={flight} onCourseReady={onCourseReady} />
            {!running && !replay && (
              <div className="race-overlay">
                <span className="eyebrow">
                  {flight.finished
                    ? 'FINISH LINE CROSSED'
                    : flight.crashed
                      ? 'EVERY FLIGHT IS AN EXPERIMENT'
                      : started
                        ? 'TAKE A BREATH'
                        : 'OPENRACER / ONE LAP'}
                </span>
                <h2>
                  {flight.finished
                    ? 'Flight, mastered.'
                    : flight.crashed
                      ? 'Back to the drawing board.'
                      : started
                        ? 'Flight paused.'
                        : !courseReady
                          ? 'Loading the circuit.'
                          : 'You are the nervous system.'}
                </h2>
                <p>
                  {flight.finished
                    ? `One full circuit. ${clock}. Your wings found their rhythm.`
                    : flight.crashed
                      ? 'Reset the flight and return to the start line.'
                      : courseReady
                        ? 'Follow the coloured centre arrows around one full lap. The glowing rails are your flight boundary; landing is recoverable.'
                        : started
                        ? 'Your fly is waiting. Pick up where you left off.'
                        : 'Take your time preparing both wings. Hold Q + W + A + S to lift off when you’re ready.'}
                </p>
                <button
                  className="primary-button"
                  disabled={!ready || !courseReady}
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
                  Hold Q + W and A + S. Keep holding to build power; takeoff
                  begins when all four muscles respond.
                </p>
                <div
                  className="launch-keys"
                  aria-label="Takeoff muscle readiness"
                >
                  {[0, 1, 5, 6].map((i) => (
                    <span
                      key={i}
                      className={activations[i] >= 0.5 ? 'ready' : ''}
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
                : running
                  ? !flight.launched
                    ? 'HOLD Q + W + A + S · NO RAPID TAPPING NEEDED'
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
                {altitude.toFixed(1)} <small>m</small>
              </b>
            </span>
            <span>
              SPEED{' '}
              <b>
                {speed.toFixed(1)} <small>m/s</small>
              </b>
            </span>
            <span>
              SECTORS{' '}
              <b>
                {String(Math.min(flight.checkpoint + 1, RACE_SECTOR_COUNT)).padStart(2, '0')} <small>/ {String(RACE_SECTOR_COUNT).padStart(2, '0')}</small>
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
                    background: i < 5 ? '#d2f970' : '#a99bff',
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
            <label htmlFor="demo-autopilot">
              <Switch
                id="demo-autopilot"
                aria-label="Demo autopilot"
                checked={autopilot}
                onCheckedChange={(v) => {
                  autopilotRef.current = v;
                  autopilotKeys.current = '';
                  autopilotSteering.current = 0;
                  setAutopilot(v);
                  clearKeys();
                  if (v) {
                    if (flightRef.current.crashed || flightRef.current.finished)
                      reset();
                    start();
                  } else {
                    worker.current?.postMessage({ type: 'input', pressed: [] });
                  }
                }}
              />
              Demo autopilot
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
            Wing-pitch commands compete; sustained effort fatigues.
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
              aria-label={`${i < 5 ? 'Left' : 'Right'} ${labels[i % 5]} · ${key}`}
              aria-pressed={pressed.includes(key.toLowerCase())}
              title={CHANNELS[i].description}
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
                  {i < 5 ? 'L' : 'R'} / 0{(i % 5) + 1}
                </span>
              </span>
              <strong>{labels[i % 5]}</strong>
              <div className="activation-track">
                <i
                  style={{
                    width: `${activations[i] * 100}%`,
                    background: i < 5 ? '#d2f970' : '#a99bff',
                  }}
                />
              </div>
              <span
                className="fatigue"
                style={{ width: `${flight.fatigue[i] * 100}%` }}
              />
            </button>
          ))}
        </div>
        <div className="deck-footer">
          <span>
            Q W E R T <b>LEFT WING</b>
            <span className="divider" /> A S D F G <b>RIGHT WING</b>
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
          <p>
            <strong>Race circuit:</strong> OpenRacer circuit mesh and textures,
            Copyright © 2015 Chris Barnard. This project distributes that
            adapted scene under GPLv3; see the bundled license and notices.
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
