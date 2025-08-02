import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { Exam } from './exam.model';
import { AuthService } from 'src/app/theme/shared/service/auth.service'; // Assume this exists

@Injectable({
  providedIn: 'root'
})
export class ExamService {
  private baseUrl = `${environment.apiUrl}/api/exams`;

  constructor(private http: HttpClient, private authService: AuthService) {}

  createExam(exam: Partial<Exam>): Observable<Exam> {
    return this.http.post<Exam>(`${this.baseUrl}/create`, exam);
  }

  getExamsBySchool(schoolId: string, academicYearId?: string): Observable<Exam[]> {
    let url = `${this.baseUrl}/school/${schoolId}`;
    const activeAcademicYearId = academicYearId || this.authService.getActiveAcademicYearId(); // Default to active year
    if (activeAcademicYearId) {
      url += `?academicYearId=${activeAcademicYearId}`;
    } else {
      console.warn('No active academic year ID available. Fetching all exams for school.');
    }
    return this.http.get<Exam[]>(url);
  }

  getExamsByTeacher(classId?: string, academicYearId?: string): Observable<Exam[]> {
    let url = `${this.baseUrl}/teacher`;
    const params = new HttpParams()
      .set('academicYearId', academicYearId || this.authService.getActiveAcademicYearId() || '')
      .set('classId', classId || '');
    return this.http.get<Exam[]>(url, { params });
  }

  getExamsForResultEntry(): Observable<any> { // Adjust return type based on backend response
    return this.http.get<any>(`${this.baseUrl}/teacher/exams`);
  }

  deleteExam(examId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${examId}`);
  }

  getExamById(examId: string): Observable<Exam> {
    return this.http.get<Exam>(`${this.baseUrl}/${examId}`);
  }

  updateExam(examId: string, exam: Partial<Exam>): Observable<Exam> {
    return this.http.put<Exam>(`${this.baseUrl}/${examId}`, exam);
  }
}