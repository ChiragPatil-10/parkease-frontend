import { formatRateLimitMessage, parseRetryAfter } from './rate-limit-message';
import { GENERAL_RATE_LIMIT_MESSAGE, LOGIN_RATE_LIMIT_MESSAGE } from './toast.constants';

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
    expect(LOGIN_RATE_LIMIT_MESSAGE).toBe(
      'Too many login attempts. Please wait a moment and try again.',
    );
  });

  it('always counts seconds', () => {
    expect(formatRateLimitMessage('login', 1)).toBe('Too many login attempts. Try again in 1 second.');
    expect(formatRateLimitMessage('login', '30')).toBe(
      'Too many login attempts. Try again in 30 seconds.',
    );
    expect(formatRateLimitMessage('login', 60)).toBe(
      'Too many login attempts. Try again in 60 seconds.',
    );
    expect(formatRateLimitMessage('login', 121)).toBe(
      'Too many login attempts. Try again in 121 seconds.',
    );
  });
});

describe('formatRateLimitMessage (general)', () => {
  it('uses the default text when seconds are missing or unusable', () => {
    for (const value of [null, undefined, '', 0, '0', -5, '-5', 'abc', HTTP_DATE]) {
      expect(formatRateLimitMessage('general', value)).toBe(GENERAL_RATE_LIMIT_MESSAGE);
    }
  });

  it('always counts seconds', () => {
    expect(formatRateLimitMessage('general', 1)).toBe(
      'Too many requests. Please wait 1 second and try again.',
    );
    expect(formatRateLimitMessage('general', 30)).toBe(
      'Too many requests. Please wait 30 seconds and try again.',
    );
    expect(formatRateLimitMessage('general', 60)).toBe(
      'Too many requests. Please wait 60 seconds and try again.',
    );
    expect(formatRateLimitMessage('general', 121)).toBe(
      'Too many requests. Please wait 121 seconds and try again.',
    );
  });
});
