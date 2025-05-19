import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AttendanceService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  markAttendance(attendanceData: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/attendance/mark`, attendanceData);
  }

  getAttendanceHistory(classId: string, academicYearId: string): Observable<any> {
    // Include classId in the URL path
    return this.http.get(`${this.apiUrl}/api/attendance/history/${classId}?academicYearId=${academicYearId}`);
  }

  getStudentsByClass(classId: string): Observable<any> {
    const url = `${this.apiUrl}/api/attendance/students/${classId}`; // Removed the extra /attendance
    console.log('Calling getStudentsByClass with URL:', url); // Debug log
    return this.http.get(url);
  }
}