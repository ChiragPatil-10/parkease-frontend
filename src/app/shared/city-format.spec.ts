import { formatCity } from './city-format';

describe('formatCity', () => {
  it.each([
    ['bangalore', 'Bangalore'],
    ['bengaluru', 'Bengaluru'],
    ['navi mumbai', 'Navi Mumbai'],
    ['NEW DELHI', 'New Delhi'],
    ['  pune ', 'Pune'],
    ['', ''],
  ])('formats "%s" as "%s"', (input, expected) => {
    expect(formatCity(input)).toBe(expected);
  });

  it('handles null and undefined', () => {
    expect(formatCity(null)).toBe('');
    expect(formatCity(undefined)).toBe('');
  });
});
