/**
 * Key historical moments, shown along the road as landmarks. They help the
 * user place a memory: "that was the year the Berlin Wall fell".
 * World news that most people know, plus moments in how people listened to music.
 * No moments that only one country would know.
 */
type MomentKind = 'news' | 'music';

export interface Moment {
  /** ISO date, yyyy-mm-dd. */
  date: string;
  label: string;
  kind: MomentKind;
}

export const MOMENTS: Moment[] = [
  { date: '1963-11-22', label: 'JFK is shot', kind: 'news' },
  { date: '1969-07-20', label: 'Moon landing', kind: 'news' },
  { date: '1969-08-15', label: 'Woodstock', kind: 'music' },
  { date: '1973-10-17', label: 'Oil crisis', kind: 'news' },
  { date: '1977-08-16', label: 'Elvis dies', kind: 'music' },
  { date: '1979-07-01', label: 'Sony Walkman', kind: 'music' },
  { date: '1980-12-08', label: 'John Lennon is shot', kind: 'music' },
  { date: '1981-08-01', label: 'MTV starts', kind: 'music' },
  { date: '1982-10-01', label: 'First CDs on sale', kind: 'music' },
  { date: '1985-07-13', label: 'Live Aid', kind: 'music' },
  { date: '1986-04-26', label: 'Chernobyl', kind: 'news' },
  { date: '1987-10-19', label: 'Black Monday crash', kind: 'news' },
  { date: '1989-11-09', label: 'Berlin Wall falls', kind: 'news' },
  { date: '1990-02-11', label: 'Mandela freed', kind: 'news' },
  { date: '1991-08-06', label: 'The web goes public', kind: 'news' },
  { date: '1991-12-26', label: 'Soviet Union ends', kind: 'news' },
  { date: '1994-04-05', label: 'Kurt Cobain dies', kind: 'music' },
  { date: '1997-07-01', label: 'Hong Kong handover', kind: 'news' },
  { date: '1998-09-04', label: 'Google founded', kind: 'news' },
  { date: '1999-06-01', label: 'Napster', kind: 'music' },
  { date: '2000-01-01', label: 'The Millennium', kind: 'news' },
  { date: '2001-09-11', label: '9/11', kind: 'news' },
  { date: '2001-10-23', label: 'iPod', kind: 'music' },
  { date: '2003-03-20', label: 'Iraq War', kind: 'news' },
  { date: '2004-02-04', label: 'Facebook starts', kind: 'news' },
  { date: '2004-12-26', label: 'Indian Ocean tsunami', kind: 'news' },
  { date: '2005-02-14', label: 'YouTube starts', kind: 'music' },
  { date: '2007-06-29', label: 'iPhone', kind: 'news' },
  { date: '2008-09-15', label: 'Financial crash', kind: 'news' },
  { date: '2008-10-07', label: 'Spotify starts', kind: 'music' },
  { date: '2009-06-25', label: 'Michael Jackson dies', kind: 'music' },
  { date: '2015-06-30', label: 'Apple Music starts', kind: 'music' },
  { date: '2020-03-11', label: 'COVID-19 pandemic', kind: 'news' },
  { date: '2022-02-24', label: 'Russia invades Ukraine', kind: 'news' },
  { date: '2022-11-30', label: 'ChatGPT', kind: 'news' },
];
