import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SubscriptionService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getSchools(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/api/schools/all`);
  }

  updateSubscription(schoolId: string, planType: string, expiresAt?: string): Observable<any> {
    const body = { schoolId, planType, expiresAt: expiresAt || undefined };
    return this.http.post(`${this.apiUrl}/api/auth/subscription/update`, body);
  }
}