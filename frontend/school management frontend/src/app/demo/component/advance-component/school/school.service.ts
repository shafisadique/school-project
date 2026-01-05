import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { Observable } from 'rxjs';
import { AuthService } from 'src/app/theme/shared/service/auth.service';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SchoolService {
  private baseUrl = `${environment.apiUrl}/api/schools`;

  constructor(private http: HttpClient, private authService: AuthService,private toastr:ToastrService) {}

  getMySchool(): Observable<any> {
    const userId = this.authService.getUserId();
    if (!userId) {
      throw new Error('User ID not found');
    }
    return this.http.get(`${this.baseUrl}/user/${userId}`);
  }
  
  getMySchoolForTeacher(): Observable<any> {
    return this.http.get(`${environment.apiUrl}/api/schools/my-school`); // ← NEW ENDPOINT
  }
  
  loadWeeklyHolidayDay(schoolId: string): Observable<string> {
    return this.http.get<string>(`${this.baseUrl}/teacher/${schoolId}`, { responseType: 'text' as 'json' });
  }

  updateSchool(schoolId: string, schoolData: any): Observable<any> {
    return this.http.put(`${this.baseUrl}/update/${schoolId}`, schoolData);
  }

  setAcademicYear(schoolId: string, academicYear: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/${schoolId}/academic-year`, { academicYear });
  }

  uploadLogo(schoolId: string, file: File): Observable<any> {
    const formData = new FormData();
    formData.append('logo', file);
    return this.http.post(`${this.baseUrl}/${schoolId}/logo`, formData);
  }
  getSchoolById(schoolId: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/${schoolId}`);
  }
}