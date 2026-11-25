import { PLAYERS, type Player } from '../listen';

export type Theme = 'day' | 'night';

/** The play service and the historical moments. */
export function Settings({
  showMoments,
  onShowMoments,
  player,
  onPlayer,
}: {
  showMoments: boolean;
  onShowMoments: (show: boolean) => void;
  player: Player;
  onPlayer: (player: Player) => void;
}) {
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

    </div>
  );
}
