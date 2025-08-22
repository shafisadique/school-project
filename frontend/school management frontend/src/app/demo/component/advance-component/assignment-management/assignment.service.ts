import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

interface Assignment {
  _id: string;
  title: string;
  description: string;
  dueDate: string;
  classId: string;
  subjectId: string;
  assignedTo: string[];
}

@Injectable({
  providedIn: 'root'
})
export class AssignmentService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  createAssignment(assignment: Partial<Assignment>, files: File[], teacherId: string): Observable<any> {
    const formData = new FormData();
    formData.append('title', assignment.title || '');
    formData.append('description', assignment.description || '');
    formData.append('dueDate', assignment.dueDate || '');
    formData.append('classId', assignment.classId || '');
    formData.append('subjectId', assignment.subjectId || '');
    if (assignment.assignedTo) {
      assignment.assignedTo.forEach((studentId, index) => {
        formData.append(`assignedTo[${index}]`, studentId);
      });
    }
    if (files) {
      files.forEach((file) => {
        formData.append('attachments', file);
      });
    }

    // Append teacherId as a query parameter
    const url = `${this.apiUrl}/api/assignments/add?teacherId=${encodeURIComponent(teacherId)}`;
    return this.http.post(url, formData);
  }

  // ... other methods ...
}