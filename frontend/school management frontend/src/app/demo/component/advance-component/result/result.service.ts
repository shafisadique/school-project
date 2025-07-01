import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { Result } from './models/result.model';

@Injectable({
  providedIn: 'root'
})
export class ResultService {
  private apiUrl = `${environment.apiUrl}/api/results`; // Should resolve to http://localhost:5000/api/results

  constructor(private http: HttpClient) {}

  createResult(result: Partial<Result>): Observable<Result> {
    return this.http.post<Result>(`${this.apiUrl}/create`, result);
  }
  
  getExamsByTeacher(): Observable<any> {
    return this.http.get(`http://localhost:5000/api/exams/teacher`);
  }
  getResultsByExam(examId: string): Observable<Result[]> {
    return this.http.get<Result[]>(`${this.apiUrl}/exam/${examId}`);
  }

  getResultsByStudent(studentId: string): Observable<Result[]> {
    return this.http.get<Result[]>(`${this.apiUrl}/student/${studentId}`);
  }
}