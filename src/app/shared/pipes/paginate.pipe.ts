import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'paginate' })
export class PaginatePipe implements PipeTransform {
  transform<T>(items: readonly T[], page: number, pageSize: number): T[] {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }
}
