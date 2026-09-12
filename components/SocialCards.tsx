'use client';
import { useEffect, useRef, useState } from 'react';
import { type Racer, neuralStyle } from '@/lib/battle';
import { raceTime, safeProfileUrl } from '@/lib/profile';
import { flyPortrait } from '@/lib/fly-model';
import {
  CARD_WIDTH,
  CARD_HEIGHT,
  drawSocialCard,
  replayFrame,
  exportSocialCard,
} from '@/lib/social-card';
import type { Circuit } from './BrainView';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';

function SocialCard({
  racer,
  circuit,
  raceClock,
  isMe,
}: {
  racer: Racer;
  circuit: Circuit;
  raceClock: number;
  isMe: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    portrait = useRef<HTMLImageElement | null>(null);
  const [details, setDetails] = useState(false),
    [busy, setBusy] = useState(''),
    [error, setError] = useState('');
  const [animated, setAnimated] = useState(true),
    [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true,
      index = 0,
      timer: ReturnType<typeof setInterval> | undefined;
    const draw = () => {
      if (!live) return;
      const ctx = canvas.current?.getContext('2d');
      if (ctx)
        drawSocialCard(
          ctx,
          racer,
          circuit,
          portrait.current,
          replayFrame(racer, index++),
          raceClock,
        );
    };
    try {
      const img = new Image();
      img.onload = () => {
        if (!live) return;
        portrait.current = img;
        draw();
        setReady(true);
      };
      img.onerror = () => {
        if (live) {
          setError('Avatar could not load. Try reloading before exporting.');
        }
      };
      img.src = flyPortrait(racer.profile.look);
    } catch {
      queueMicrotask(() => {
        if (live)
          setError('3D avatar unavailable. Export is disabled on this device.');
      });
    }
    draw();
    if (animated) timer = setInterval(draw, 100);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [racer, circuit, raceClock, animated]);
  async function download(format: 'png' | 'gif') {
    setBusy(`Preparing ${format.toUpperCase()}…`);
    setError('');
    try {
      const blob = await exportSocialCard(
        racer,
        circuit,
        portrait.current,
        raceClock,
        format,
        (n) => setBusy(`Encoding GIF · ${n}%`),
      );
      const url = URL.createObjectURL(blob),
        a = document.createElement('a');
      a.href = url;
      a.download = `flycircuit-${racer.name.replace(/[^a-z0-9_-]/gi, '_')}-card.${format}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      setError('Export failed. Please retry, or use PNG on a slower device.');
    } finally {
      setBusy('');
    }
  }
  const connect = safeProfileUrl(racer.profile.connectUrl),
    profile = safeProfileUrl(racer.profile.profileUrl);
  return (
    <article className="social-card">
      <div className="social-card-heading">
        <h3>
          {racer.name}
          {isMe ? ' · You' : ''}
        </h3>
        <span>{racer.finishTime !== null ? 'FINISHER' : 'RACED TOGETHER'}</span>
      </div>
      <canvas
        ref={canvas}
        width={CARD_WIDTH}
        height={CARD_HEIGHT}
        aria-label={`${racer.name}. ${racer.profile.school}. ${racer.profile.interests}. Race ${racer.finishTime === null ? 'DNF' : raceTime(racer.finishTime)}. Top speed ${racer.topSpeed.toFixed(1)} meters per second. ${neuralStyle(racer)}.`}
      />
      <div className="social-card-actions">
        {connect ? (
          <a
            className="primary-button"
            href={connect}
            target="_blank"
            rel="noopener noreferrer"
          >
            Connect ↗
          </a>
        ) : (
          <button
            className="primary-button"
            disabled
            title="This player did not add a connect link"
          >
            No connect link
          </button>
        )}
        <button className="quiet-button" onClick={() => setDetails(true)}>
          View Profile
        </button>
        <button
          className="quiet-button"
          disabled={!ready || !!busy}
          onClick={() => download('png')}
        >
          Save PNG
        </button>
        <button
          className="quiet-button"
          disabled={!ready || !!busy || !racer.neuralReplay.length}
          onClick={() => download('gif')}
        >
          Save GIF
        </button>
        <button className="quiet-button" onClick={() => setAnimated((v) => !v)}>
          {animated ? 'Pause signal' : 'Play signal'}
        </button>
      </div>
      <output>{busy || error}</output>
      <Dialog open={details} onOpenChange={setDetails}>
        <DialogContent className="help-dialog">
          <DialogTitle>{racer.name}</DialogTitle>
          <DialogDescription>
            {racer.profile.school || 'A fellow fly in your race.'}
          </DialogDescription>
          <p>{racer.profile.interests}</p>
          <p>{racer.profile.bio || 'This player has not added a bio yet.'}</p>
          <p>
            Top speed {racer.topSpeed.toFixed(1)} m/s · {neuralStyle(racer)}
          </p>
          <p className="profile-note">
            Neural Style summarizes movement during this game. It is not a
            biological or personality assessment.
          </p>
          <div className="social-card-actions">
            {connect && (
              <a href={connect} target="_blank" rel="noopener noreferrer">
                Connect ↗
              </a>
            )}
            {profile && (
              <a href={profile} target="_blank" rel="noopener noreferrer">
                Open profile website ↗
              </a>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </article>
  );
}
export default function SocialCards({
  racers,
  circuit,
  raceClock,
  myId,
}: {
  racers: Racer[];
  circuit: Circuit;
  raceClock: number;
  myId: string;
}) {
  const ranked = [...racers].sort(
    (a, b) =>
      (a.finishTime ?? Infinity) - (b.finishTime ?? Infinity) ||
      b.state.distance - a.state.distance,
  );
  const finishers = ranked.filter((p) => p.finishTime !== null);
  return (
    <section
      className="social-results"
      aria-label="Race results and social cards"
    >
      <div className="eyebrow">THE RACE ENDS. THE CONVERSATION STARTS.</div>
      <h2>
        {finishers.map((p) => p.name).join(' & ') || 'Your crew'}{' '}
        {finishers.length > 1 ? 'tie for the win!' : 'takes the win!'}
      </h2>
      <p>
        One lap, shared memories. Meet your fellow pilots and keep their cards.
        <br />
        DNF means the race ended before that pilot reached the finish.
      </p>
      <div className="social-cards-grid">
        {ranked.map((p) => (
          <SocialCard
            key={p.id}
            racer={p}
            circuit={circuit}
            raceClock={raceClock}
            isMe={p.id === myId}
          />
        ))}
      </div>
      <p className="profile-note">
        Animated cards replay up to the last 3 seconds of recorded simulated
        activity on a 2D projection of the MaleCNS neuron skeletons. PNG saves a
        recorded frame; GIF keeps the motion. Connect opens the link that player
        supplied.
      </p>
    </section>
  );
}
