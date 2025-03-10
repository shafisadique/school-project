import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class FeeReceiptService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  generateClassReceipts(data: {
    schoolId: string;
    className: string;
    session: string;
    month: string;
  }): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/fees/receipts`, data, {
      responseType: 'blob'
    });
  }
}
