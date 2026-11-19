import { describe, expect, it } from 'vitest';
import { toCSV } from './csv';

describe('toCSV', () => {
  it('escapes quotes, commas and newlines', () => {
    expect(toCSV([{ a: 'x,y', b: 'say "hi"', c: null }, { a: 1, b: 'l1\nl2' }], ['a', 'b', 'c'])).toBe('a,b,c\n"x,y","say ""hi""",\n1,"l1\nl2",');
  });
});
