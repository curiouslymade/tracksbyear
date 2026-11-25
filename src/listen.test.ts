import { describe, expect, it } from 'vitest';
import { appleMusicLink, appleStorefront, listenLink, spotifyLink } from './listen';

describe('listen links', () => {
  it('picks the Apple Music store from the browser language', () => {
    expect(appleStorefront('en-GB')).toBe('gb');
    expect(appleStorefront('fr-FR')).toBe('fr');
    expect(appleStorefront('en')).toBe('us');
  });
  it('builds an Apple Music search link', () => {
    expect(appleMusicLink({ title: 'Wonderwall', artist: 'Oasis' }, 'gb')).toBe(
      'https://music.apple.com/gb/search?term=Wonderwall%20Oasis',
    );
  });
  it('uses the chosen player', () => {
    expect(listenLink({ title: 'Wonderwall', artist: 'Oasis' }, 'spotify')).toBe('https://open.spotify.com/search/Wonderwall%20Oasis');
    expect(listenLink({ title: 'Wonderwall', artist: 'Oasis' }, 'apple')).toMatch(/^https:\/\/music\.apple\.com\/[a-z]{2}\/search\?term=Wonderwall%20Oasis$/);
  });
});

describe('spotifyLink', () => {
  it('opens the track when the app knows it, or a search', () => {
    expect(spotifyLink({ title: 'Wonderwall', artist: 'Oasis', spotifyUri: 'spotify:track:5qqabIl2vWzo9ApSC317sa' })).toBe(
      'https://open.spotify.com/track/5qqabIl2vWzo9ApSC317sa',
    );
    expect(spotifyLink({ title: 'Wonderwall', artist: 'Oasis' })).toBe('https://open.spotify.com/search/Wonderwall%20Oasis');
  });
});
