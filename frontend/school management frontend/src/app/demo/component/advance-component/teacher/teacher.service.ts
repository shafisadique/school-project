import { HttpClient, HttpErrorResponse, HttpEvent, HttpEventType, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface Teacher {
  _id: string;
  name: string;
  email: string;
  leaveBalance: number;
  schoolId: string;
  phone: string;
  designation: string;
  subjects: string[];
  gender: string;
  profileImage?: string;
  profileImageUrl?: string; // Added for proxy/full URL from backend
  userId?: { _id: string; username: string }; // Added for populated username
  status: boolean;
  academicYearId?: string; // Optional for filters
}

@Injectable({
  providedIn: 'root'
})
export class TeacherService {
  private apiUrl = environment.apiUrl; // Base API URL from environment config

  constructor(private httpClient: HttpClient) {}

  createTeacher(formData: FormData): Observable<HttpEvent<any>> {
    return this.httpClient.post(`${this.apiUrl}/api/teachers/add`, formData, {
      reportProgress: true,
      observe: 'events'
    }).pipe(catchError(this.handleError));
  }

  getTeachersBySchool(params?: any): Observable<any> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
          httpParams = httpParams.set(key, params[key].toString());
        }
      });
    }
    return this.httpClient.get(`${this.apiUrl}/api/teachers/list`, { params: httpParams }).pipe(
      catchError(this.handleError)
    );
  }

  // Deprecated: Use getTeachersBySchool() instead
  getTeachers(): Observable<{ data: Teacher[] }> {
    return this.getTeachersBySchool();
  }

  markAttendance(payload: {
    teacherId: string;
    schoolId: string;
    date: string;
    status: string;
    leaveType?: string;
    academicYearId: string;
    remarks?: string;
    lat: number;
    lng: number;
  }): Observable<any> {
    return this.httpClient.post(`${this.apiUrl}/api/teacher-attendance/mark`, payload).pipe(
      catchError(this.handleError)
    );
  }

  getTeacherById(teacherId: string): Observable<{ data: Teacher }> {
    return this.httpClient.get<{ data: Teacher }>(`${this.apiUrl}/api/teachers/${teacherId}`).pipe(
      catchError(this.handleError)
    );
  }

  updateTeacher(teacherId: string, formData: FormData): Observable<HttpEvent<any>> {
  return this.httpClient.put(`${this.apiUrl}/api/teachers/${teacherId}`, formData, {
    reportProgress: true,
    observe: 'events'
  }).pipe(catchError(this.handleError));
}

  softDeleteTeacher(teacherId: string): Observable<any> {
    return this.httpClient.delete(`${this.apiUrl}/api/teachers/${teacherId}`).pipe(
      catchError(this.handleError)
    );
  }

  // Deprecated: Use softDeleteTeacher() instead
  deleteTeacher(teacherId: string): Observable<any> {
    return this.softDeleteTeacher(teacherId);
  }

  downloadTeachersExcel(): Observable<Blob> {
    return this.httpClient.get(`${this.apiUrl}/api/teachers/export`, {
      responseType: 'blob'
    }).pipe(catchError(this.handleError));
  }

  uploadTeacherPhoto(teacherId: string, formData: FormData): Observable<any> {
    return this.httpClient.put(`${this.apiUrl}/api/teachers/${teacherId}/photo`, formData).pipe(
      catchError(this.handleError)
    );
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An unknown error occurred!';
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Client Error: ${error.error.message}`;
    } else {
      // Server-side error
      errorMessage = `Server Error: ${error.status} - ${error.error?.message || error.message}`;
    }
    console.error('TeacherService Error:', errorMessage);
    return throwError(() => new Error(errorMessage));
  }

  // Simple alias for getTeacherById
  getTeacher(teacherId: string): Observable<{ data: Teacher }> {
    return this.getTeacherById(teacherId);
  }
 createPortal(teacherId: string, role: 'teacher'): Observable<any> {
    const payload = { role };
    return this.httpClient.post(`${this.apiUrl}/api/teachers/${teacherId}/portal`, payload).pipe(
      catchError(this.handleError)
    );
  } 
}