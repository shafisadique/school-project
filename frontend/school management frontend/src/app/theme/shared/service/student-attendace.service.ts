import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface AttendanceSummary {
  present: number;
  absent: number;
  percentage:number;
  late: number;
  totalDays: number;
}

export interface AttendanceReportResponse {
  success: boolean;
  data: {
    summary: AttendanceSummary;
    
    dailyData: any;
    view: 'weekly' | 'monthly';
  };
}

@Injectable({
  providedIn: 'root'
})
export class StudentAttendaceService {
private apiUrl = `${environment.apiUrl}`;

  constructor(private http: HttpClient) {}

  getStudentReport(academicYearId: string, view: 'weekly' | 'monthly' = 'weekly'): Observable<AttendanceReportResponse> {
    return this.http.get<AttendanceReportResponse>(`${this.apiUrl}/api/attendance/student-report`, {
      params: { academicYearId, view }
    });
  }
}