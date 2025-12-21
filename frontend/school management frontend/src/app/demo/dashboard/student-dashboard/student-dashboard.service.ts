// services/student-dashboard.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { StudentDashboardData } from './student-dashboard.model';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class StudentDashboardService {
    private apiUrl = environment.apiUrl;


  constructor(private http: HttpClient) {}

  getDashboardData(): Observable<{ success: boolean; data: StudentDashboardData }> {
    const url = `${this.apiUrl}/api/student-dashboard/dashboard`;
    return this.http.get<{ success: boolean; data: StudentDashboardData }>(url);
  }
  
}