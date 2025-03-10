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

  getStudent():Observable<any>{
    return this.http.get(`${this.apiUrl}/api/students/list`)
  }
  searchStudents(schoolId: string, query: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/api/students/search`, {
      params: { schoolId, query }
    });
  }
  
}
