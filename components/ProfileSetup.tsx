'use client';
import Image from 'next/image';
import Brand from './Brand';
import { useEffect, useState } from 'react';
import {
  FLY_COLORS,
  normalizeProfile,
  safeProfileUrl,
  type PlayerProfile,
} from '@/lib/profile';
import { flyPortrait } from '@/lib/fly-model';

const DEMO_BACKGROUNDS = [
  {
    school: 'CMU MSCV ’27',
    interests: 'Computer Vision · Robotics · RL',
    bio: 'Building robots that see, learn, and explore. Looking for teammates who enjoy vision, reinforcement learning, and hands-on demos.',
  },
  {
    school: 'CMU MHCI ’27',
    interests: 'HCI · Product Design · Accessibility',
    bio: 'Designing playful, accessible experiences. I love prototyping ideas and teaming up with people who care about how technology feels.',
  },
  {
    school: 'CMU MSCS ’27',
    interests: 'Distributed Systems · Backend · Open Source',
    bio: 'Turning ambitious ideas into working systems. Always up for building multiplayer apps, exploring infrastructure, and sharing open-source projects.',
  },
  {
    school: 'CMU MSE ’27',
    interests: 'Full-stack · AI Apps · Entrepreneurship',
    bio: 'Building useful AI products from prototype to launch. Looking for collaborators who enjoy fast experiments and solving everyday problems.',
  },
  {
    school: 'CMU MET ’27',
    interests: 'Game Development · 3D Art · Interactive Media',
    bio: 'Making games and interactive worlds. I enjoy mixing art with code and meeting people who want to create something unexpected.',
  },
];

export function FlyPortrait({ profile }: { profile: PlayerProfile }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const { color, hat, shoes } = profile.look;
  useEffect(() => {
    let live = true;
    queueMicrotask(() => {
      if (!live) return;
      try {
        setUrl(flyPortrait({ color, hat, shoes }));
        setError('');
      } catch {
        setError(
          '3D preview unavailable on this device. Your choices are still saved.',
        );
      }
    });
    return () => {
      live = false;
    };
  }, [color, hat, shoes]);
  return (
    <div className="fly-portrait">
      {url && (
        <Image
          unoptimized
          width={400}
          height={400}
          src={url}
          alt={`${profile.name}'s fly: ${color}, ${hat} hat, ${shoes}`}
        />
      )}
      {error && <span>{error}</span>}
    </div>
  );
}

export default function ProfileSetup({
  initial,
  onStart,
}: {
  initial: PlayerProfile;
  onStart: (mode: 'single' | 'multi', profile: PlayerProfile) => void;
}) {
  const [profile, setProfile] = useState(initial);
  const [error, setError] = useState('');
  const [demoIndex, setDemoIndex] = useState(-1);
  const set = (key: keyof Omit<PlayerProfile, 'look'>, value: string) =>
    setProfile((p) => ({ ...p, [key]: value }));
  function fillDemoResume() {
    const choices = DEMO_BACKGROUNDS.map((_, index) => index).filter(
      (index) => index !== demoIndex,
    );
    const index = choices[Math.floor(Math.random() * choices.length)];
    setProfile((p) => ({ ...p, ...DEMO_BACKGROUNDS[index] }));
    setDemoIndex(index);
  }
  function start(mode: 'single' | 'multi') {
    if (
      [profile.profileUrl, profile.connectUrl].some(
        (url) => url.trim() && !safeProfileUrl(url),
      )
    ) {
      setError('Use a complete http:// or https:// link, or leave it blank.');
      return;
    }
    const clean = normalizeProfile(profile);
    try {
      localStorage.setItem('flycircuit-profile-v1', JSON.stringify(clean));
    } catch {
      /* Private browsing may not allow persistence. */
    }
    onStart(mode, clean);
  }
  return (
    <main className="flight-lab garage">
      <header className="topbar">
        <Brand />
        <span className="brand-slogan">
          Connect on the <span className="linkedfly-gold">FLY</span>
        </span>
      </header>
      <h1 className="sr-only">Player setup</h1>
      <div className="garage-grid">
        <section className="garage-avatar">
          <FlyPortrait profile={profile} />
          <h2>Fly appearance</h2>
          <fieldset>
            <legend>Body color</legend>
            <div className="color-swatches">
              {FLY_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`Body color ${color}`}
                  aria-pressed={profile.look.color === color}
                  style={{ background: color }}
                  onClick={() =>
                    setProfile((p) => ({ ...p, look: { ...p.look, color } }))
                  }
                />
              ))}
              <label className="custom-color">
                Custom
                <input
                  type="color"
                  value={profile.look.color}
                  onChange={(e) =>
                    setProfile((p) => ({
                      ...p,
                      look: { ...p.look, color: e.target.value },
                    }))
                  }
                />
              </label>
            </div>
          </fieldset>
          <div className="accessory-grid">
            <label>
              Hat
              <select
                value={profile.look.hat}
                onChange={(e) =>
                  setProfile((p) => ({
                    ...p,
                    look: {
                      ...p.look,
                      hat: e.target.value as PlayerProfile['look']['hat'],
                    },
                  }))
                }
              >
                <option value="none">No hat</option>
                <option value="cap">Baseball cap</option>
                <option value="crown">Little crown</option>
                <option value="wizard">Wizard hat</option>
              </select>
            </label>
            <label>
              Shoes
              <select
                value={profile.look.shoes}
                onChange={(e) =>
                  setProfile((p) => ({
                    ...p,
                    look: {
                      ...p.look,
                      shoes: e.target.value as PlayerProfile['look']['shoes'],
                    },
                  }))
                }
              >
                <option value="none">Bare feet</option>
                <option value="sneakers">Tiny sneakers</option>
                <option value="boots">Little boots</option>
              </select>
            </label>
          </div>
        </section>
        <section className="profile-fields">
          <h2>Player profile</h2>
          <label>
            Display name
            <input
              maxLength={40}
              value={profile.name === 'Friendly Fly' ? '' : profile.name}
              placeholder="Max Lung"
              onChange={(e) => set('name', e.target.value)}
            />
          </label>
          <label>
            School / program / year
            <input
              maxLength={70}
              value={profile.school}
              placeholder="CMU MSCV ’27"
              onChange={(e) => set('school', e.target.value)}
            />
          </label>
          <label>
            Interests
            <input
              maxLength={100}
              value={profile.interests}
              placeholder="Computer Vision · Robotics · RL"
              onChange={(e) => set('interests', e.target.value)}
            />
          </label>
          <div className="resume-field">
            <div className="resume-heading">
              <label htmlFor="profile-bio">A little about you</label>
              <button
                type="button"
                className="quiet-button"
                onClick={fillDemoResume}
                aria-describedby="resume-demo-note"
              >
                Upload resume <span className="resume-demo-badge">Demo</span>
              </button>
            </div>
            <p id="resume-demo-note" className="profile-note">
              Demo only — fills sample education, interests and bio. No file is
              uploaded.
            </p>
            <textarea
              id="profile-bio"
              maxLength={160}
              value={profile.bio}
              placeholder="Building cool things with robots & vision."
              onChange={(e) => set('bio', e.target.value)}
            />
            <output className="profile-note">
              {demoIndex >= 0
                ? 'Sample background filled. Edit any field, or click again for another example.'
                : ''}
            </output>
          </div>
          <div className="accessory-grid">
            <label>
              Profile link (optional)
              <input
                type="url"
                maxLength={300}
                value={profile.profileUrl}
                placeholder="https://your-portfolio.com"
                onChange={(e) => set('profileUrl', e.target.value)}
              />
            </label>
            <label>
              Connect link (optional)
              <input
                type="url"
                maxLength={300}
                value={profile.connectUrl}
                placeholder="https://linkedin.com/in/…"
                onChange={(e) => set('connectUrl', e.target.value)}
              />
            </label>
          </div>
          <p className="profile-note">
            Everything here is optional. Your profile is saved on this browser,
            shared with your room, and included in exported cards. Only add
            information you want other players to keep.
          </p>
          {error && <p className="error-banner">{error}</p>}
          <div className="garage-actions">
            <button className="primary-button" onClick={() => start('multi')}>
              Multiplayer →
            </button>
            <button className="quiet-button" onClick={() => start('single')}>
              Single player
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
