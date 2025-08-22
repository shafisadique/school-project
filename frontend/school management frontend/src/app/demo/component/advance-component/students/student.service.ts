import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class StudentService {
  apiUrl = environment.apiUrl;
  constructor(private http: HttpClient) { }

  createStudent(formData: FormData): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/students/add`, formData);
  }

  getActiveAcademicYear(schoolId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/api/academicyear/active/${schoolId}`);
  }

  getStudentById(studentId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/api/students/${studentId}`);
  }

  uploadStudentPhoto(studentId: string, formData: FormData): Observable<any> {
    return this.http.put(`${this.apiUrl}/${studentId}/photo`, formData);
  }
  
  updateStudent(studentId: string, updateData: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/api/students/${studentId}`, updateData);
  }

  getStudents(params: any = {}): Observable<any> {
    return this.http.get(`${this.apiUrl}/api/students/list`, { params });
  }

  searchStudents(schoolId: string, query: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/api/students/search/${query}`);
  }

  getStudentsByClass(classId: string, academicYearId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/api/students/get-student-by-class/${classId}`, {
      params: { academicYearId }
    });
  }

  createPortal(studentId: string, role: 'student' | 'parent'): Observable<any> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    const body = { studentId, role };
    return this.http.post(`${this.apiUrl}/api/students/create-portal`, body, { headers });
  }
  

  fetchStudentsByClassForInvoices(classId: string, academicYearId: string): Observable<any[]> {
    return this.http.get(`${this.apiUrl}/api/students/get-student-by-class/${classId}`, {
      params: { academicYearId }
    }).pipe(
      map((response: any) => response.students || [])
    );
  }
  
  promoteStudents(promotionData: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/students/promote`, promotionData);
  }

  getResultsByClassAndAcademicYear(classId: string, academicYearId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/api/results/class/${classId}`, {
      params: { academicYearId }
    });
  }
}