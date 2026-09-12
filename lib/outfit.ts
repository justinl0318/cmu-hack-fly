// @ts-expect-error Native Node tests use explicit extensions.
import { FLY_COLORS, type FlyLook, type PlayerProfile } from './profile.ts';

const HATS: FlyLook['hat'][] = ['none', 'cap', 'crown', 'wizard'];
const SHOES: FlyLook['shoes'][] = ['none', 'sneakers', 'boots'];

export function randomOutfit(
  current: FlyLook,
  random: () => number = Math.random,
): FlyLook {
  const colors = FLY_COLORS.filter((color) => color !== current.color);
  const color = colors[Math.floor(random() * colors.length)];
  const choices: Pick<FlyLook, 'hat' | 'shoes'>[] = [];
  for (const hat of HATS)
    for (const shoes of SHOES)
      if (
        (hat !== 'none' || shoes !== 'none') &&
        (hat !== current.hat || shoes !== current.shoes)
      )
        choices.push({ hat, shoes });
  return { color, ...choices[Math.floor(random() * choices.length)] };
}

const COLOR_NOTES: Record<string, (interest: string) => string> = {
  '#97745d': (i) =>
    `Earthy brown for a grounded teammate that ${i} projects can lean on.`,
  '#a99bff': (i) =>
    `Lavender for the imaginative streak that keeps ${i} feeling fresh.`,
  '#69cfc3': (i) =>
    `Mint green for calm, clear thinking when ${i} gets complicated.`,
  '#ef8ea3': (i) =>
    `Rose pink for the warmth that makes ${i} work friendly and welcoming.`,
  '#e8bb55': (i) =>
    `Golden yellow for the bright energy that makes ${i} sessions fun.`,
  '#80b9e8': (i) => `Sky blue for the curiosity that keeps exploring ${i}.`,
};
const HAT_NOTES: Record<FlyLook['hat'], (interest: string) => string> = {
  none: (i) =>
    `No hat keeps the antennae clear for picking up new ideas in ${i}.`,
  cap: (i) =>
    `A baseball cap fits someone who ships fast and gets hands-on with ${i}.`,
  crown: (i) =>
    `A little crown suits someone ready to lead a team through ${i}.`,
  wizard: (i) =>
    `A wizard hat matches turning ${i} into something that feels like magic.`,
};
const SHOE_NOTES: Record<FlyLook['shoes'], (interest: string) => string> = {
  none: () => 'Bare feet keep every landing on the counter light and quick.',
  sneakers: (i) =>
    `Tiny sneakers, because ${i} means sprinting between prototypes and demos.`,
  boots: (i) =>
    `Little boots are built for the long haul from first idea to finished ${i} project.`,
};

export function explainOutfit(
  profile: Pick<PlayerProfile, 'interests' | 'school'>,
  outfit: FlyLook,
): string {
  const interests = profile.interests
    .split(/[·,/|]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const first = interests[0] || profile.school.trim() || 'your work';
  const second = interests[1] || first;
  const third = interests[2] || first;
  const colorNote =
    COLOR_NOTES[outfit.color.toLowerCase()] ??
    ((i: string) => `A custom color as unique as your take on ${i}.`);
  return [
    colorNote(first),
    HAT_NOTES[outfit.hat](second),
    SHOE_NOTES[outfit.shoes](third),
  ].join(' ');
}
