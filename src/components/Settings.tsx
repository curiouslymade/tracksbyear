import { useState } from 'react';
import { startAgain } from '../actions';
import { PLAYERS, type Player } from '../listen';
import { ConfirmDialog } from './ConfirmDialog';

export type Theme = 'day' | 'night';

/** The play service, the historical moments, and "Start again". */
export function Settings({
  showMoments,
  onShowMoments,
  player,
  onPlayer,
  onStartedAgain,
}: {
  showMoments: boolean;
  onShowMoments: (show: boolean) => void;
  player: Player;
  onPlayer: (player: Player) => void;
  /** Runs after the timeline is cleared, for example to close the modal. */
  onStartedAgain: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="stack-6">
      <section className="stack-4" aria-labelledby="settings-player">
        <h3 id="settings-player" className="modal__subhead">
          Play songs in
        </h3>
        <div className="switch" role="group" aria-labelledby="settings-player">
          {PLAYERS.map((p) => (
            <button key={p.id} aria-pressed={player === p.id} onClick={() => onPlayer(p.id)}>
              {p.name}
            </button>
          ))}
        </div>
      </section>

      <section className="stack-4" aria-labelledby="settings-moments">
        <h3 id="settings-moments" className="modal__subhead">
          Historical moments
        </h3>
        <div className="switch" role="group" aria-labelledby="settings-moments">
          <button aria-pressed={showMoments} onClick={() => onShowMoments(true)}>
            Show
          </button>
          <button aria-pressed={!showMoments} onClick={() => onShowMoments(false)}>
            Hide
          </button>
        </div>
      </section>

      <section className="stack-4" aria-labelledby="settings-start-again">
        <h3 id="settings-start-again" className="modal__subhead">
          Start again
        </h3>
        <p className="modal__fine">Clear every song and life period, and start with a blank timeline.</p>
        <div>
          <button type="button" className="tm-btn" onClick={() => setConfirming(true)}>
            Start again
          </button>
        </div>
      </section>

      {confirming && (
        <ConfirmDialog
          title="Start again?"
          message="This deletes all your songs and life periods from this browser. It cannot be undone. To keep a copy, download your playlists or copy a share link first."
          confirmLabel="Delete everything"
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            void startAgain().then(() => {
              setConfirming(false);
              onStartedAgain();
            });
          }}
        />
      )}
    </div>
  );
}
