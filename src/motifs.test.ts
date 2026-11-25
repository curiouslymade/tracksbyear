import { describe, expect, it } from 'vitest';
import { GENRES } from './genres';
import { motifsFor } from './motifs';

describe('motifsFor', () => {
  it('gives every genre family at least three motifs', () => {
    for (const g of GENRES) expect(motifsFor(g.id).length, g.id).toBeGreaterThanOrEqual(3);
  });
});
