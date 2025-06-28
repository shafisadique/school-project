import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { AuthService } from 'src/app/theme/shared/service/auth.service';

@Injectable({
  providedIn: 'root'
})
export class RouteService {
  private baseUrl = `${environment.apiUrl}/api/routes`;
  private schoolId: string | null = null;

  constructor(private http: HttpClient, private authService: AuthService) {
    this.schoolId = this.authService.getUserSchoolId();
  }

  // Create a new route
  createRoute(payload: { name: string; pickupPoints: string[]; distance: number; feeAmount: number; frequency: string }): Observable<any> {
    return this.http.post(`${this.baseUrl}`, { ...payload, schoolId: this.schoolId });
  }

  // Get all routes for the user's school
  getRoutes(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}`, { params: { schoolId: this.schoolId || '' } });
  }

  // Get a specific route
  getRoute(id: string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/${id}`);
  }

  // Update a route
  updateRoute(id: string, payload: { name?: string; pickupPoints?: string[]; distance?: number; feeAmount?: number; frequency?: string; status?: boolean }): Observable<any> {
    return this.http.put(`${this.baseUrl}/${id}`, payload);
  }

  // Delete a route
  deleteRoute(id: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/${id}`);
  }

  // Assign a route to a student
  assignRoute(studentId: string, routeId: string | null): Observable<any> {
    return this.http.post(`${this.baseUrl}/assign/${studentId}`, { routeId });
  }
}