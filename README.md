# Tracks by Year

Put the songs of your life on a timeline, and see when you first heard each one.

**Open it:** [tracksbyear.curiouslymade.dev](https://tracksbyear.curiouslymade.dev/)

Add the times of your life, such as school or a first job, then the songs you remember. The app finds the release date of each song on [MusicBrainz](https://musicbrainz.org/), estimates when you first heard it, and puts it on a timeline. The background of the timeline changes colour with the main genre of each era.

## What you can do

- **Add songs.** Search MusicBrainz, or type the title and artist. Then say when you first heard the song: when it came out, in a given year, or during one of your life periods.
- **Move songs.** Drag a song along the timeline to change the year.
- **Breakdown.** See your genres, the decades your songs come from, the songs in each life period, and some highlights.
- **Search.** Find a song, an artist, a genre or a life period on the timeline.
- **Share.** Share the timeline as an image or a link, or download it as playlist files (CSV or text). You can upload the playlist files to TuneMyMusic or Soundiiz. The image is 1080 by 1440 pixels, the 3:4 shape of an Instagram post, and it shows the address of the app.
- **Play.** Each song opens in Spotify or Apple Music. Choose the service in Settings.
- **Start again.** Settings can clear every song and life period, so you start with a blank timeline.

On a phone, you pick dates with scroll wheels for the day, the month and the year. For a release date, you can leave out the day, or the day and the month.

## How it estimates when you first heard a song

The release date is the earliest possible date. Your answer sets the window:

| Your answer | Window |
|---|---|
| In a year | That year |
| During a life period | From the later of the period start and the release date, to the period end |
| When it came out | 12 months from the release date |
| No release date yet | From your first life period to today |

## Your data

- Your songs and life periods stay in your browser, in IndexedDB. There is no account, no server and no tracking.
- A different browser or computer starts with no data.
- The app sends song titles and artist names to MusicBrainz to find release dates and genres. It sends nothing else.
- A share link holds the timeline in the part after `#share=`. Browsers do not send that part to a server, so the timeline is not stored anywhere. Places are left out unless you choose to include them.
- The app checks each share link before it shows it. A link that fails a check shows "This share link does not work".

## Security

- The site has a strict Content Security Policy. The browser can load files from this site only, and can call only `https://musicbrainz.org`.
- There are no third-party scripts, trackers or font hosts.
- The app needs no keys and no secrets.
- gitleaks scans each commit before it is made, and CI scans the full history on each push.

## Run it on your computer

You need Node.js 24, Git and [gitleaks](https://github.com/gitleaks/gitleaks).

1. Clone the repo.
2. Run `npm ci`. This also turns on the gitleaks pre-commit hook.
3. Run `npm run dev`, then open http://127.0.0.1:5173.
4. Run `npm test` to run the tests.
5. Run `npm run build` to build the site into `dist/` and check it.
6. Run `npm run preview` to serve `dist/` with the real security headers on http://localhost:8787.

The browser keeps a different set of data for each address, so always use the same address.

## How it is built

- React, TypeScript and Vite. All code runs in the browser.
- [Dexie](https://dexie.org/) stores the data in IndexedDB. [dnd-kit](https://dndkit.com/) handles drag and drop.
- `site.config.json` holds the name, address and outside services. The build makes the security headers, `robots.txt`, `sitemap.xml` and the manifest from it, and `scripts/check-dist.mjs` checks the result.
- Cloudflare Workers serves the built files. Each change to `main` builds and deploys the app.

## Part of Curiously made

This is one of the small web apps on [curiouslymade.dev](https://curiouslymade.dev/).

## Licence

MIT. See [LICENSE](LICENSE). Song data comes from MusicBrainz.

The fonts are Jost and Poiret One, self-hosted as Latin subsets. Each has the SIL Open Font License 1.1. See `public/fonts/OFL-Jost.txt` and `public/fonts/OFL-PoiretOne.txt`.
