import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class TimetableService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('No token found in localStorage');
    }
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  getTimetableBySchool(schoolId: string, academicYearId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/api/timetable/school/${schoolId}`, {
      headers: this.getHeaders(),
      params: { academicYearId }
    });
  }

  getCombinedAssignments(schoolId: string, academicYearId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/api/class-subject-management/assignments/${schoolId}`, {
      headers: this.getHeaders(),
      params: { academicYearId }
    });
  }
  
  getScheduleByTeacher(teacherId: string, academicYearId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/api/class-subject-management/assignments/teacher/${teacherId}`, {
      headers: this.getHeaders(),
      params: { academicYearId },
    });
  }

  createTimetable(timetable: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/timetable/create`, timetable, {
      headers: this.getHeaders()
    });
  }

  deleteTimetable(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/api/timetable/${id}`, {
      headers: this.getHeaders()
    });
  }

  getAcademicYears(schoolId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/api/academicyear/${schoolId}`, {
      headers: this.getHeaders()
    });
  }

  getActiveAcademicYear(schoolId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/api/academicyear/active/${schoolId}`, {
      headers: this.getHeaders()
    });
  }
}