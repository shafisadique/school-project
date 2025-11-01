// AssignmentService (full corrected code)
// FIXED: Removed all manual headers (use interceptor). Added missing getStudentAssignments().
// Standardized URLs. Ensured no errors (e.g., safe defaults).

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
  // Enhanced fields from backend
  hasSubmitted?: boolean;
  submittedAt?: string;
  submittedFiles?: string[];
  submittedText?: string;
  grade?: number;
  comments?: string;
  isOverdue?: boolean;
  daysUntilDue?: number;
  className?: string;
  subjectName?: string;
  teacherName?: string;
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
    if (assignment.assignedTo && Array.isArray(assignment.assignedTo)) { // SAFE: Check array
      assignment.assignedTo.forEach((studentId, index) => {
        formData.append(`assignedTo[${index}]`, studentId);
      });
    }
    if (files && Array.isArray(files)) { // SAFE: Check array
      files.forEach((file) => {
        formData.append('attachments', file);
      });
    }

    const url = `${this.apiUrl}/api/assignments/create?teacherId=${encodeURIComponent(teacherId || '')}`; // SAFE: Default empty
    console.log(url);
    return this.http.post(url, formData); // REMOVED: Manual headers (interceptor handles)
  }

  logManualSubmission(assignmentId: string, studentId: string): Observable<any> {
    const url = `${this.apiUrl}/api/assignments/${assignmentId}/log-submission`;
    return this.http.post(url, { studentId }); // REMOVED: Manual headers
  }

  gradeAssignment(assignmentId: string, studentId: string, grade: number, comments: string, submitted?: boolean): Observable<any> {
    const url = `${this.apiUrl}/api/assignments/${assignmentId}/grade`;
    return this.http.put(url, { studentId, grade, comments }); // REMOVED: Manual headers
  }

  bulkGradeAssignment(assignmentId: string, grades: any[]): Observable<any> {
    const url = `${this.apiUrl}/api/assignments/${assignmentId}/bulk-grade`;
    return this.http.put(url, { grades }); // REMOVED: Manual headers
  }

  getTeacherAssignments(teacherId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/api/assignments/teacher/${teacherId}`); // REMOVED: Manual headers
  }

  getAssignmentDetails(assignmentId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/api/assignments/${assignmentId}/details`); // REMOVED: Manual headers
  }

  // ADDED: Missing getStudentAssignments method
  getStudentAssignments(): Observable<any> {
    const url = `${this.apiUrl}/api/assignments/student`;
    return this.http.get(url); // REMOVED: Manual headers
  }

  getStudentAssignmentDetails(assignmentId: string): Observable<any> {
    const url = `${this.apiUrl}/api/assignments/my-assignment/${assignmentId}`;
    return this.http.get(url); // REMOVED: Manual headers
  }
}