import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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

  getStudentInvoices(studentId: string, academicYearId?: string): Observable<any> {
    const params: any = {};
    if (academicYearId) {
      params.academicYearId = academicYearId;
    }
    return this.http.get(`${this.apiUrl}/api/fees/invoices/student/${studentId}`, { params });
  }

    searchInvoiceStudents(query: string, schoolId: string) {
    return this.http.get<any>(`${this.apiUrl}/api/fees/search`, {
      params: { q: query, schoolId }
    });
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

  getStudentFeeSummary(studentId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/api/fees/students/${studentId}/summary`);
  }

  getInvoiceById(invoiceId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/api/fees/invoices/${invoiceId}`);
  }

  generateAdvanceInvoices(data: any): Observable<any> {
  return this.http.post(`${this.apiUrl}/api/fees/invoices/advance`, data);
}

//  processPayment(invoiceId: string, paymentData: any): Observable<any> {
//   return this.http.post(`${this.apiUrl}/api/fees/invoices/${invoiceId}/payments`, paymentData);
// }
  processPayment(studentId: string, paymentData: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/fees/students/${studentId}/payments`, paymentData);
  }

  getFeeCollectionReport(params: any): Observable<any> {
  return this.http.get(`${this.apiUrl}/api/fees/reports/collection-details`, { 
    params 
    });
  }

  generateClassReceipts(data: any): Observable<Blob> {
    return this.http.post(`${this.apiUrl}/api/fees/receipts`, data, { responseType: 'blob' });
  }

  // fee.service.ts
    getPaidInvoiceList(params: any): Observable<any> {
      return this.http.get(`${this.apiUrl}/api/fees/paid-invoices`, { params });
    }
  // Fixed the endpoint to match the backend route
  // getInvoicesByClassAndMonth(classId: string, month: string, academicYearId: string): Observable<any> {
  //   return this.http.get(`${this.apiUrl}/api/fees/invoices/class/${classId}/month/${month}`, {
  //     params: { academicYearId }
  //   });
  // }

    // fee.service.ts
  getInvoicesByClassAndMonth(classId: string, month: string, academicYearId: string) {
    return this.http.get<any>(`${this.apiUrl}/api/fees/invoices`, {
      params: { classId, month, academicYearId }
    });
  }
  getStudentPaymentHistory(studentId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/api/fees/students/${studentId}/payment-history`);
  }
    downloadInvoicePDF(invoiceId: string): Observable<Blob> {
      return this.http.get(`${this.apiUrl}/api/fees/invoices/${invoiceId}/pdf`, {
        responseType: 'blob'
      });
    }

    
    downloadReceiptPDF(receiptId: string): Observable<Blob> {
      return this.http.get(`${this.apiUrl}/api/fees/receipts/${receiptId}/pdf`, {
        responseType: 'blob'
      });
    }


  notifyParents(classId: string, month: string, academicYearId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/fees/notify-parents`, { classId, month, academicYearId }); // Fixed this to match backend
  }
}