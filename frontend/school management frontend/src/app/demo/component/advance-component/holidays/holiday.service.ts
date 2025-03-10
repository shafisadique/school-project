import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class HolidayService {
  private baseUrl = `${environment.apiUrl}/api/holidays`;

  constructor(private http: HttpClient) {}
  getHolidays(schoolId: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/${schoolId}`);
  }
}
