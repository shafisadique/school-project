import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class FeeService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  getFeeStructures(schoolId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/api/fees/structures`, { params: { schoolId } });
  }

  createFeeStructure(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/fees/structures`, data);
  }

  updateFeeStructure(id: string, data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/api/fees/structures/${id}`, data);
  }

  deleteFeeStructure(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/api/fees/structures/${id}`);
  }

  generateInvoices(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/fees/generate`, data);
  }

  getInvoicesByClassAndMonth(classId: string, month: string, academicYearId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/api/fees/invoices/class/${classId}/month/${month}`, { params: { academicYearId } });
  }

  getStudentFeeSummary(studentId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/api/fees/students/${studentId}/summary`);
  }

  getInvoiceById(invoiceId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/api/fee/invoices/${invoiceId}`);
  }

  processPayment(invoiceId: string, paymentData: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/fee/invoices/${invoiceId}/payments`, paymentData);
  }

  downloadInvoicePDF(invoiceId: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/api/fees/invoices/${invoiceId}/pdf`, { responseType: 'blob' });
  }

  generateClassReceipts(data: any): Observable<Blob> {
    return this.http.post(`${this.apiUrl}/api/fees/receipts`, data, { responseType: 'blob' });
  }

  notifyParents(classId: string, month: string, academicYearId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/fees/notify-parents`, { classId, month, academicYearId });
  }
}