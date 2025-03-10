// fee-payment.component.ts
import { Component, inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { FeeService } from '../fee.service';
import { StudentService } from '../../students/student.service';
import { AuthService } from 'src/app/theme/shared/service/auth.service';


@Component({
  selector: 'app-fee-payment',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, DatePipe],
  templateUrl: './fee-payment.component.html',
  styleUrls: ['./fee-payment.component.scss']
})
export class FeePaymentComponent implements OnInit{
  // Services
  private fb = inject(FormBuilder);
  private feeService = inject(FeeService);
  private studentService = inject(StudentService);
  private authService = inject(AuthService);
  private toastr = inject(ToastrService);
  selectedInvoice: any = null;

  // Component State
  students: any[] = [];
  selectedStudent: any = null;
  school: any = null;
  invoices: any[] = [];
  today = new Date();
  processingPayment = false;

  // Form Configuration
  paymentForm = this.fb.group({
    amount: [null, [Validators.required, Validators.min(0.01)]],
    method: ['Cash', Validators.required]
  });
  ngOnInit(): void {
    
  }
  paymentMethods = ['Cash', 'Cheque', 'Bank Transfer', 'Online Transfer'];

  // Computed Properties
  get totalDue(): number {
    return this.invoices.reduce((sum, inv) => sum + inv.remainingDue, 0);
  }

  get paymentStatus(): string {
    if (this.totalDue <= 0) return 'Paid';
    return this.invoices.some(i => i.status === 'Partially Paid') 
      ? 'Partially Paid' 
      : 'Unpaid';
  }

  get paymentStatusClass(): string {
    return {
      'Paid': 'bg-success',
      'Partially Paid': 'bg-warning',
      'Unpaid': 'bg-danger'
    }[this.paymentStatus];
  }
  selectInvoice(invoice: any) {
    this.selectedInvoice = invoice;
    this.paymentForm.patchValue({
      amount: invoice.remainingDue
    });
  }
  // Event Handlers
  onSearchInput(event: Event): void {
    const query = (event.target as HTMLInputElement).value;
    if (query.length < 3) {
      this.students = [];
      return;
    }
    
    const schoolId = this.authService.getSchoolId();
    this.studentService.searchStudents(schoolId, query).subscribe({
      next: (res) => this.students = res,
      error: (err) => this.showError('Failed to search students')
    });
  }

  selectStudent(student: any): void {
    this.selectedStudent = student;
    this.students = [];
    this.loadStudentInvoices();
    this.loadSchoolDetails();

  }

  onSubmitPayment(): void {
    if (!this.selectedInvoice) {
      this.toastr.error('Please select an invoice to pay');
      return;
    }
  
    const paymentData = {
      amountPaid: this.paymentForm.value.amount,
      method: this.paymentForm.value.method
    };
  
    this.feeService.processPayment(this.selectedInvoice._id, paymentData)
      .subscribe({  
      next: () => {
        this.toastr.success('Payment processed successfully');
        this.paymentForm.reset({ method: 'Cash' });
        this.loadStudentInvoices();
      },
      error: (err) => this.showError(err.error?.message || 'Payment failed'),
      complete: () => this.processingPayment = false
    });
  }

  // Data Loading
  private loadSchoolDetails(): void {
    this.feeService.getSchoolById(this.selectedStudent.schoolId).subscribe({
      next: (school) => {
        console.log(this.school)
        this.school = school
      },
      error: (err) => this.showError('Failed to load school details')
    });
  }

  private loadStudentInvoices(): void {
    this.feeService.getStudentInvoices(this.selectedStudent._id).subscribe({
      next: (invoices) => this.invoices = invoices.data,
      error: (err) => this.showError('Failed to load invoices')
    });
  }

  private showError(message: string): void {
    this.toastr.error(message);
    this.processingPayment = false;
  }
}