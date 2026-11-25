import { describe, expect, it } from 'vitest';
import { familyFromGenres, familyOf } from './genres';

describe('familyOf', () => {
  it('maps common MusicBrainz genres', () => {
    expect(familyOf('britpop')).toBe('indie');
    expect(familyOf('alternative rock')).toBe('indie');
    expect(familyOf('heavy metal')).toBe('metal');
    expect(familyOf('pop punk')).toBe('punk');
    expect(familyOf('synth-pop')).toBe('pop');
    expect(familyOf('hip hop')).toBe('hiphop');
    expect(familyOf('drum and bass')).toBe('electronic');
    expect(familyOf('contemporary r&b')).toBe('soul');
    expect(familyOf('rock and roll')).toBe('rock');
    expect(familyOf('singer-songwriter')).toBe('folk');
  });
  it('matches whole words only', () => {
    expect(familyOf('dubstep')).toBe('electronic');
    expect(familyOf('roots reggae')).toBe('reggae');
    expect(familyOf('spoken word')).toBeUndefined();
  });
});

describe('familyFromGenres', () => {
  it('uses the votes to pick the main family', () => {
    expect(
      familyFromGenres([
        { name: 'rock', count: 3 },
        { name: 'britpop', count: 9 },
        { name: 'alternative rock', count: 4 },
      ]),
    ).toBe('indie');
    expect(familyFromGenres([{ name: 'pop', count: 1 }, { name: 'rock', count: 5 }])).toBe('rock');
  });
  it('returns nothing for no genres or unknown genres', () => {
    expect(familyFromGenres([])).toBeUndefined();
    expect(familyFromGenres(undefined)).toBeUndefined();
    expect(familyFromGenres([{ name: 'spoken word' }])).toBeUndefined();
  });
});
