import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class FeeStructureService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  // Fetch all fee structures for a school
  getAllFeeStructuresForSchool(schoolId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/api/fees/get-fee-structure`, {
      params: { schoolId }
    });
  }

  // Fetch a specific fee structure for a school, class, and academic year
  getFeeStructureForClassAndYear(schoolId: string, className: string, academicYearId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/api/fees/get-fee-structure`, {
      params: { schoolId, className, academicYearId }
    });
  }

  createFeeStructure(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/fees/create-structure`, data);
  }

  updateFeeStructure(id: string, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/api/fees/structures/${id}`, data);
  }

  deleteFeeStructure(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/structures/${id}`);
  }

  generateMonthlyInvoice(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/fees/invoices`, data);
  }

  generateInvoice(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/fees/invoices`, data);
  }

  getUnpaidInvoices(studentId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/api/fees/invoices/unpaid/${studentId}`);
  }

  getFeeStructureForClass(schoolId: string, session: string, className: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/api/fees/get-fee-structure`, {
      params: { schoolId, session, className }
    });
  }
}