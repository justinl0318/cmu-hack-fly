'use client';

import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { FlightState } from '@/lib/simulation';

export const LESSONS = [
  {
    title: 'Build a wingbeat',
    keys: ['Q', 'W', 'A', 'S'],
    action:
      'Click Prepare for takeoff, then hold Q + W and A + S together. Keep them held until you lift off.',
    why: 'Q/W power the left wing; A/S power the right. Both wings need power and recovery. The launch stays safe until all four muscle outputs respond.',
    cue: 'Watch the four launch indicators turn green, then watch altitude rise.',
  },
  {
    title: 'Find your altitude rhythm',
    keys: ['Q', 'W', 'A', 'S'],
    action:
      'Hold both power pairs to climb. Release both pairs briefly to descend, then hold again before you drop below the next gate.',
    why: 'Start with holds of roughly one second and make small adjustments. Lift takes a moment to build and fade. Holding forever climbs too high; long releases lose altitude.',
    cue: 'Keep altitude near the next gate, usually 5–7 m. Aim for small rises and falls.',
  },
  {
    title: 'Bank with wing extent',
    keys: ['T', 'G'],
    action:
      'While powering both wings, add T to bank toward screen-left or G toward screen-right. They extend opposite wings. Release early and watch your drift.',
    why: 'Use the opposite extent muscle to counter a bank. Holding both increases both wings’ lift. These directions refer to the chase-camera view; the controls act through wing forces, so balance still matters.',
    cue: 'Line up with the gate before reaching it. Return toward level as you approach its center.',
  },
  {
    title: 'Add speed with wing pitch',
    keys: ['E', 'D', 'R', 'F'],
    action:
      'Add E + D together to tilt both wings for more forward thrust. Release them to ease off. Add R + F together to slow down for a tight gate.',
    why: 'These are wing-pitch muscles, so keep managing Q/W/A/S for lift. Matching both sides avoids an unwanted turn. R/F reduce thrust; they do not stop the fly instantly.',
    cue: 'Use the speed meter. Accelerate on a straight, then reduce thrust before you need a correction.',
  },
  {
    title: 'Put it together',
    keys: ['Q', 'W', 'A', 'S', 'T', 'G'],
    action:
      'Launch, settle near 5 m, and clear the first two centered gates. Then add one extent muscle at a time to align with the offset gates.',
    why: 'Get altitude right first, line up next, then add speed if you have room. Space pauses immediately. Training pace is optional if you want more time to practice.',
    cue: 'Clear all eight gates in order. After a miss, replay your flight to see the muscle activity that caused it.',
  },
];

type Props = {
  step: number;
  onStep: (step: number) => void;
  flight?: FlightState;
  onClose?: () => void;
};

export default function FlightTutorial({
  step,
  onStep,
  flight,
  onClose,
}: Props) {
  const lesson = LESSONS[step];
  const live =
    flight &&
    (step === 0
      ? flight.launched
        ? 'Airborne — keep both wings working'
        : 'Waiting safely for the four lift channels'
      : step === 1
        ? `Altitude ${flight.position.y.toFixed(1)} m · ${flight.velocity.y > 0.1 ? 'rising' : flight.velocity.y < -0.1 ? 'descending' : 'level'}`
        : step === 2
          ? `Bank ${((Math.abs(flight.roll) * 180) / Math.PI).toFixed(0)}° · release early to limit drift`
          : step === 3
            ? `Forward speed ${Math.max(0, flight.velocity.z).toFixed(1)} m/s`
            : `${flight.checkpoint} of 8 gates cleared`);

  return (
    <section
      className={`flight-tutorial${flight ? ' live-guide' : ''}`}
      aria-label="Flight tutorial"
    >
      <div className="lesson-heading">
        <span className="eyebrow">
          FLIGHT SCHOOL / {step + 1} OF {LESSONS.length}
        </span>
        {onClose && (
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Hide tutorial"
          >
            <X size={15} />
          </button>
        )}
      </div>
      <h3>{lesson.title}</h3>
      <div className="lesson-keycaps" aria-label="Keys for this lesson">
        {lesson.keys.map((key) => (
          <kbd key={key}>{key}</kbd>
        ))}
      </div>
      <p>{lesson.action}</p>
      {!flight && <p className="lesson-explanation">{lesson.why}</p>}
      <p className="lesson-cue">{lesson.cue}</p>
      {live && <div className="lesson-live">{live}</div>}
      <div className="lesson-navigation">
        <button
          className="quiet-button"
          disabled={step === 0}
          onClick={() => onStep(step - 1)}
        >
          <ChevronLeft size={15} /> Previous
        </button>
        <span aria-label={`Lesson ${step + 1} of ${LESSONS.length}`}>
          {LESSONS.map((_, i) => (
            <i key={i} className={i === step ? 'current' : ''} />
          ))}
        </span>
        <button
          className="quiet-button"
          disabled={step === LESSONS.length - 1}
          onClick={() => onStep(step + 1)}
        >
          Next lesson <ChevronRight size={15} />
        </button>
      </div>
    </section>
  );
}
