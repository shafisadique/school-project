import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private apiUrl = `${environment.apiUrl}/api/admin`;
  private baseUrl = `${environment.apiUrl}/api/subscriptions`;

  constructor(private http: HttpClient) {}

  getSubscription(): Observable<any> {
    return this.http.get(`${this.baseUrl}/current`, { withCredentials: true });
  }
  
  getDashboardStats(): Observable<any> {
  return this.http.get(`${this.apiUrl}/stats`, { withCredentials: true });
  }

  upgradeSubscription(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/upgrade`, data, { withCredentials: true });
  }

  getPlans(): Observable<any> {
    return this.http.get(`${this.baseUrl}/plans`);
  }

  verifyPayment(data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/subscriptions/verify`, data, { withCredentials: true });
  }

  uploadPaymentProof(subscriptionId: string, file: File): Observable<any> {
    const formData = new FormData();
    formData.append('paymentProof', file);
    return this.http.post(`${this.baseUrl}/subscriptions/upload-proof`, formData, { withCredentials: true });
  }


  getStudentAttendance(params: { classId?: string; academicYearId?: string; period?: string; month?: string }): Observable<any> {
    let url = `${this.apiUrl}/student-attendance`;
    let queryParams = new HttpParams()
      .set('classId', params.classId || '')
      .set('academicYearId', params.academicYearId || '')
      .set('period', params.period || 'weekly') // Default to 'weekly' if not provided
      .set('month', params.month || ''); // Optional, only set if provided

    return this.http.get<any>(url, { params: queryParams, withCredentials: true });
  }

  getTeacherData(): Observable<any> {
    return this.http.get(`${this.apiUrl}/teacher-dashboard`, { withCredentials: true });
  }
  getTeacherDashboard():Observable<any>{
    return this.http.get(`${environment.apiUrl}/api/dashboard/teacher-dashboard`)
  }

  getFeeDashboard(params: { month?: string; classId?: string; academicYearId: string }): Observable<any> {
    let queryParams = new HttpParams();
    if (params.month) {
      queryParams = queryParams.set('month', params.month);
    }
    if (params.classId) {
      queryParams = queryParams.set('classId', params.classId);
    }
    if (params.academicYearId) {
      queryParams = queryParams.set('academicYearId', params.academicYearId);
    }
    return this.http.get(`${this.apiUrl}/fee-dashboard`, { params: queryParams, withCredentials: true });
  }
}