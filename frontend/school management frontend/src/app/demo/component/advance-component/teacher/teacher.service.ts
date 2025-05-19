import { HttpClient, HttpErrorResponse, HttpEvent, HttpEventType } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class TeacherService {
  private apiUrl = environment.apiUrl; // Base API URL from environment config

  constructor(private httpClient: HttpClient) {}

  /**
   * ✅ Create a new teacher with file upload support
   * @param formData FormData object containing teacher details and profile image
   * @returns Observable with upload progress and response
   */
  createTeacher(formData: FormData): Observable<any> {
    return this.httpClient.post(`${this.apiUrl}/api/teachers/add`, formData, {
      reportProgress: true,
      observe: 'events'
    }).pipe(
      catchError(this.handleError)
    );
  }
  

  /**
   * ✅ Get all teachers from the server
   * @returns Observable list of teachers
   */
  getTeachersBySchool(): Observable<any> {
    return this.httpClient.get(`${this.apiUrl}/api/teachers/list`).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * ✅ Get a single teacher by ID
   * @param teacherId Teacher's unique ID
   * @returns Observable with teacher data
   */
  getTeacherById(schoolId: string): Observable<any> {
    return this.httpClient.get(`${this.apiUrl}/api/teachers/${schoolId}`).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * ✅ Handle HTTP errors and provide user-friendly messages
   * @param error HttpErrorResponse from API
   * @returns Observable throwing user-friendly error message
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An unknown error occurred!';

    if (error.error instanceof ErrorEvent) {
      // ✅ Client-side or network error
      errorMessage = `Client Error: ${error.error.message}`;
    } else {
      // ✅ Backend error response
      errorMessage = `Server Error: ${error.status} - ${error.message}`;
    }

    console.error(errorMessage);
    return throwError(() => new Error(errorMessage));
  }
}
