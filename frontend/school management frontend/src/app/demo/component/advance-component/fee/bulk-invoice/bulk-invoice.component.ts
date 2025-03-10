import { CommonModule, DatePipe } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { FeeInvoiceService } from '../fee-invoice.service';
import { AuthService } from 'src/app/theme/shared/service/auth.service';

@Component({
  selector: 'app-bulk-invoice',
  imports: [CommonModule,FormsModule],
  providers: [DatePipe],
  templateUrl: './bulk-invoice.component.html',
  styleUrl: './bulk-invoice.component.scss'
})
export class BulkInvoiceComponent {
  classList: string[] = ['Pre Nursery', 'Nursery', 'LKG', 'UKG', 'Class 1','Class 2','class 3','class 4'];
  sessions = ['2023-2024', '2024-2025', '2025-2026'];
  selectedClass = '';
  selectedSession = '';
  selectedMonth = '';
  isGenerating = false;
  result: any = null;

  constructor(
    private feeInvoiceService: FeeInvoiceService,
    private authService: AuthService,
    private datePipe: DatePipe
  ) {}

  get minMonth(): string {
    return this.datePipe.transform(new Date(), 'yyyy-MM') || '';
  }

  get maxMonth(): string {
    // const date = new Date();
    // date.setFullYear(date.getFullYear() + 1);
    // return this.datePipe.transform(date, 'yyyy-MM') || '';
    return '';
  }

  get sessionDates(): { [key: string]: { start: Date, end: Date } } {
    return {
      '2023-2024': { start: new Date('2023-04-01'), end: new Date('2024-03-31') },
      '2024-2025': { start: new Date('2024-04-01'), end: new Date('2025-03-31') }
    };
  }
  
  validateMonthInSession(): boolean {
    if (!this.selectedSession || !this.selectedMonth) return true;
    
    const [year, month] = this.selectedMonth.split('-').map(Number);
    const monthDate = new Date(year, month-1);
    const sessionRange = this.sessionDates[this.selectedSession];
  
    return monthDate >= sessionRange.start && 
           monthDate <= sessionRange.end;
  }

  async generateBulkInvoices() {
    this.isGenerating = true;
    this.result = null;

    try {
      const schoolId = this.authService.getSchoolId();
      if (!schoolId) throw new Error('School not found');

      const response = await this.feeInvoiceService.generateBulkInvoices({
        schoolId,
        className: this.selectedClass,
        session: this.selectedSession,
        month: this.selectedMonth
      }).toPromise();
      console.log(response)
      this.result = {
        success: true,
        totalStudents: response.insertedCount + response.existingInvoices,
        insertedCount: response.insertedCount,
        matchedCount: response.matchedCount
      };

    } catch (error) {
      this.result = {
        success: false,
        error: error.error?.message || 'Failed to generate invoices'
      };
    } finally {
      this.isGenerating = false;
    }
  }
}
