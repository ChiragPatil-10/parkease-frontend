import { formatRateLimitMessage, parseRetryAfter } from './rate-limit-message';
import { GENERAL_RATE_LIMIT_MESSAGE, LOGIN_RATE_LIMIT_MESSAGE } from './toast.constants';

const DASH = '\u2014';
const HTTP_DATE = 'Wed, 21 Oct 2026 07:28:00 GMT';

describe('parseRetryAfter', () => {
  it('accepts positive whole numbers only', () => {
    expect(parseRetryAfter('30')).toBe(30);
    expect(parseRetryAfter(' 45 ')).toBe(45);
    expect(parseRetryAfter(7)).toBe(7);
  });

  it('treats everything else as missing', () => {
    for (const value of [null, undefined, '', '0', 0, '-5', -5, 'abc', HTTP_DATE, '1.5', 1.5]) {
      expect(parseRetryAfter(value)).toBeNull();
    }
  });
});

describe('formatRateLimitMessage (login)', () => {
  it('uses the default login text when seconds are missing or unusable', () => {
    for (const value of [null, undefined, '', 0, '0', -5, '-5', 'abc', HTTP_DATE, '1.5']) {
      expect(formatRateLimitMessage('login', value)).toBe(LOGIN_RATE_LIMIT_MESSAGE);
    }
    expect(LOGIN_RATE_LIMIT_MESSAGE).toBe(`Too many login attempts ${DASH} try again in a minute.`);
  });

  it('counts seconds below a minute', () => {
    expect(formatRateLimitMessage('login', 1)).toBe(`Too many login attempts ${DASH} try again in 1 second.`);
    expect(formatRateLimitMessage('login', '30')).toBe(`Too many login attempts ${DASH} try again in 30 seconds.`);
    expect(formatRateLimitMessage('login', 59)).toBe(`Too many login attempts ${DASH} try again in 59 seconds.`);
  });

  it('uses the default text for 60 to 119 seconds', () => {
    expect(formatRateLimitMessage('login', 60)).toBe(LOGIN_RATE_LIMIT_MESSAGE);
    expect(formatRateLimitMessage('login', 119)).toBe(LOGIN_RATE_LIMIT_MESSAGE);
  });

  it('counts minutes (rounded up) from 120 seconds', () => {
    expect(formatRateLimitMessage('login', 120)).toBe(`Too many login attempts ${DASH} try again in 2 minutes.`);
    expect(formatRateLimitMessage('login', 121)).toBe(`Too many login attempts ${DASH} try again in 3 minutes.`);
  });
});

describe('formatRateLimitMessage (general)', () => {
  it('uses the default text when seconds are missing or unusable', () => {
    for (const value of [null, undefined, '', 0, '0', -5, '-5', 'abc', HTTP_DATE]) {
      expect(formatRateLimitMessage('general', value)).toBe(GENERAL_RATE_LIMIT_MESSAGE);
    }
  });

  it('counts seconds below a minute', () => {
    expect(formatRateLimitMessage('general', 1)).toBe('Too many requests. Please wait 1 second and try again.');
    expect(formatRateLimitMessage('general', 30)).toBe('Too many requests. Please wait 30 seconds and try again.');
    expect(formatRateLimitMessage('general', 59)).toBe('Too many requests. Please wait 59 seconds and try again.');
  });

  it('counts minutes (rounded up) from 60 seconds', () => {
    expect(formatRateLimitMessage('general', 60)).toBe('Too many requests. Please wait 1 minute and try again.');
    expect(formatRateLimitMessage('general', 119)).toBe('Too many requests. Please wait 2 minutes and try again.');
    expect(formatRateLimitMessage('general', 120)).toBe('Too many requests. Please wait 2 minutes and try again.');
    expect(formatRateLimitMessage('general', 121)).toBe('Too many requests. Please wait 3 minutes and try again.');
  });
});
