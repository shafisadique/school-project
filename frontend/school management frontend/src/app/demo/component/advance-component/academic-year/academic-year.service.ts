import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { AcademicYear } from '../result/models/academic-year.model';

@Injectable({
  providedIn: 'root'
})
export class AcademicYearService {
  private baseUrl = `${environment.apiUrl}/api/academicyear`;

  constructor(private http: HttpClient) {}

  // Create academic year
  createAcademicYear(payload: { name: string; startDate: string; endDate: string; schoolId: string }): Observable<AcademicYear> {
    return this.http.post<AcademicYear>(`${this.baseUrl}/create`, payload);
  }

  // Get active academic year
  getActiveAcademicYear(schoolId: string): Observable<AcademicYear> {
    return this.http.get<AcademicYear>(`${this.baseUrl}/active/${schoolId}`);
  }

  // Get all academic years
  getAllAcademicYears(schoolId: string): Observable<AcademicYear[]> {
    return this.http.get<AcademicYear[]>(`${this.baseUrl}/${schoolId}`);
  }

  // Activate an academic year
  activateAcademicYear(academicYearId: string, schoolId: string): Observable<AcademicYear> {
    return this.http.post<AcademicYear>(`${this.baseUrl}/activate/${schoolId}`, { academicYearId });
  }

  // Set active academic year (alternative method, if needed)
  setActiveAcademicYear(schoolId: string, academicYearId: string): Observable<AcademicYear> {
    return this.http.post<AcademicYear>(`${this.baseUrl}/set`, { schoolId, academicYearId });
  }

  // Get the next academic year for promotion
  getNextAcademicYear(currentYearId: string, schoolId: string): Observable<AcademicYear> {
    return this.http.get<AcademicYear>(`${this.baseUrl}/next/${currentYearId}?schoolId=${schoolId}`);
  }
}