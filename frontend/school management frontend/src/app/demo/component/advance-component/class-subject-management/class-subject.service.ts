import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ClassSubjectService {
  private apiUrl = environment.apiUrl ; // Adjust API base URL

  constructor(private http: HttpClient) {}

  // Create Class
  createClass(classData: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/class-subject-management/classes`, classData);
  }

  // Get All Classes by School
  getClasses(schoolId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/api/class-subject-management/classes/${schoolId}`);
  }

  // Create Subject
  createSubject(subjectData: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/class-subject-management/subjects`, subjectData);
  }

  // Get All Subjects by School
  getSubjects(schoolId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/api/class-subject-management/subjects/${schoolId}`);
  }

  getTeachers(schoolId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/api/class-subject-management/teachers/by-school/${schoolId}`);
  }
  
  // Assign Subject to Class with Teacher
  assignSubjectToClass(classId: string, subjectId: string, teacherId: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/api/class-subject-management/assign-subject`, 
      { classId, subjectId, teacherId }  // ✅ Send teacherId
    );
  }
 
  
}
