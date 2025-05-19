import { Component, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { FeeService } from '../fee.service';
import { StudentService } from '../../students/student.service';
import { AuthService } from 'src/app/theme/shared/service/auth.service';

@Component({
  selector: 'app-fee-payment',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './fee-payment.component.html',
  styleUrls: ['./fee-payment.component.scss']
})
export class FeePaymentComponent {
  private fb = inject(FormBuilder);
  private feeService = inject(FeeService);
  private studentService = inject(StudentService);
  private authService = inject(AuthService);
  private toastr = inject(ToastrService);
  selectedInvoice: any = null;

  students: any[] = [];
  selectedStudent: any = null;
  invoices: any[] = [];
  processingPayment = false;

  paymentForm = this.fb.group({
    amount: [null, [Validators.required, Validators.min(0.01)]],
    method: ['Cash', Validators.required]
  });

  paymentMethods = ['Cash', 'Cheque', 'Bank Transfer', 'Online Transfer'];

  get totalDue(): number {
    return this.invoices.reduce((sum, inv) => sum + inv.remainingDue, 0);
  }

  get paymentStatus(): string {
    if (this.totalDue <= 0) return 'Paid';
    return this.invoices.some(i => i.status === 'Partially Paid') ? 'Partially Paid' : 'Unpaid';
  }

  selectInvoice(invoice: any) {
    this.selectedInvoice = invoice;
    this.paymentForm.patchValue({ amount: invoice.remainingDue });
  }

  onSearchInput(event: Event): void {
    const query = (event.target as HTMLInputElement).value;
    if (query.length < 3) {
      this.students = [];
      return;
    }
    const schoolId = this.authService.getSchoolId();
    this.studentService.searchStudents(schoolId, query).subscribe({
      next: (res) => this.students = res,
      error: () => this.toastr.error('Failed to search students')
    });
  }

  selectStudent(student: any): void {
    this.selectedStudent = student;
    this.students = [];
    this.loadStudentInvoices();
  }

  onSubmitPayment(): void {
    if (!this.selectedInvoice || this.paymentForm.invalid) {
      this.toastr.error('Please select an invoice and enter a valid amount');
      return;
    }
    this.processingPayment = true;
    this.feeService.processPayment(this.selectedInvoice._id, this.paymentForm.value).subscribe({
      next: () => {
        this.toastr.success('Payment processed successfully');
        this.paymentForm.reset({ method: 'Cash' });
        this.loadStudentInvoices();
      },
      error: (err) => this.toastr.error(err.error?.error || 'Payment failed'),
      complete: () => this.processingPayment = false
    });
  }

  private loadStudentInvoices(): void {
    this.feeService.getStudentInvoices(this.selectedStudent._id).subscribe({
      next: (response) => {
        this.invoices = response.data;
        if (this.invoices.length > 0 && !this.selectedInvoice) {
          this.selectInvoice(this.invoices[0]);
        }
      },
      error: () => this.toastr.error('Failed to load invoices')
    });
  }
}