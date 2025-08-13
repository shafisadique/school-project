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
   editAttendance(data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/api/attendance/edit/${data.attendanceId}`, data);
  }

 getAttendanceHistory(classId: string, academicYearId: string, dateRange?: { startDate: string; endDate: string }): Observable<any[]> {
    let url = `${this.apiUrl}/api/attendance/history/${classId}?academicYearId=${academicYearId}`;
    if (dateRange) {
      url += `&startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`;
    }
    console.log('Attendance History URL:', url); // Debug
    return this.http.get<any[]>(url);
  }

  getStudentsByClass(classId: string): Observable<any> {
    const url = `${this.apiUrl}/api/attendance/students/${classId}`; // Removed the extra /attendance
    console.log('Calling getStudentsByClass with URL:', url); // Debug log
    return this.http.get(url);
  }
}