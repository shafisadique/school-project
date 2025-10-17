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

const url = `${this.apiUrl}/api/assignments/create?teacherId=${encodeURIComponent(teacherId)}`;
console.log(url)
  const token = localStorage.getItem('token');
  return this.http.post(url, formData, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  }

  logManualSubmission(assignmentId: string, studentId: string): Observable<any> {
    const url = `${this.apiUrl}/api/assignments/${assignmentId}/log-submission`;
    return this.http.post(url, { studentId });
  }

 gradeAssignment(assignmentId: string, studentId: string, grade: number, comments: string, submitted?: boolean): Observable<any> {
    const url = `${this.apiUrl}/api/assignments/${assignmentId}/grade`;
    return this.http.put(url, { studentId, grade, comments });
  }

  bulkGradeAssignment(assignmentId: string, grades: any[]): Observable<any> {
  const url = `${this.apiUrl}/api/assignments/${assignmentId}/bulk-grade`;
  return this.http.put(url, { grades });
}

  getTeacherAssignments(teacherId: string): Observable<any> {
      return this.http.get(`${this.apiUrl}/api/assignments/teacher/${teacherId}`);
  }

  getAssignmentDetails(assignmentId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/api/assignments/${assignmentId}/details`);
  }
} 