import { PaginatePipe } from './paginate.pipe';

describe('PaginatePipe', () => {
  const pipe = new PaginatePipe();
  const items = Array.from({ length: 25 }, (_, i) => i + 1);

  it('returns the first page slice', () => {
    expect(pipe.transform(items, 1, 10)).toEqual(items.slice(0, 10));
  });

  it('returns a partial last page', () => {
    expect(pipe.transform(items, 3, 10)).toEqual(items.slice(20, 25));
  });

  it('returns an empty array for an out-of-range page', () => {
    expect(pipe.transform(items, 5, 10)).toEqual([]);
  });
});
