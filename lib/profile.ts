export const FLY_COLORS = [
  '#97745d',
  '#a99bff',
  '#69cfc3',
  '#ef8ea3',
  '#e8bb55',
  '#80b9e8',
];
export interface FlyLook {
  color: string;
  hat: 'none' | 'cap' | 'crown' | 'wizard';
  shoes: 'none' | 'sneakers' | 'boots';
}
export interface PlayerProfile {
  name: string;
  school: string;
  interests: string;
  bio: string;
  profileUrl: string;
  connectUrl: string;
  look: FlyLook;
}
export const DEFAULT_LOOK: FlyLook = {
  color: '#97745d',
  hat: 'none',
  shoes: 'none',
};
export function safeProfileUrl(value: unknown): string {
  if (typeof value !== 'string' || value.length > 300) return '';
  try {
    const url = new URL(value.trim());
    return ['https:', 'http:'].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : '';
  } catch {
    return '';
  }
}
export function normalizeProfile(value: unknown): PlayerProfile {
  const p =
    value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : {};
  const look =
    p.look && typeof p.look === 'object'
      ? (p.look as Record<string, unknown>)
      : {};
  const text = (key: string, max: number) =>
    typeof p[key] === 'string'
      ? Array.from(p[key] as string, (c) => (c.charCodeAt(0) < 32 ? ' ' : c))
          .join('')
          .trim()
          .slice(0, max)
      : '';
  return {
    name: text('name', 40) || 'Friendly Fly',
    school: text('school', 70),
    interests: text('interests', 100),
    bio: text('bio', 160),
    profileUrl: safeProfileUrl(p.profileUrl),
    connectUrl: safeProfileUrl(p.connectUrl),
    look: {
      color:
        typeof look.color === 'string' && /^#[0-9a-f]{6}$/i.test(look.color)
          ? look.color
          : DEFAULT_LOOK.color,
      hat: ['cap', 'crown', 'wizard'].includes(String(look.hat))
        ? (look.hat as FlyLook['hat'])
        : 'none',
      shoes: ['sneakers', 'boots'].includes(String(look.shoes))
        ? (look.shoes as FlyLook['shoes'])
        : 'none',
    },
  };
}
export function raceTime(seconds: number) {
  const centiseconds = Math.floor(Math.max(0, seconds) * 100);
  return `${String(Math.floor(centiseconds / 6000)).padStart(2, '0')}:${String(Math.floor(centiseconds / 100) % 60).padStart(2, '0')}.${String(centiseconds % 100).padStart(2, '0')}`;
}
