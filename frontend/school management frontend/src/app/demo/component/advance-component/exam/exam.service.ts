// src/app/services/exam.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Exam, Class, AcademicYear, Subject } from './exam.model';

@Injectable({
  providedIn: 'root'
})
export class ExamService {
  private apiUrl = 'http://localhost:3000/api/exams'; // Replace with your backend URL

  constructor(private http: HttpClient) {}

  createExam(exam: Exam): Observable<Exam> {
    return this.http.post<Exam>(`${this.apiUrl}/create`, exam);
  }

  getExamHistory(classId: string, academicYearId: string): Observable<Exam[]> {
    return this.http.get<Exam[]>(`${this.apiUrl}/history/${classId}?academicYearId=${academicYearId}`);
  }

  getClasses(): Observable<Class[]> {
    return this.http.get<Class[]>('http://localhost:3000/api/classes'); // Replace with your API
  }

  getAcademicYears(): Observable<AcademicYear[]> {
    return this.http.get<AcademicYear[]>('http://localhost:3000/api/academic-years'); // Replace with your API
  }

  getSubjects(): Observable<Subject[]> {
    return this.http.get<Subject[]>('http://localhost:3000/api/subjects'); // Replace with your API
  }
}