  import { Injectable } from '@angular/core';
  import { HttpClient, HttpParams } from '@angular/common/http';
  import { Observable } from 'rxjs';
  import { environment } from 'src/environments/environment';
  import { AuthService } from 'src/app/theme/shared/service/auth.service';

  export interface Holiday {
    _id?: string;
    title: string;
    date: string;
    description?: string;
    schoolId: string;
  }

  @Injectable({
    providedIn: 'root'
  })
  export class HolidayService {
    private baseUrl = environment.apiUrl + '/api/holidays';

    constructor(
      private http: HttpClient,
      private authService: AuthService
    ) {}

    getHolidays(schoolId: string, params?: any): Observable<Holiday[]> {
      let httpParams = new HttpParams();
      if (params.startDate) httpParams = httpParams.set('startDate', params.startDate);
      if (params.endDate) httpParams = httpParams.set('endDate', params.endDate);
      return this.http.get<Holiday[]>(`${this.baseUrl}/list/${schoolId}`, { params: httpParams });
    }

    addHoliday(holiday: Holiday): Observable<Holiday> {
      return this.http.post<Holiday>(`${this.baseUrl}/add`, holiday);
    }

    updateHoliday(id: string, holiday: Holiday): Observable<Holiday> {
      return this.http.put<Holiday>(`${this.baseUrl}/update/${id}`, holiday);
    }

    deleteHoliday(id: string): Observable<any> {
      return this.http.delete(`${this.baseUrl}/delete/${id}`);
    }
  }