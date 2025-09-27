  import { HttpClient, HttpErrorResponse, HttpEvent, HttpEventType } from '@angular/common/http';
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
    status: boolean;
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

    getTeachersBySchool(): Observable<{ data: Teacher[] }> {
      return this.httpClient.get<{ data: Teacher[] }>(`${this.apiUrl}/api/teachers/list`).pipe(
        catchError(this.handleError)
      );
    }

    getTeachers(): Observable<{ data: Teacher[] }> {
      return this.httpClient.get<{ data: Teacher[] }>(`${this.apiUrl}/api/teachers/list`).pipe(
        catchError(this.handleError)
      );
    }

   markAttendance(payload: {
  teacherId: string;
  schoolId: string;
  date: string;
  status: string;
  leaveType?: string;
  academicYearId: string;
  remarks?: string;
  lat: number;  // Added
  lng: number;  // Added
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

    deleteTeacher(teacherId: string): Observable<any> {
      return this.httpClient.delete(`${this.apiUrl}/api/teachers/${teacherId}`).pipe(
        catchError(this.handleError)
      );
    }

    private handleError(error: HttpErrorResponse): Observable<never> {
      let errorMessage = 'An unknown error occurred!';
      if (error.error instanceof ErrorEvent) {
        errorMessage = `Client Error: ${error.error}`;
      } else {
        errorMessage = `Server Error: ${error.status} - ${error.error?.error || error.message}`;
      }
      console.error(errorMessage);
      return throwError(() => new Error(errorMessage));
    }

    getTeacher(teacherId: string): Observable<{ data: Teacher }> {
      return this.httpClient.get<{ data: Teacher }>(`${this.apiUrl}/api/teachers/${teacherId}`).pipe(catchError(this.handleError));
    }
  }