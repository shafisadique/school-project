import { Component, OnInit } from '@angular/core';
import { FeeService } from '../fee.service';
import { CommonModule } from '@angular/common';
import { CardComponent } from 'src/app/theme/shared/components/card/card.component';
import { ClassSubjectService } from '../../class-subject-management/class-subject.service';
import { AuthService } from 'src/app/theme/shared/service/auth.service';

@Component({
  selector: 'app-paid-invoice-list',
  standalone: true,
  imports: [CommonModule, CardComponent],
  templateUrl: './paid-invoice-list.component.html',
  styleUrls: ['./paid-invoice-list.component.scss']
})
export class PaidInvoiceListComponent implements OnInit {
  invoices: any[] = [];
  isLoading: boolean = true;
  errorMessage: string = '';
  selectedClass: string = '';
  classes: string[] = [];
  selectedMonth: string = '';
  months: string[] = ['May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March']; // 2024-25 months

  constructor(
    private feeService: FeeService,
    private classSubjectService: ClassSubjectService,
    private authService: AuthService
  ) {}

 ngOnInit(): void {
    const schoolId = this.authService.getSchoolId();
    if (!schoolId) {
      this.errorMessage = 'School ID not available. Please log in again.';
      this.isLoading = false;
      return;
    }
    this.loadClasses(schoolId);
  }

  loadPaidInvoices(): void {
    this.isLoading = true;
    if (!this.selectedClass || !this.selectedMonth) {
      this.errorMessage = 'Please select a class and month.';
      this.isLoading = false;
      return;
    }
    const academicYearId = this.authService.getActiveAcademicYearId() || '';
    this.feeService.getInvoicesByClassAndMonth(this.selectedClass, this.selectedMonth, academicYearId).subscribe({
      next: (res) => {
        this.invoices = res.data || [];
        this.isLoading = false;
        // Transform invoices to include payment details per month
        this.invoices = this.invoices.map(invoice => ({
          ...invoice,
          paymentDetailsByMonth: this.groupPaymentsByMonth(invoice.paymentHistory || [])
        }));
      },
      error: (err) => {
        this.errorMessage = err.error?.message || 'Failed to load paid invoices.';
        this.isLoading = false;
      }
    });
  }

  onClassChange(event: any): void {
    this.selectedClass = event.target.value;
    this.loadPaidInvoices();
  }

  onMonthChange(event: any): void {
    this.selectedMonth = event.target.value;
    this.loadPaidInvoices();
  }

  groupPaymentsByMonth(paymentHistory: any[]): { [key: string]: { receiptNo: string, date: string, amount: number } } {
    const grouped = {};
    paymentHistory.forEach(p => {
      const month = new Date(p.date).toLocaleString('default', { month: 'long' });
      grouped[month] = {
        receiptNo: p.transactionId || 'N/A',
        date: p.date ? new Date(p.date).toLocaleDateString() : 'N/A',
        amount: p.amount || 0
      };
    });
    return grouped;
  }

  getPaymentForMonth(invoice: any, month: string): { receiptNo: string, date: string, amount: number } {
    return invoice.paymentDetailsByMonth[month] || { receiptNo: 'N/A', date: 'N/A', amount: 0 };
  }
    loadClasses(schoolId: string): void {
    this.classSubjectService.getClassesBySchool(schoolId).subscribe({
      next: (classes) => {
        this.classes = classes.map((c: any) => c.name);
        if (this.classes.length === 0) {
          this.errorMessage = 'No classes found for this school.';
        }
        this.isLoading = false;
      },
      error: (err) => {
        this.errorMessage = err.error?.message || 'Failed to load classes.';
        this.isLoading = false;
      }
    });
  }
}