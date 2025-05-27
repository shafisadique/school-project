import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { PromotionRule } from '../result/models/promotion-rule.model';

@Injectable({
  providedIn: 'root'
})
export class PromotionService {
  private baseUrl = `${environment.apiUrl}/api/promotions`;

  constructor(private http: HttpClient) {}

  // Get promotion rules for a specific class and academic year
  getPromotionRules(classId: string, academicYearId: string): Observable<PromotionRule> {
    return this.http.get<PromotionRule>(`${this.baseUrl}/rules?classId=${classId}&academicYearId=${academicYearId}`);
  }

  // Promote students to the next class in the next academic year
  promoteStudents(classId: string, academicYearId: string, nextAcademicYearId: string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/promote`, { classId, academicYearId, nextAcademicYearId });
  }

  // Create or update promotion rules
  savePromotionRule(rule: PromotionRule): Observable<PromotionRule> {
    if (rule._id) {
      return this.http.put<PromotionRule>(`${this.baseUrl}/rules/${rule._id}`, rule);
    }
    return this.http.post<PromotionRule>(`${this.baseUrl}/rules`, rule);
  }
}