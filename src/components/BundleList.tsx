import { formatRange } from '../dates';
import type { SongWithEstimate } from '../estimate';
import { listenLink, playerName, type Player } from '../listen';
import { PlayIcon } from './Icons';

/** The songs in a "+N more" bundle. Click a song for its details. */
export function BundleList({
  items,
  player,
  readOnly,
  onSelect,
}: {
  items: SongWithEstimate[];
  player: Player;
  readOnly: boolean;
  onSelect: (id: number) => void;
}) {
  return (
    <ul className="ruled-list bundle-list">
      {items.map(({ song, estimate }) => (
        <li key={song.id}>
          {readOnly ? (
            <div>
              <div className="ruled-list__title">{song.title}</div>
              <div className="ruled-list__muted">
                {song.artist} · {formatRange(estimate.from, estimate.to)}
              </div>
            </div>
          ) : (
            <button className="bundle-list__song" onClick={() => onSelect(song.id!)}>
              <span className="ruled-list__title">{song.title}</span>
              <span className="ruled-list__muted">
                {song.artist} · {formatRange(estimate.from, estimate.to)}
              </span>
            </button>
          )}
          <a
            className="card__play bundle-list__play"
            href={listenLink(song, player)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Play ${song.title} in ${playerName(player)}`}
            title={`Play in ${playerName(player)}`}
          >
            <PlayIcon />
          </a>
        </li>
      ))}
    </ul>
  );
}
