import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'filter',
  standalone: true
})
export class FilterPipe implements PipeTransform {
  transform(items: any[], filter: { [key: string]: any }): any[] {
    if (!items || !filter || Object.keys(filter).every(key => !filter[key])) {
      return items;
    }
    return items.filter(item => {
      return Object.keys(filter).every(key => !filter[key] || item[key] === filter[key]);
    });
  }
}