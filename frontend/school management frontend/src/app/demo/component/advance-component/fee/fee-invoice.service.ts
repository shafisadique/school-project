import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class FeeInvoiceService {
  apiUrl = environment.apiUrl
  constructor(private http:HttpClient) { }

  generateInvoice(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/fees/invoices`, data);
  }

  getUnpaidInvoices(studentId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/api/fees/invoices/unpaid/${studentId}`);
  }

  recordPayment(invoiceId: string, paymentData: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/fees/invoices/${invoiceId}/payments`, paymentData);
  }
  getStudentInvoices(studentId: string) {
    return this.http.get(`${this.apiUrl}/students/${studentId}/invoices`);
  }
// fee-invoice.service.ts
generateBulkInvoices(data: {
  schoolId: string;
  className: string;
  month: string;
  academicYearId: string;
  sections?: string[]; // Add this
}): Observable<any> {
  return this.http.post(`${this.apiUrl}/api/fees/bulk`, data);
}
getClassStructure(schoolId: string): Observable<any> {
  return this.http.get(`${this.apiUrl}/api/classes/${schoolId}`);
}

getClassStudents(schoolId: string, className: string): Observable<any> {
  return this.http.get(`${this.apiUrl}/api/classes/${schoolId}/${className}/students`);
}
}
