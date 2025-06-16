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
  invoice: any = null;
  invoiceId: string | null = null;
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

  constructor(
    private route: ActivatedRoute,
    private feeService: FeeService,
    private toastr: ToastrService,
    private router: Router,
    private fb: FormBuilder,
    private razorpayService: RazorpayService,
    private authService: AuthService
  ) {
    this.paymentForm = this.fb.group({
      amount: [0, [Validators.required, Validators.min(1)]],
      method: ['Cash', Validators.required],
      date: [new Date().toISOString().split('T')[0], Validators.required],
      chequeNumber: ['']
    });
  }

  ngOnInit(): void {
    this.userRole = this.authService.getUserRole();
    if (!this.userRole) {
      this.errorMessage = 'User role not found. Please log in again.';
      this.isLoading = false;
      this.toastr.error(this.errorMessage);
      this.router.navigate(['/auth/login']);
      return;
    }

    if (this.userRole === 'Parent') {
      this.paymentMethods = this.paymentMethods.map(method =>
        ['Cash', 'Cheque'].includes(method.value)
          ? { ...method, disabled: true }
          : method
      );
      this.paymentForm.get('method')?.setValue('Online');
    } else if (this.userRole === 'Student') {
      this.errorMessage = 'Students are not authorized to process payments.';
      this.isLoading = false;
      this.toastr.error(this.errorMessage);
      this.router.navigate(['/fee/invoice-list']);
      return;
    }

    this.invoiceId = this.route.snapshot.paramMap.get('invoiceId');
    if (this.invoiceId) {
      this.loadInvoice();
    } else {
      this.errorMessage = 'Invalid invoice ID.';
      this.isLoading = false;
      this.toastr.error(this.errorMessage);
      this.router.navigate(['/fee/invoice-list']);
    }

    this.razorpayService.razorpayLoaded$.subscribe(loaded => {
      if (!loaded) {
        this.toastr.error('Razorpay SDK failed to load. Online payments unavailable.');
        this.paymentMethods = this.paymentMethods.map(method =>
          method.value === 'Online' ? { ...method, disabled: true } : method
        );
      }
    });
  }

  loadInvoice(): void {
    this.isLoading = true;
    this.feeService.getInvoiceById(this.invoiceId!).subscribe({
      next: (res) => {
        console.log('Invoice response:', res);
        this.invoice = res.data;
        // Map response fields to expected properties
        this.invoice.studentId = this.invoice.student; // Map student to studentId
        this.invoice.totalAmount = this.invoice.totals.total; // Map totals.total to totalAmount
        this.invoice.remainingDue = this.invoice.totals.due; // Map totals.due to remainingDue

        // Derive month from invoiceDate if month is not provided
        if (!this.invoice.month && this.invoice.invoiceDate) {
          const invoiceDate = new Date(this.invoice.invoiceDate);
          this.invoice.month = invoiceDate.toLocaleString('default', { month: 'long', year: 'numeric' });
        }

        // Update form with remainingDue
        this.paymentForm.patchValue({ amount: this.invoice.remainingDue });
        this.paymentForm.get('amount')?.setValidators([
          Validators.required,
          Validators.min(1),
          Validators.max(this.invoice.remainingDue)
        ]);
        this.paymentForm.get('amount')?.updateValueAndValidity();

        this.isLoading = false;
      },
      error: (err) => {
        console.error('Invoice fetch error:', err);
        this.errorMessage = err.error?.message || 'Failed to load invoice details.';
        this.isLoading = false;
        this.toastr.error(this.errorMessage);
        this.router.navigate(['/fee/invoice-list']);
      }
    });
  }

  onPaymentMethodChange(): void {
    const method = this.paymentForm.get('method')?.value;
    if (method !== 'Cheque') {
      this.paymentForm.get('chequeNumber')?.setValue('');
      this.paymentForm.get('chequeNumber')?.clearValidators();
    } else {
      this.paymentForm.get('chequeNumber')?.setValidators([Validators.required]);
    }
    this.paymentForm.get('chequeNumber')?.updateValueAndValidity();
  }

  validateForm(): boolean {
    if (this.paymentForm.invalid) {
      this.paymentForm.markAllAsTouched();
      this.toastr.error('Please correct the form errors.');
      return false;
    }
    return true;
  }

  processPayment(): void {
    if (!this.validateForm()) {
      return;
    }

    if (confirm(`Confirm payment of ₹${this.paymentForm.value.amount} for ${this.invoice.month}?`)) {
      this.paymentForm.value.method === 'Online'
        ? this.processOnlinePayment()
        : this.processManualPayment();
    }
  }

  processManualPayment(): void {
    this.isProcessing = true;
    const paymentPayload = {
      amount: this.paymentForm.value.amount,
      paymentMethod: this.paymentForm.value.method,
      date: this.paymentForm.value.date,
      ...(this.paymentForm.value.method === 'Cheque' && { chequeNumber: this.paymentForm.value.chequeNumber })
    };

    this.feeService.processPayment(this.invoiceId!, paymentPayload).subscribe({
      next: (res) => {
        this.toastr.success(res.message || 'Payment processed successfully.');
        this.isProcessing = false;
        this.router.navigate(['/fee/invoice-list']);
      },
      error: (err) => {
        this.toastr.error(err.error?.message || 'Failed to process payment.');
        this.isProcessing = false;
      }
    });
  }

  processOnlinePayment(): void {
    this.isProcessing = true;
    this.razorpayService.razorpayLoaded$.subscribe(loaded => {
      if (!loaded) {
        this.toastr.error('Razorpay SDK not loaded. Please try again.');
        this.isProcessing = false;
        return;
      }

      const options = {
        key: this.razorpayService.getRazorpayKey(),
        amount: this.paymentForm.value.amount * 100,
        currency: 'INR',
        name: 'School Fee Payment',
        description: `Payment for Invoice ${this.invoiceId} (${this.invoice.month})`,
        handler: (response: any) => {
          const paymentPayload = {
            amount: this.paymentForm.value.amount,
            method: 'Online',
            date: this.paymentForm.value.date,
            transactionId: response.razorpay_payment_id
          };
          this.feeService.processPayment(this.invoiceId!, paymentPayload).subscribe({
            next: (res) => {
              this.toastr.success(res.message || 'Payment processed successfully.');
              this.isProcessing = false;
              this.router.navigate(['/fee/invoice-list']);
            },
            error: (err) => {
              this.toastr.error(err.error?.message || 'Failed to process payment.');
              this.isProcessing = false;
            }
          });
        },
        prefill: {
          name: this.invoice?.studentId?.name || '',
          email: this.invoice?.studentId?.email || '',
          contact: this.invoice?.studentId?.phone || ''
        },
        theme: {
          color: '#4a90e2'
        }
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
      rzp.on('payment.failed', () => {
        this.toastr.error('Payment failed. Please try again.');
        this.isProcessing = false;
      });
    });
  }
}