// academic-year.service.ts
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AcademicYearService {
  private baseUrl = `${environment.apiUrl}/api/academicyear`;

  constructor(private http: HttpClient) {}

  // Create academic year
  createAcademicYear(payload: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/create`, payload);
  }

  // Get active academic year
  getActiveAcademicYear(schoolId: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/active/${schoolId}`);
  }

  // Get all academic years
  getAllAcademicYears(schoolId: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/${schoolId}`);
  }

  activateAcademicYear(academicYearId: string,schoolId:any): Observable<any> {
    return this.http.post(`${this.baseUrl}/activate/${schoolId}`, { academicYearId });
  }

  // Set active academic year
  setActiveAcademicYear(schoolId: string, academicYearId: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/set`, { 
      academicYearId
    });
  }
}