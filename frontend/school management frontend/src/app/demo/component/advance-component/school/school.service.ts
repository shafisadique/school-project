import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SchoolService {
  private baseUrl = `${environment.apiUrl}/api/schools`;

  constructor(private http: HttpClient) {}

  getMySchool(): Observable<any> {
    const userId = localStorage.getItem('userId'); // Get user ID from local storage
    if (!userId) {
      throw new Error('User ID not found in local storage');
    }
    return this.http.get(`${this.baseUrl}/user/${userId}`);
  }

  // ✅ Update School
  updateSchool(schoolId: string, schoolData: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/update/${schoolId}`, schoolData);
  }

  // ✅ Set Academic Year
  setAcademicYear(schoolId: string, academicYear: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/${schoolId}/academic-year`, { academicYear });
  }

  // ✅ Upload School Logo
  uploadLogo(schoolId: string, file: File): Observable<any> {
    const formData = new FormData();
    formData.append('logo', file);
    return this.http.post(`${this.baseUrl}/${schoolId}/logo`, formData);
  }
}