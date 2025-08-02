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
    console.log('Fetching school for userId:', userId);
    if (!userId) {
      throw new Error('User ID not found');
    }
    return this.http.get(`${this.baseUrl}/user/${userId}`);
  }

  loadWeeklyHolidayDay(schoolId: string): Observable<string> {
    return new Observable(observer => {
      this.getSchoolById(schoolId).subscribe(
        (response: any) => {
          const weeklyHolidayDay = response.weeklyHolidayDay || 'Sunday';
          observer.next(weeklyHolidayDay);
          observer.complete();
        },
        (error) => {
          const errorMessage = error.message || 'Error loading school holiday day';
          this.toastr.error(errorMessage);
          observer.error(error);
        }
      );
    });
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