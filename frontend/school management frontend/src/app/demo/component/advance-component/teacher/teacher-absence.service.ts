import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

export type AbsenceStatus = 'Pending' | 'Approved' | 'Rejected';

export interface TeacherAbsence {
  _id?: string;
  teacherId: { _id: string; name: string; email: string } | any;
  date: string | Date;
  reason: string;
  substituteTeacherId?: { _id: string; name: string; email: string } | string | null;
  status: AbsenceStatus;
  schoolId: string;
  createdAt?: Date;
  isTeacherApplied: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class TeacherAbsenceService {
  private apiUrl = environment.apiUrl + '/api/teacher-absences';

  constructor(private http: HttpClient) {}

  getAbsences(params: { schoolId: string } & any): Observable<{ data: TeacherAbsence[] }> {
    const { schoolId, ...queryParams } = params;
    return this.http.get<{ data: TeacherAbsence[] }>(`${this.apiUrl}/list/${schoolId}`, { params: queryParams });
  }

  addAbsence(absence: TeacherAbsence): Observable<{ data: TeacherAbsence }> {
    return this.http.post<{ data: TeacherAbsence }>(`${this.apiUrl}/add`, absence);
  }

  updateAbsence(id: string, absence: Partial<TeacherAbsence>): Observable<{ data: TeacherAbsence }> {
    return this.http.put<{ data: TeacherAbsence }>(`${this.apiUrl}/update/${id}`, absence);
  }

  deleteAbsence(id: string, schoolId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/delete/${id}`, { body: { schoolId } });
  }

  checkHoliday(schoolId: string, date: string): Observable<any[]> {
    return this.http.get<any[]>(`${environment.apiUrl}/api/holidays/check/${schoolId}`, { params: { date } });
  }

  getPendingAbsences(schoolId: string, startDate?: string, endDate?: string, teacherId?: string): Observable<{ data: TeacherAbsence[] }> {
    let params: any = { schoolId };
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    if (teacherId) params.teacherId = teacherId;
    return this.http.get<{ data: TeacherAbsence[] }>(`${this.apiUrl}/pending-applications`, { params });
  }

  getPendingAutoAbsences(schoolId: string, startDate?: string, endDate?: string, teacherId?: string): Observable<{ data: TeacherAbsence[] }> {
    let params: any = { schoolId };
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    if (teacherId) params.teacherId = teacherId;
    return this.http.get<{ data: TeacherAbsence[] }>(`${this.apiUrl}/pending-auto-absences`, { params });
  }
}