'use client';

import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { FINISH_Z } from '@/lib/kitchen';
import type { FlightState } from '@/lib/simulation';

export const LESSONS = [
  {
    title: 'Two hands, two wings',
    keys: ['W', 'O'],
    action:
      'Hold W for the left wing and O for the right. Hold both to launch.',
    why: 'Each wingbeat key stimulates the power and recovery pathways together. Flight still comes from motor activity, not direct position controls.',
    cue: 'Wait for both wing indicators, then hold W + O to build lift.',
  },
  {
    title: 'Find a comfortable altitude',
    keys: ['W', 'O'],
    action:
      'Hold both wings to climb gently. Release both briefly to descend toward food.',
    why: 'Vertical drag and gentle high-altitude lift reduction make corrections forgiving. There is no automatic route following.',
    cue: 'Try short releases and stay around 3–7 m for the food trail.',
  },
  {
    title: 'Bank into the bend',
    keys: ['Q', 'P'],
    action: 'While holding W + O, add Q to bank left or P to bank right.',
    why: 'Stroke extent changes the balance of wing forces. Release the bank key and the fly levels out; opposite input corrects drift.',
    cue: 'Bank shifts you sideways. Small holds are enough.',
  },
  {
    title: 'Rotate your heading',
    keys: ['E', 'I'],
    action:
      'Add E to yaw left or I to yaw right. Use the opposite key to straighten your heading.',
    why: 'Unequal wing pitch rotates the body without requiring a large bank. Releasing the key stops the rotation, but preserves the heading you chose.',
    cue: 'Yaw aims the nose into a bend; banking adjusts your position within it.',
  },
  {
    title: 'Snack and sprint',
    keys: ['Q', 'W', 'E', 'I', 'O', 'P'],
    action:
      'Follow the winding mint lane, collect floating fruit and cross the checkered finish.',
    why: 'Fruit disappears when eaten and gives a short boost. Hits knock you down briefly; recovery protection lets you get moving again.',
    cue: 'Choose an inside or outside line. Space pauses; Training pace slows the flight.',
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
        : 'Waiting for both wingbeat keys'
      : step === 1
        ? `Altitude ${flight.position.y.toFixed(1)} m · ${flight.velocity.y > 0.1 ? 'rising' : flight.velocity.y < -0.1 ? 'descending' : 'level'}`
        : step === 2
          ? `Bank ${((Math.abs(flight.roll) * 180) / Math.PI).toFixed(0)}° · release early to limit drift`
          : step === 3
            ? `Heading ${((flight.yaw * 180) / Math.PI).toFixed(0)}° · opposite yaw corrects it`
            : `${Math.min(100, Math.floor((flight.distance / FINISH_Z) * 100))}% to the kitchen finish`);

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
