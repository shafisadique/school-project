import { Component } from '@angular/core';
import { StudentService } from '../../students/student.service';
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
}

@Component({
  selector: 'app-generate-monthly-invoice',
  standalone: true,
  imports: [CommonModule, FormsModule],
  providers: [DatePipe],
  templateUrl: './generate-monthly-invoice.component.html',
})
export class GenerateMonthlyInvoiceComponent {
  students: Student[] = [];
  selectedStudent: Student | null = null;
  month = '';
  searchQuery = '';

  constructor(
    private studentService: StudentService,
    private feeInvoiceService: FeeInvoiceService,
    private toast: ToastrService,
    private datePipe: DatePipe,
    private authService: AuthService
  ) {}

  async searchStudents(query: string): Promise<void> {
    if (query.length < 3) return;
    const schoolId = this.authService.getSchoolId();
    if (!schoolId) {
      this.toast.error('School not found');
      return;
    }
    this.students = await this.studentService.searchStudents(schoolId, query).toPromise();
  }

  async selectStudent(student: Student): Promise<void> {
    this.selectedStudent = student;
    this.students = [];
  }

  async generateInvoice(): Promise<void> {
    if (!this.validate()) return;
    try {
      await this.feeInvoiceService.generateInvoice({
        studentId: this.selectedStudent!._id,
        month: this.month
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

  resetForm(): void {
    this.selectedStudent = null;
    this.month = '';
    this.students = [];
  }
}