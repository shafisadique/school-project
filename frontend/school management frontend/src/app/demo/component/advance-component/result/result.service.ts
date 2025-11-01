import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { Result } from './models/result.model';

@Injectable({
  providedIn: 'root'
})
export class ResultService {
  private apiUrl = `${environment.apiUrl}/api/results`;

  constructor(private http: HttpClient) {}

  createResult(result: Partial<Result>): Observable<Result> {
    return this.http.post<Result>(`${this.apiUrl}/create`, result).pipe(
      catchError(this.handleError('createResult'))
    );
  }

  getResultById(resultId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/${resultId}`);
  }

  updatePartialResult(resultId: string, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/partial/${resultId}`, data);
  }

  getExamsByTeacher(): Observable<any> {
    return this.http.get<any>(`${environment.apiUrl}/api/exams/teacher`).pipe(
      catchError(this.handleError('getExamsByTeacher'))
    );
  }

  getResultsByExam(examId: string): Observable<Result[]> {
    return this.http.get<Result[]>(`${this.apiUrl}/exam/${examId}`).pipe(
      catchError(this.handleError('getResultsByExam'))
    );
  }

  getResultsByStudent(studentId: string): Observable<Result[]> {
    return this.http.get<Result[]>(`${this.apiUrl}/student/${studentId}`).pipe(
      catchError(this.handleError('getResultsByStudent'))
    );
  }

  getAllResultsForClass(classId: string, academicYearId: string, examId?: string): Observable<Result[]> {
    let url = `${this.apiUrl}/admin/class/${classId}?academicYearId=${academicYearId}`;
    if (examId) url += `&examId=${examId}`;
    return this.http.get<Result[]>(url).pipe(
      catchError(this.handleError('getAllResultsForClass'))
    );
  }

  createPartialResult(result: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/partial`, result).pipe(
      catchError(this.handleError('createPartialResult'))
    );
  }

  getPartialResults(studentId: string, examId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/partial?studentId=${studentId}&examId=${examId}`).pipe(
      catchError(this.handleError('getPartialResults'))
    );
  }

  getExamsForResultEntry(): Observable<any> {
    return this.http.get(`${this.apiUrl}/result-entry`);
  }

  private handleError(operation = 'operation'): (error: HttpErrorResponse) => Observable<never> {
    return (error: HttpErrorResponse): Observable<never> => {
      console.error(`${operation} failed:`, error); // Keep for debugging

      // FIXED: Do not wrap in new Error; re-throw the original HttpErrorResponse to preserve backend details
      // Component can now access error.error.error for specific messages like "Result already exists..."
      return throwError(() => error);
    };
  }
}