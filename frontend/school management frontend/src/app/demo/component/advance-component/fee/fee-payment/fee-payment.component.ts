import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FeeService } from '../fee.service';
import { ToastrService } from 'ngx-toastr';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { CardComponent } from 'src/app/theme/shared/components/card/card.component';
import { RazorpayService } from 'src/app/theme/shared/service/razorpay.service';
import { AuthService } from 'src/app/theme/shared/service/auth.service';

@Component({
  selector: 'app-fee-payment',
  standalone: true,
  imports: [CommonModule, FormsModule, CardComponent, ReactiveFormsModule],
  templateUrl: './fee-payment.component.html',
  styleUrls: ['./fee-payment.component.scss']
})
export class FeePaymentComponent implements OnInit {
  invoice: any = {}; // Single invoice object
  invoiceId: string | null = null;
  studentId: string = '';
  paymentForm: FormGroup;
  isLoading: boolean = true;
  isProcessing: boolean = false;
  errorMessage: string = '';
  userRole: string | null = null;
  paymentMethods: { value: string; label: string; disabled: boolean }[] = [
    { value: 'Cash', label: 'Cash', disabled: false },
    { value: 'Cheque', label: 'Cheque', disabled: false },
    { value: 'Online', label: 'Online (Razorpay)', disabled: false }
  ];
  totalDue: number = 0;
  paymentSuccess: boolean = false; // Flag for payment confirmation
  paymentHistoryText: string = ''; // Property to hold transformed payment history

  constructor(
    private route: ActivatedRoute,
    private feeService: FeeService,
    private toastr: ToastrService,
    public router: Router,
    private fb: FormBuilder,
    private razorpayService: RazorpayService,
    private authService: AuthService
  ) {
    this.paymentForm = this.fb.group({
      amount: [0, [Validators.required, Validators.min(1), Validators.max(0)]], // Initial max validation
      method: ['Cash', Validators.required],
      date: [new Date().toISOString().split('T')[0], Validators.required],
      chequeNumber: [''],
      transactionId: ['']
    });
  }

  ngOnInit(): void {
    this.userRole = this.authService.getUserRole();
    console.log('User Role:', this.userRole);
    if (!this.userRole || !['admin', 'accountant'].includes(this.userRole.toLowerCase())) {
      this.errorMessage = 'Unauthorized role for payment processing.';
      this.isLoading = false;
      this.toastr.error(this.errorMessage);
      this.router.navigate(['/fee/invoice-list']);
      return;
    }

    this.invoiceId = this.route.snapshot.paramMap.get('invoiceId');
    console.log('Received invoiceId:', this.invoiceId);
    if (this.invoiceId) {
      this.loadInvoice();
    } else {
      this.errorMessage = 'Invalid invoice ID.';
      this.isLoading = false;
      this.toastr.error(this.errorMessage);
      this.router.navigate(['/fee/invoice-list']);
    }
  }

 
// loadInvoice(): void {
//   this.isLoading = true;
//   this.feeService.getInvoiceById(this.invoiceId!).subscribe({
//     next: (res) => {
//       const invoiceData = res.data;
//       this.invoice = {
//         ...invoiceData,
//         studentId: invoiceData.studentId,
//         month: this.getInvoiceMonth(invoiceData.dueDate),
//         totalAmount: invoiceData.baseAmount + (invoiceData.additionalFees?.reduce((sum, fee) => sum + fee.amount, 0) || 0),
//         remainingDue: invoiceData.totals.due
//       };
//       this.paymentForm.patchValue({
//         amount: invoiceData.totals.due
//       });
//       this.paymentForm.get('amount')?.setValidators([
//         Validators.required,
//         Validators.min(1),
//         Validators.max(this.invoice.remainingDue)
//       ]);
//       this.paymentForm.get('amount')?.updateValueAndValidity();
//       this.totalDue = invoiceData.totals.due;
//       this.paymentHistoryText = this.transformPaymentHistory(invoiceData.paymentHistory || []);
//       this.isLoading = false;
//     },
//     error: (err) => {
//       this.errorMessage = err.error?.message || 'Failed to load invoice details.';
//       this.isLoading = false;
//       this.toastr.error(this.errorMessage);
//     }
//   });
// }
loadInvoice(): void {
  this.isLoading = true;
  this.feeService.getInvoiceById(this.invoiceId!).subscribe({
    next: (res) => {
      const invoiceData = res.data;
      // Use the correct property name 'student' from API response
      this.studentId = invoiceData.student._id; 
      
      this.invoice = {
        ...invoiceData,
        studentId: invoiceData.student, // For template compatibility
        month: this.getInvoiceMonth(invoiceData.dueDate),
        totalAmount: invoiceData.totals.total,
        remainingDue: invoiceData.totals.due
      };
      
      this.paymentForm.patchValue({
        amount: invoiceData.totals.due
      });
      
      this.paymentForm.get('amount')?.setValidators([
        Validators.required,
        Validators.min(1),
        Validators.max(this.invoice.remainingDue)
      ]);
      this.paymentForm.get('amount')?.updateValueAndValidity();
      
      this.totalDue = invoiceData.totals.due;
      this.paymentHistoryText = this.transformPaymentHistory(invoiceData.paymentHistory || []);
      this.isLoading = false;
    },
    error: (err) => {
      this.errorMessage = err.error?.message || 'Failed to load invoice details.';
      this.isLoading = false;
      this.toastr.error(this.errorMessage);
    }
  });
}

  private getInvoiceMonth(dueDate: string): string {
    const date = new Date(dueDate);
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
  }

  private transformPaymentHistory(history: any[]): string {
    return history.map(p => `${p.date}: ₹${p.amount} (${p.paymentMethod})`).join('\n') || 'No payment history';
  }

    processPayment(): void {
    if (!this.validateForm()) return;
    
    const method = this.paymentForm.value.method;
    if (confirm(`Confirm payment of ₹${this.paymentForm.value.amount} for ${this.invoice.month} using ${method}?`)) {
      this.isProcessing = true;
      const paymentPayload = {
        amount: Number(this.paymentForm.value.amount),
        paymentMethod: method,
        date: this.paymentForm.value.date,
        ...(method === 'Cheque' && { chequeNumber: this.paymentForm.value.chequeNumber }),
        ...(method === 'Online' && { transactionId: this.paymentForm.value.transactionId })
      };

      // Use studentId instead of invoiceId
      this.feeService.processPayment(this.studentId, paymentPayload).subscribe({
        next: (res) => {
          this.toastr.success(res.message || 'Payment processed successfully.');
          this.isProcessing = false;
          this.paymentSuccess = true;
          this.loadInvoice(); // Refresh invoice details
        },
        error: (err) => {
          this.toastr.error(err.error?.message || 'Failed to process payment.');
          this.isProcessing = false;
          console.error('Payment error:', err);
        }
      });
    }
  }


  // processPayment(): void {
  //   if (!this.validateForm()) return;
  //   const method = this.paymentForm.value.method;
  //   if (confirm(`Confirm payment of ₹${this.paymentForm.value.amount} for ${this.invoice.month} using ${method}?`)) {
  //     this.isProcessing = true;
  //     const paymentPayload = {
  //       amount: Number(this.paymentForm.value.amount),
  //       paymentMethod: method,
  //       date: this.paymentForm.value.date,
  //       ...(method === 'Cheque' && { chequeNumber: this.paymentForm.value.chequeNumber }),
  //       ...(method === 'Online' && { transactionId: this.paymentForm.value.transactionId })
  //     };

  //     console.log('Sending payment payload:', paymentPayload);
  //     this.feeService.processPayment(this.invoiceId!, paymentPayload).subscribe({
  //       next: (res) => {
  //         this.toastr.success(res.message || 'Payment processed successfully.');
  //         this.isProcessing = false;
  //         this.paymentSuccess = true;
  //         this.loadInvoice(); // Refresh invoice details
  //       },
  //       error: (err) => {
  //         this.toastr.error(err.error?.message || 'Failed to process payment.');
  //         this.isProcessing = false;
  //         console.error('Payment error:', err);
  //       }
  //     });
  //   }
  // }

  processOnlinePayment(paymentPayload: any): void {
    this.razorpayService.razorpayLoaded$.subscribe(loaded => {
      if (!loaded) {
        this.toastr.error('Razorpay SDK not loaded. Please try again.');
        this.isProcessing = false;
        return;
      }

      const razorpayKey = this.razorpayService.getRazorpayKey();
      if (!razorpayKey) {
        this.toastr.error('Razorpay key not configured. Contact administrator.');
        this.isProcessing = false;
        return;
      }

      const options = {
        key: razorpayKey,
        amount: paymentPayload.amount * 100,
        currency: 'INR',
        name: 'School Fee Payment',
        description: `Payment for Invoice ${this.invoiceId}`,
        handler: (response: any) => {
          paymentPayload.transactionId = response.razorpay_payment_id;
          this.feeService.processPayment(this.invoiceId!, paymentPayload).subscribe({
            next: (res) => {
              this.toastr.success(res.message || 'Payment processed successfully.');
              this.isProcessing = false;
              this.paymentSuccess = true;
              this.loadInvoice();
            },
            error: (err) => {
              this.toastr.error(err.error?.message || 'Failed to process payment.');
              this.isProcessing = false;
            }
          });
        },
        prefill: {
          name: this.invoice.studentId.name || '',
          email: '',
          contact: ''
        },
        theme: { color: '#4a90e2' }
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
      rzp.on('payment.failed', () => {
        this.toastr.error('Payment failed. Please try again.');
        this.isProcessing = false;
      });
    });
  }

  validateForm(): boolean {
    if (this.paymentForm.invalid) {
      this.paymentForm.markAllAsTouched();
      this.toastr.error('Please correct the form errors.');
      return false;
    }
    return true;
  }

  onPaymentMethodChange(): void {
    const method = this.paymentForm.get('method')?.value;
    if (method !== 'Cheque') {
      this.paymentForm.get('chequeNumber')?.setValue('');
      this.paymentForm.get('chequeNumber')?.clearValidators();
    } else {
      this.paymentForm.get('chequeNumber')?.setValidators([Validators.required]);
    }
    if (method !== 'Online') {
      this.paymentForm.get('transactionId')?.setValue('');
      this.paymentForm.get('transactionId')?.clearValidators();
    } else {
      // this.paymentForm.get('transactionId')?.setValidators([Validators.required]);
    }
    this.paymentForm.get('chequeNumber')?.updateValueAndValidity();
    this.paymentForm.get('transactionId')?.updateValueAndValidity();
  }
}