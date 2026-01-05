// src/app/services/report.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ReportService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  generateCustomReport(reportConfig: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/reports/custom`, reportConfig);
  }

  generateUDISE(template: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/api/reports/udise/${template}`);
  }

  exportReport(reportId: string, format: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/reports/export/${format}`, 
      { reportId }, { responseType: 'text' });
  }

  getSampleReports(): Observable<any> {
    return this.http.get(`${this.apiUrl}/api/reports/sample`);
  }
  // In src/app/services/report.service.ts (or wherever ReportService is)

}