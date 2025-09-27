// src/app/theme/shared/service/report.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { ToastrService } from 'ngx-toastr';

export interface ReportFilter {
  classId?: string;
  status?: string;
  academicYearId?: string;
  dateFrom?: string;
  dateTo?: string;
  minimumDue?: number;
  subjectId?: string;
  examType?: string;
}

export interface CustomReportConfig {
  reportType: 'student' | 'fee-defaulters' | 'academic-performance' | 'attendance-summary' | 'teacher-performance';
  filters?: ReportFilter;
  columns: string[];
  reportName?: string;
  schoolId?: string;
}

export interface ReportResponse {
  success: boolean;
  data: {
    name: string;
    type: string;
    columns: string[];
    records: any[];
    totalRecords: number;
    generatedAt: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class ReportService {
  private apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private toastr: ToastrService
  ) {}

  // Generate custom report
  generateCustomReport(config: CustomReportConfig): Observable<ReportResponse> {
    return this.http.post<ReportResponse>(`${this.apiUrl}/api/reports/custom`, config).pipe(
      catchError(this.handleError.bind(this))
    );
  }

  // Generate UDISE report
  generateUDISEReport(template: 'enrollment' | 'teachers' | 'infrastructure'): Observable<ReportResponse> {
    return this.http.get<ReportResponse>(`${this.apiUrl}/api/reports/udise/${template}`).pipe(
      catchError(this.handleError.bind(this))
    );
  }

  // Export report as CSV
  exportReport(reportId: string, format: 'csv'): Observable<Blob> {
    return this.http.post(`${this.apiUrl}/api/reports/export/${format}`, { reportId }, { 
      responseType: 'blob',
      headers: { 'Accept': 'text/csv' }
    }).pipe(
      map(blob => new Blob([blob], { type: 'text/csv' })),
      catchError(this.handleError.bind(this))
    );
  }

  // Get available report types (for UI)
  getAvailableReports(): Observable<any> {
    return this.http.get(`${this.apiUrl}/api/reports/sample`).pipe(
      catchError(this.handleError.bind(this))
    );
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    console.error('Report service error:', error);
    let msg = 'An error occurred while generating report';
    
    if (error.status === 403) {
      msg = 'Access denied. Admin privileges required.';
    } else if (error.status === 400) {
      msg = error.error?.message || 'Invalid report configuration.';
    } else if (error.status === 500) {
      msg = 'Server error. Please try again.';
    }
    
    this.toastr.error(msg);
    return throwError(() => new Error(msg));
  }
}