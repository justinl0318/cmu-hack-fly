'use client';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import {
  FLY_COLORS,
  normalizeProfile,
  safeProfileUrl,
  type PlayerProfile,
} from '@/lib/profile';
import { flyPortrait } from '@/lib/fly-model';

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
      <span>{error || 'YOUR FLY · YOUR STYLE'}</span>
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
  const set = (key: keyof Omit<PlayerProfile, 'look'>, value: string) =>
    setProfile((p) => ({ ...p, [key]: value }));
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
        <strong>FLYCIRCUIT / THE FLY CLUB</strong>
        <span className="eyebrow">ONE LAP. NEW CONNECTIONS.</span>
      </header>
      <section className="title-row">
        <div>
          <div className="eyebrow">BEFORE YOU TAKE OFF</div>
          <h1>
            A little fly.
            <br />
            <span>A whole personality.</span>
          </h1>
          <p>Make a fly, race a lap, meet the people behind the wings.</p>
        </div>
      </section>
      <div className="garage-grid">
        <section className="garage-avatar">
          <FlyPortrait profile={profile} />
          <h2>Dress for the finish line.</h2>
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
          <div className="eyebrow">YOUR POST-RACE SOCIAL CARD</div>
          <h2>Put a person behind the pilot.</h2>
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
          <label>
            A little about you
            <textarea
              maxLength={160}
              value={profile.bio}
              placeholder="Building cool things with robots & vision."
              onChange={(e) => set('bio', e.target.value)}
            />
          </label>
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
