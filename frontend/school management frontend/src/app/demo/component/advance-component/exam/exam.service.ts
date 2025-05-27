import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { Exam } from './exam.model';

@Injectable({
  providedIn: 'root'
})
export class ExamService {
  private baseUrl = `${environment.apiUrl}/api/exams`;

  constructor(private http: HttpClient) {}

  createExam(exam: Partial<Exam>): Observable<Exam> {
    return this.http.post<Exam>(`${this.baseUrl}/create`, exam);
  }
 
  getExamsBySchool(schoolId: string, academicYearId?: string): Observable<Exam[]> {
    let url = `${this.baseUrl}/school/${schoolId}`;
    if (academicYearId) {
      url += `?academicYearId=${academicYearId}`;
    }
    return this.http.get<Exam[]>(url);
  }

  deleteExam(examId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${examId}`);
  }
}