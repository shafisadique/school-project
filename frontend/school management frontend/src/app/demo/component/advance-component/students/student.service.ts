import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class StudentService {
  apiUrl =environment.apiUrl
  constructor(private http:HttpClient) { }

  createStudent(formData: FormData): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/students/add`, formData);
  }
  getActiveAcademicYear(schoolId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/api/academicyear/active/${schoolId}`);
  }
  getStudent():Observable<any>{
    return this.http.get(`${this.apiUrl}/api/students/list`)
  }
  // student.service.ts
  searchStudents(schoolId: string, query: string): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/api/students/search/${query}`,
      // Remove schoolId from params since it comes from auth
    );
  }
  
}
