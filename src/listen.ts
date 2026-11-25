/**
 * Links that open a song in a music service, for the play buttons. They need no
 * sign-in and make no API call: the browser simply opens the service's page.
 */
/**
 * A link that opens the song in Spotify, for anyone, with no sign-in and no API call.
 * Goes straight to the track when the app knows it, or else to a Spotify search.
 */
export function spotifyLink(song: { title: string; artist: string; spotifyUri?: string }): string {
  const id = song.spotifyUri?.startsWith('spotify:track:') ? song.spotifyUri.slice('spotify:track:'.length) : undefined;
  if (id && /^[A-Za-z0-9]+$/.test(id)) return `https://open.spotify.com/track/${id}`;
  return `https://open.spotify.com/search/${encodeURIComponent(`${song.title} ${song.artist}`)}`;
}

export type Player = 'spotify' | 'apple';

export const PLAYERS: { id: Player; name: string }[] = [
  { id: 'spotify', name: 'Spotify' },
  { id: 'apple', name: 'Apple Music' },
];

export function playerName(player: Player): string {
  return PLAYERS.find((p) => p.id === player)!.name;
}

/** The Apple Music store for the browser's region, for example "gb" for en-GB. Falls back to "us". */
export function appleStorefront(language = typeof navigator !== 'undefined' ? navigator.language : ''): string {
  const region = /^[a-z]{2,3}-([a-z]{2})\b/i.exec(language)?.[1];
  return region ? region.toLowerCase() : 'us';
}

export function appleMusicLink(song: { title: string; artist: string }, storefront = appleStorefront()): string {
  return `https://music.apple.com/${storefront}/search?term=${encodeURIComponent(`${song.title} ${song.artist}`)}`;
}

export function listenLink(song: { title: string; artist: string; spotifyUri?: string }, player: Player): string {
  return player === 'apple' ? appleMusicLink(song) : spotifyLink(song);
}
