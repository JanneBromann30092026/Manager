import { describe, expect, it } from 'vitest';
import { nextCta } from './cta';

describe('nextCta', () => {
  it('rotates share → comment → follow → share', () => {
    expect(nextCta(undefined)).toBe('share');
    expect(nextCta('share')).toBe('comment');
    expect(nextCta('comment')).toBe('follow');
    expect(nextCta('follow')).toBe('share');
  });
});
