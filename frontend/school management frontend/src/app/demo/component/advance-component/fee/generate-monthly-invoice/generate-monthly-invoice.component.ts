import { Component } from '@angular/core';
import { StudentService } from '../../students/student.service';
import { FeeStructureService } from '../fee-structure.service';
import { FeeInvoiceService } from '../fee-invoice.service';
import { AuthService } from 'src/app/theme/shared/service/auth.service';
import { ToastrService } from 'ngx-toastr';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Student {
  _id: string;
  name: string;
  admissionNo: string;
  className: string;
  currentSession: string;
  usesTransport: boolean;
  usesHostel: boolean;
}

interface FeeStructure {
  baseFee: number;
  feeBreakdown: {
    tuitionFee: number;
    examFee: number;
    transportFee: number;
    hostelFee: number;
    miscFee: number;
  };
}

@Component({
  selector: 'app-generate-monthly-invoice',
  imports:[CommonModule,FormsModule],
  providers: [DatePipe],
  templateUrl: './generate-monthly-invoice.component.html',
})
export class GenerateMonthlyInvoiceComponent {
  students: Student[] = [];
  selectedStudent: Student | null = null;
  feeStructure: FeeStructure | null = null;
  customFees = { transportFee: 0, hostelFee: 0, miscFee: 0 };
  month = '';
  previousDue = 0;
  searchQuery:any;
  constructor(
    private studentService: StudentService,
    private feeInvoiceService: FeeInvoiceService,
    private feeStructureService: FeeStructureService,
    private toast: ToastrService,
    private datePipe: DatePipe,
    private authService: AuthService
  ) {}

  async searchStudents(query: string): Promise<void> {
    if (query.length < 3) return;
    
    try {
      const schoolId = this.authService.getSchoolId();
      if (!schoolId) throw new Error('School not found');
      
      this.students = await this.studentService.searchStudents(schoolId, query).toPromise();
    } catch {
      this.toast.error('Error searching students');
      this.students = [];
    }
  }

  async selectStudent(student: Student): Promise<void> {
    this.selectedStudent = student;
    await this.loadFeeStructure();
    await this.loadPreviousDue();
  }

  private async loadFeeStructure(): Promise<void> {
    if (!this.selectedStudent) return;

    try {
        const schoolId = this.authService.getSchoolId();
        if (!schoolId) return;

        const feeStructures = await this.feeStructureService
            .getFeeStructureForClass(
                schoolId,
                this.selectedStudent.currentSession,
                this.selectedStudent.className
            )
            .toPromise();

        // Ensure we get the correct fee structure for the student's class
        this.feeStructure = feeStructures.find(fee => fee.className === this.selectedStudent.className) || null;
        
        if (!this.feeStructure) {
            this.toast.error('No fee structure found for the selected class');
        }
    } catch {
        this.toast.error('Failed to load fee structure');
    }
}


  private async loadPreviousDue(): Promise<void> {
    if (!this.selectedStudent) return;

    try {
      const invoices = await this.feeInvoiceService
        .getUnpaidInvoices(this.selectedStudent._id)
        .toPromise();

      this.previousDue = invoices.reduce((sum: number, invoice: any) => 
        sum + invoice.remainingDue, 0);
    } catch {
      this.previousDue = 0;
    }
  }

  async generateInvoice(): Promise<void> {
    if (!this.validate()) return;

    try {
      await this.feeInvoiceService.generateInvoice({
        studentId: this.selectedStudent!._id,
        month: this.month,
        customFees: this.customFees,
        previousDue: this.previousDue
      }).toPromise();

      this.toast.success('Invoice generated successfully');
      this.resetForm();
    } catch {
      this.toast.error('Failed to generate invoice');
    }
  }

  private validate(): boolean {
    if (!this.selectedStudent) {
      this.toast.error('Please select a student');
      return false;
    }
    if (!this.month) {
      this.toast.error('Please select a month');
      return false;
    }
    return true;
  }

  get minMonth(): string {
    return this.datePipe.transform(new Date(), 'yyyy-MM') || '';
  }

  get maxMonth(): string {
    const date = new Date();
    date.setFullYear(date.getFullYear() + 1);
    return this.datePipe.transform(date, 'yyyy-MM') || '';
  }

  calculateTotal(): number {
    if (!this.feeStructure) return 0;
    return this.feeStructure.baseFee +
           this.feeStructure.feeBreakdown.tuitionFee +
           this.feeStructure.feeBreakdown.examFee +
           Object.values(this.customFees).reduce((a, b) => a + b, 0) +
           this.previousDue;
  }

  resetForm(): void {
    this.selectedStudent = null;
    this.feeStructure = null;
    this.month = '';
    this.customFees = { transportFee: 0, hostelFee: 0, miscFee: 0 };
    this.previousDue = 0;
    this.students = [];
  }
}