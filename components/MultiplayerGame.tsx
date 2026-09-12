'use client';
import { useEffect, useRef, useState } from 'react';
import RaceView from './RaceView';
import BrainView, { type Circuit } from './BrainView';
import { CONTROLS } from '@/lib/controls';
import { createFlightState } from '@/lib/simulation';
import type { RaceSnapshot } from '@/lib/battle';
import type { PlayerProfile } from '@/lib/profile';
import SocialCards from './SocialCards';
import type { PeerRoom } from '@/lib/peer-room';

export default function MultiplayerGame({
  onBack,
  profile,
}: {
  onBack: () => void;
  profile: PlayerProfile;
}) {
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('Create a room or enter a room code.');
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [session, setSession] = useState({ id: '', code: '', host: false });
  const [race, setRace] = useState<RaceSnapshot | null>(null);
  const [circuit, setCircuit] = useState<Circuit | null>(null);
  const [pressed, setPressed] = useState<string[]>([]);
  const room = useRef<PeerRoom | null>(null);
  const held = useRef(new Set<string>());
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    fetch('/data/circuit.json')
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json() as Promise<Circuit>;
      })
      .then(setCircuit)
      .catch(() => setMessage('Circuit failed to load. Reload this page.'));
    return () => {
      alive.current = false;
      room.current?.close();
    };
  }, []);
  const changeKey = (key: string, down: boolean) => {
    if (down) held.current.add(key);
    else held.current.delete(key);
    setPressed([...held.current]);
    room.current?.input([...held.current]);
  };
  useEffect(() => {
    const key = (e: KeyboardEvent, down: boolean) => {
      if ((e.target as HTMLElement).closest('input,textarea')) return;
      const k = e.key.toLowerCase();
      if (!['q', 'w', 'e', 'i', 'o', 'p', 'f'].includes(k)) return;
      e.preventDefault();
      if (!e.repeat) changeKey(k, down);
    };
    const down = (e: KeyboardEvent) => key(e, true),
      up = (e: KeyboardEvent) => key(e, false);
    const clear = () => {
      held.current.clear();
      setPressed([]);
      room.current?.input([]);
    };
    const visibility = () => {
      if (document.hidden) clear();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clear);
    document.addEventListener('visibilitychange', visibility);
    const interval = setInterval(
      () => room.current?.input([...held.current]),
      100,
    );
    return () => {
      clearInterval(interval);
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);
  async function connect(host: boolean) {
    if (!circuit || connecting) return;
    setConnecting(true);
    setConnected(false);
    setMessage('Connecting to room…');
    room.current?.close();
    setRace(null);
    try {
      const { PeerRoom } = await import('@/lib/peer-room');
      if (!alive.current) return;
      room.current = new PeerRoom(
        host,
        code,
        profile,
        circuit,
        (s) => {
          if (alive.current) setRace(s);
        },
        (m, ok) => {
          if (!alive.current) return;
          setMessage(m);
          setConnecting(false);
          setConnected(!!ok);
          if (ok && room.current)
            setSession({
              id: room.current.id,
              code: room.current.code,
              host: room.current.host,
            });
        },
      );
    } catch {
      setConnecting(false);
      setMessage(
        'Could not initialize WebRTC. Try a current Chrome or Edge browser.',
      );
    }
  }
  const me = race?.players.find((p) => p.id === session.id);
  const state = me?.state ?? createFlightState();
  const inRace = !!race && race.phase !== 'lobby';
  const ranking = [...(race?.players ?? [])].sort(
    (a, b) =>
      (a.finishTime ?? Infinity) - (b.finishTime ?? Infinity) ||
      b.state.distance - a.state.distance,
  );
  return (
    <main className="flight-lab">
      <header className="topbar">
        <strong>FLYCIRCUIT / MULTIPLAYER</strong>
        <button
          className="quiet-button"
          onClick={() => {
            room.current?.close();
            onBack();
          }}
        >
          Leave room / Back
        </button>
      </header>
      <section className="title-row">
        <div>
          <div className="eyebrow">KITCHEN COUNTER CHAOS</div>
          <h1>
            One lap. <span>One buzzing rivalry.</span>
          </h1>
        </div>
      </section>
      <output className="room-message">
        {message}
        {connected && session.host
          ? ' · You are the host. Keep this window visible.'
          : ''}
      </output>
      {!connected && (
        <section className="room-card">
          <p>
            Flying as <strong>{profile.name}</strong> · use Back to edit your
            profile and outfit.
          </p>
          <button
            className="primary-button"
            disabled={!circuit || connecting}
            onClick={() => connect(true)}
          >
            Create room
          </button>
          <label>
            Room code
            <input
              maxLength={8}
              value={code}
              onChange={(e) =>
                setCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ''))
              }
              placeholder="8-character code"
            />
          </label>
          <button
            className="primary-button"
            disabled={!circuit || connecting || code.length !== 8}
            onClick={() => connect(false)}
          >
            Join room
          </button>
          <p>No separate game server. Room matching needs Internet access.</p>
        </section>
      )}
      {race?.phase === 'results' && race.results && circuit && (
        <SocialCards
          racers={race.results}
          circuit={circuit}
          raceClock={race.clock}
          myId={session.id}
        />
      )}
      {connected && race && (
        <>
          <section className="room-card">
            <div>
              <span className="eyebrow">ROOM CODE</span>
              <strong className="room-code">{session.code}</strong>
            </div>
            <button
              className="quiet-button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(room.current!.code);
                  setMessage('Room code copied.');
                } catch {
                  setMessage('Select the room code and copy it manually.');
                }
              }}
            >
              Copy code
            </button>
            <span>{race.players.length} / 8 flies</span>
            {session.host &&
              (race.phase === 'lobby' || race.phase === 'results') && (
                <button
                  className="primary-button"
                  disabled={race.players.length < 2}
                  onClick={() => room.current?.start()}
                >
                  {race.phase === 'results' ? 'Race again' : 'Start race'}
                </button>
              )}
            {race.phase === 'lobby' && (
              <p>
                {session.host
                  ? 'Invite at least one friend, then start.'
                  : 'Waiting for the host to start.'}
              </p>
            )}
          </section>
          {race.phase !== 'results' && (
            <section className="workspace">
              <div className="race-panel">
                <div className="panel-top">
                  <span>1 LAP / F TO ATTACK</span>
                  <span>{race.clock.toFixed(1)} s</span>
                </div>
                <div className="scene-container">
                  <RaceView
                    state={state}
                    look={me?.profile.look ?? profile.look}
                    opponents={race.players.filter((p) => p.id !== me?.id)}
                    attackFlash={me?.attackFlash ?? 0}
                  />
                  {(!inRace ||
                    race.phase === 'countdown' ||
                    state.finished) && (
                    <div className="race-overlay">
                      <h2>
                        {race.phase === 'countdown'
                          ? Math.ceil(race.countdown)
                          : state.finished
                            ? 'Finished!'
                            : 'Ready to race?'}
                      </h2>
                      <p>
                        {state.finished
                          ? `Your time: ${me?.finishTime?.toFixed(2)} s. Watch the standings.`
                          : 'W + O to fly · E / I to turn · F to stun rivals'}
                      </p>
                    </div>
                  )}
                  <div className="hud-note">
                    {state.stunRemaining > 0
                      ? 'STUNNED · RECOVERING'
                      : state.recoveryRemaining > 0
                        ? 'RECOVERY SHIELD'
                        : state.boostRemaining > 0
                          ? 'FOOD BOOST'
                          : !state.launched
                            ? 'HOLD W + O TO LAUNCH'
                            : (me?.cooldown ?? 0) > 0
                              ? `ATTACK RECHARGING · ${me?.cooldown.toFixed(1)}s`
                              : 'F · BUZZ ATTACK READY'}
                  </div>
                </div>
                <div className="race-status">
                  <span>
                    LAP <b>{state.lap} / 1</b>
                  </span>
                  <span>
                    SPEED{' '}
                    <b>
                      {Math.hypot(state.velocity.x, state.velocity.z).toFixed(
                        1,
                      )}
                    </b>
                  </span>
                  <span>
                    HITS <b>{me?.hits ?? 0}</b>
                  </span>
                </div>
              </div>
              <aside className="brain-panel">
                <div className="panel-top">YOUR LIVE NEURAL ACTIVITY</div>
                <div className="brain-scene">
                  {circuit && (
                    <BrainView
                      circuit={circuit}
                      activations={me?.activations ?? Array(10).fill(0)}
                      spikes={me?.spikes ?? []}
                    />
                  )}
                </div>
                <div className="brain-caption">
                  YOUR KEYS → NEURONS → WING FORCE
                </div>
              </aside>
            </section>
          )}
          <section className="room-card standings">
            <strong>Standings</strong>
            {ranking.map((p, i) => (
              <div key={p.id}>
                {i + 1}. {p.name}
                {p.id === me?.id ? ' (you)' : ''} ·{' '}
                {p.finishTime !== null
                  ? `${p.finishTime.toFixed(2)} s`
                  : `Lap ${p.state.lap} / 1`}{' '}
                · {p.hits} hits
              </div>
            ))}
          </section>
          {race.phase !== 'results' && (
            <section className="control-deck">
              <div className="deck-heading">
                <h2>Wing control + buzz attack</h2>
                <p>
                  W + O fly · Q / P bank · E / I yaw
                  <br />F attacks ahead, every 1.5 seconds. No pickups required.
                </p>
              </div>
              <div className="key-grid">
                {[
                  ...CONTROLS,
                  {
                    key: 'f',
                    label: 'Buzz attack',
                    side: 'Both',
                    description:
                      'Stun nearby opponents ahead. Recovery grants two seconds of immunity.',
                  },
                ].map((c) => (
                  <button
                    key={c.key}
                    className={
                      'muscle-key' + (pressed.includes(c.key) ? ' pressed' : '')
                    }
                    title={c.description}
                    aria-pressed={pressed.includes(c.key)}
                    onPointerDown={(e) => {
                      e.currentTarget.setPointerCapture(e.pointerId);
                      changeKey(c.key, true);
                    }}
                    onPointerUp={() => changeKey(c.key, false)}
                    onPointerCancel={() => changeKey(c.key, false)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') changeKey(c.key, true);
                    }}
                    onKeyUp={(e) => {
                      if (e.key === 'Enter') changeKey(c.key, false);
                    }}
                  >
                    <kbd>{c.key.toUpperCase()}</kbd>
                    <strong>{c.label}</strong>
                  </button>
                ))}
              </div>
              <p>
                Hits briefly knock you to the counter. A recovery shield
                prevents stun chains. Food boosts reset for a new race.
              </p>
            </section>
          )}
        </>
      )}
    </main>
  );
}
