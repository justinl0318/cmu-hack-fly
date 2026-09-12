/** Six physical keys stimulate the existing ten biological pathway inputs. */
export const CONTROLS = [
  {
    key: 'q',
    label: 'Bank left',
    side: 'Left',
    channels: [4],
    inputs: ['t'],
    description:
      'Extend the left wing stroke to bank left. Release to level out.',
  },
  {
    key: 'w',
    label: 'Left wingbeat',
    side: 'Left',
    channels: [0, 1],
    inputs: ['q', 'w'],
    description:
      'Power and recover the left wing together. Hold W + O for balanced flight.',
  },
  {
    key: 'e',
    label: 'Yaw left',
    side: 'Left',
    channels: [2],
    inputs: ['e'],
    description:
      'Pitch the left wing to rotate your heading left. Counter with I.',
  },
  {
    key: 'i',
    label: 'Yaw right',
    side: 'Right',
    channels: [7],
    inputs: ['d'],
    description:
      'Pitch the right wing to rotate your heading right. Counter with E.',
  },
  {
    key: 'o',
    label: 'Right wingbeat',
    side: 'Right',
    channels: [5, 6],
    inputs: ['a', 's'],
    description:
      'Power and recover the right wing together. Release both wingbeats to descend.',
  },
  {
    key: 'p',
    label: 'Bank right',
    side: 'Right',
    channels: [9],
    inputs: ['g'],
    description:
      'Extend the right wing stroke to bank right. Release to level out.',
  },
];
export function muscleInputs(keys: string[]) {
  return [
    ...new Set(
      CONTROLS.filter((c) => keys.includes(c.key)).flatMap((c) => c.inputs),
    ),
  ];
}
