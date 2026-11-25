import { useEffect, useState } from 'react';
import { NO_PERIOD_KEY, type SongWithEstimate, type TimelineGroup } from '../estimate';
import { download, filePlaylists, toCsv, toText } from '../exportFile';
import { buildShare, encodeShare, SHARE_PREFIX } from '../share';
import { drawShareCard } from '../shareCard';
import type { LifePeriod } from '../types';

type Mode = 'perPeriod' | 'whole';

const canShareFiles = (file: File) => typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });

/** Share an image, share a link, or download playlist files. */
export function SharePanel({
  items,
  groups,
  periods,
  title,
  theme,
}: {
  items: SongWithEstimate[];
  groups: TimelineGroup[];
  periods: LifePeriod[];
  title: string;
  theme: 'day' | 'night';
}) {
  return (
    <div className="stack-6">
      <ShareImage items={items} title={title} theme={theme} />
      <ShareLink items={items} periods={periods} />
      <DownloadFile groups={groups} />
    </div>
  );
}

function ShareImage({ items, title, theme }: { items: SongWithEstimate[]; title: string; theme: 'day' | 'night' }) {
  const [file, setFile] = useState<File>();
  const [url, setUrl] = useState<string>();
  const [note, setNote] = useState<string>();

  useEffect(() => {
    let live = true;
    let made: string | undefined;
    if (!items.length) return;
    drawShareCard(items, title, theme)
      .then((blob) => {
        if (!live) return;
        made = URL.createObjectURL(blob);
        setFile(new File([blob], 'tracks-by-year.png', { type: 'image/png' }));
        setUrl(made);
      })
      .catch(() => live && setNote('The image could not be made in this browser.'));
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [items, title, theme]);

  const share = async () => {
    if (!file) return;
    try {
      await navigator.share({ files: [file], title: 'My music timeline' });
    } catch {
      /* The user closed the share sheet. */
    }
  };

  return (
    <section className="stack-4" aria-labelledby="share-image">
      <h3 id="share-image" className="modal__subhead">
        Share an image
      </h3>
      {!items.length ? (
        <p className="modal__fine">Add some songs first.</p>
      ) : (
        <div className="share-image">
          {url ? <img src={url} alt="A picture of your timeline, ready to share" className="share-image__preview" /> : <div className="share-image__preview" />}
          <div className="stack-4">
            <p className="modal__fine">Sized for Instagram, WhatsApp and most apps.</p>
            <div className="row row--center">
              {file && canShareFiles(file) && (
                <button className="tm-btn tm-btn--primary" onClick={() => void share()}>
                  Share
                </button>
              )}
              <button className="tm-btn" disabled={!url} onClick={() => file && download('tracks-by-year.png', file, 'image/png')}>
                Download image
              </button>
            </div>
            {note && <p className="tm-field__error">{note}</p>}
          </div>
        </div>
      )}
    </section>
  );
}

function ShareLink({ items, periods }: { items: SongWithEstimate[]; periods: LifePeriod[] }) {
  const [withPeriods, setWithPeriods] = useState(true);
  const [withPlaces, setWithPlaces] = useState(false);
  const [link, setLink] = useState<string>();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let live = true;
    setCopied(false);
    encodeShare(buildShare(items, periods, { periods: withPeriods, places: withPlaces })).then(
      (code) => live && setLink(`${location.origin}${location.pathname}${SHARE_PREFIX}${code}`),
    );
    return () => {
      live = false;
    };
  }, [items, periods, withPeriods, withPlaces]);

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      window.prompt('Copy this link:', link);
    }
  };

  return (
    <section className="stack-4" aria-labelledby="share-link">
      <h3 id="share-link" className="modal__subhead">
        Share a link
      </h3>
      <p className="modal__fine">
        Anyone with the link can look around your timeline, but cannot change it.
      </p>
      <fieldset className="choices">
        <label>
          <input type="checkbox" checked={withPeriods} onChange={(e) => setWithPeriods(e.target.checked)} />
          Include my life periods
        </label>
        <label>
          <input type="checkbox" checked={withPlaces} disabled={!withPeriods} onChange={(e) => setWithPlaces(e.target.checked)} />
          Include the places of my life periods
        </label>
      </fieldset>
      <div className="row row--center">
        <button className="tm-btn tm-btn--primary" disabled={!link || !items.length} onClick={() => void copy()}>
          {copied ? 'Link copied' : 'Copy link'}
        </button>
        {link && typeof navigator.share === 'function' && (
          <button className="tm-btn" onClick={() => void navigator.share({ url: link, title: 'My music timeline' }).catch(() => undefined)}>
            Share link
          </button>
        )}
      </div>
    </section>
  );
}

function DownloadFile({ groups }: { groups: TimelineGroup[] }) {
  const [mode, setMode] = useState<Mode>('perPeriod');
  const [includeOther, setIncludeOther] = useState(true);
  const selected = groups.filter((g) => g.items.length > 0 && (includeOther || g.key !== NO_PERIOD_KEY));
  const songCount = selected.reduce((n, g) => n + g.items.length, 0);

  const saveFile = (kind: 'csv' | 'txt') => {
    const playlists = filePlaylists(groups, mode, includeOther);
    if (kind === 'csv') download('tracks-by-year.csv', toCsv(playlists), 'text/csv');
    else download('tracks-by-year.txt', toText(playlists), 'text/plain');
  };

  return (
    <section className="stack-4" aria-labelledby="export-file">
      <h3 id="export-file" className="modal__subhead">
        Download playlists
      </h3>
      <p className="modal__fine">
        To make the playlists in Spotify, Apple Music or YouTube Music, upload the file to{' '}
        <a className="tm-link" href="https://www.tunemymusic.com/" target="_blank" rel="noopener noreferrer">
          TuneMyMusic
        </a>{' '}
        or{' '}
        <a className="tm-link" href="https://soundiiz.com/" target="_blank" rel="noopener noreferrer">
          Soundiiz
        </a>
        .
      </p>
      <fieldset className="choices">
        <label>
          <input type="radio" checked={mode === 'perPeriod'} onChange={() => setMode('perPeriod')} />
          One playlist for each life period
        </label>
        <label>
          <input type="radio" checked={mode === 'whole'} onChange={() => setMode('whole')} />
          One playlist for the whole timeline
        </label>
        <label>
          <input type="checkbox" checked={includeOther} onChange={(e) => setIncludeOther(e.target.checked)} />
          Include songs outside the life periods
        </label>
      </fieldset>
      <div className="row row--center">
        <button className="tm-btn" disabled={songCount === 0} onClick={() => saveFile('csv')}>
          Download CSV
        </button>
        <button className="tm-btn" disabled={songCount === 0} onClick={() => saveFile('txt')}>
          Download text list
        </button>
      </div>
    </section>
  );
}
