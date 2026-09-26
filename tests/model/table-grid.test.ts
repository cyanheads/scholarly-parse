/**
 * @fileoverview The shared table grid at the scale of a large supplementary table: every
 * row kept and padded to the widest.
 * @module tests/model/table-grid.test
 */
import { describe, expect, it } from 'vitest';
import { buildGrid, type SourceRow } from '../../src/model/table-grid.js';

const cell = (text: string) => ({ colspan: 1, header: false, rowspan: 1, text });

describe('buildGrid', () => {
  it('builds a grid of hundreds of thousands of rows, padded to the widest', () => {
    const rows: SourceRow[] = Array.from({ length: 500_000 }, (_, i) => ({
      cells: i === 0 ? [cell('a'), cell('b')] : [cell(String(i))],
      inHead: false,
    }));
    const grid = buildGrid(rows);
    expect(grid.rows).toHaveLength(500_000);
    expect(grid.rows[0]).toEqual(['a', 'b']);
    expect(grid.rows.at(-1)).toEqual(['499999', '']);
  });
});
