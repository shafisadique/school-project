import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'filterByStudentId',
  standalone: true
})
export class FilterByStudentIdPipe implements PipeTransform {
  transform(students: any[], studentId: string): any[] {
    if (!studentId) {
      return students; // Return all students if no studentId is selected
    }
    return students.filter(student => student._id === studentId);
  }
}