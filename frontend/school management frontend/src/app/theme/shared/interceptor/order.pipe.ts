import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'orderBy',
  pure: false // Required for dynamic sorting
})
export class OrderByPipe implements PipeTransform {
  transform(array: any[], column: string, direction: 'asc' | 'desc'): any[] {
    if (!array || !column) return array;
    return [...array].sort((a, b) => {
      const valueA = typeof a[column] === 'number' ? a[column] : (a[column] || '').toString().toLowerCase();
      const valueB = typeof b[column] === 'number' ? b[column] : (b[column] || '').toString().toLowerCase();
      if (valueA < valueB) return direction === 'asc' ? -1 : 1;
      if (valueA > valueB) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  }
}