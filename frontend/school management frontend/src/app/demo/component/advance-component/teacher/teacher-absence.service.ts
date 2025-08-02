import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

export type AbsenceStatus = 'Pending' | 'Approved' | 'Rejected';

export interface TeacherAbsence {
  _id?: string;
  teacherId: string | { _id: string; name: string; email: string };
  date: string | Date;
  reason: string;
  substituteTeacherId?: string | { _id: string; name: string; email: string } | null;
  status: AbsenceStatus;
  schoolId: string;
  createdAt?:any
}

@Injectable({
  providedIn: 'root'
})
export class TeacherAbsenceService {
  private apiUrl = environment.apiUrl + '/api/teacher-absences';

  constructor(private http: HttpClient) {}

  getAbsences(params: { schoolId: string } & any): Observable<TeacherAbsence[]> {
    const { schoolId, ...queryParams } = params;
    return this.http.get<TeacherAbsence[]>(`${this.apiUrl}/list/${schoolId}`, { params: queryParams });
  }

  addAbsence(absence: TeacherAbsence): Observable<TeacherAbsence> {
    return this.http.post<TeacherAbsence>(`${this.apiUrl}/add`, absence);
  }

  updateAbsence(id: string, absence: Partial<TeacherAbsence>): Observable<TeacherAbsence> {
    return this.http.put<TeacherAbsence>(`${this.apiUrl}/update/${id}`, absence);
  }

  deleteAbsence(id: string, schoolId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/delete/${id}`, { body: { schoolId } });
  }

  checkHoliday(schoolId: string, date: string): Observable<any[]> {
    return this.http.get<any[]>(`${environment.apiUrl}/api/holidays/check/${schoolId}`, { params: { date } });
  }
  getPendingAbsences(schoolId: string, startDate?: string, endDate?: string, teacherId?: string): Observable<any> {
    let url = `${this.apiUrl}/pending?schoolId=${schoolId}`;
    if (startDate && endDate) {
      url += `&startDate=${startDate}&endDate=${endDate}`;
    }
    if (teacherId) {
      url += `&teacherId=${teacherId}`;
    }
    return this.http.get<any>(url);
  }
}