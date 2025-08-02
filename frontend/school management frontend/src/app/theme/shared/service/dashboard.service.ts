// src/app/services/dashboard.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private apiUrl = `${environment.apiUrl}/api/admin`;

  constructor(private http: HttpClient) {}

  getStudentAttendance(classId?: string): Observable<any> {
    let url = `${this.apiUrl}/student-attendance`;
    if (classId) {
      url += `?classId=${classId}`;
    }
    return this.http.get(url, { withCredentials: true }); // Ensure auth token is sent
  }
}