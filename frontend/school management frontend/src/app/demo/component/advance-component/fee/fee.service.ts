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

  // Get student's unpaid invoices
  getStudentInvoices(studentId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/api/fees/students/${studentId}/invoices`);
  }

  getSchoolDetails(schoolId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/schools/${schoolId}`)
  }
 
  getSchoolById(schoolId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/api/schools/${schoolId}`);
  }
  
  // Process payment
  processPayment(invoiceId: string, paymentData: any): Observable<any> {
  return this.http.post(
    `${this.apiUrl}/api/fees/invoices/${invoiceId}/pay`,
    paymentData
    );
  }
}
