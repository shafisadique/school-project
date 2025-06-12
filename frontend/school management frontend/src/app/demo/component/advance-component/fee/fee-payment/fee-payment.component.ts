import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FeeService } from '../fee.service';
import { ToastrService } from 'ngx-toastr';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardComponent } from 'src/app/theme/shared/components/card/card.component';

@Component({
  selector: 'app-fee-payment',
  standalone: true,
  imports: [CommonModule, FormsModule,CardComponent],
  templateUrl: './fee-payment.component.html',
  styleUrls: ['./fee-payment.component.scss']
})
export class FeePaymentComponent implements OnInit {
  invoice: any = null;
  invoiceId: string | null = null;
  paymentData: any = {
    amount: 0,
    method: 'Cash',
    date: new Date().toISOString().split('T')[0], // Default to today
    chequeNumber: ''
  };
  isLoading: boolean = true;
  isProcessing: boolean = false;
  errorMessage: string = '';
  amountError: string = '';
  chequeError: string = '';

  constructor(
    private route: ActivatedRoute,
    private feeService: FeeService,
    private toastr: ToastrService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.invoiceId = this.route.snapshot.paramMap.get('invoiceId');
    if (this.invoiceId) {
      this.loadInvoice();
    } else {
      this.errorMessage = 'Invalid invoice ID.';
      this.isLoading = false;
    }
  }

  loadInvoice(): void {
    this.isLoading = true;
    this.feeService.getInvoiceById(this.invoiceId!).subscribe({
      next: (res) => {
        this.invoice = res.data;
        // Ensure the month is in a readable format (e.g., "2025-06" -> "June 2025")
        if (this.invoice.month) {
          const date = new Date(this.invoice.month + '-01');
          this.invoice.month = date.toLocaleString('default', { month: 'long', year: 'numeric' });
        }
        this.paymentData.amount = this.invoice.remainingDue; // Pre-fill with remaining due
        this.isLoading = false;
      },
      error: (err) => {
        this.errorMessage = err.message || 'Failed to load invoice details.';
        this.isLoading = false;
        this.toastr.error(this.errorMessage);
      }
    });
  }

  onPaymentMethodChange(): void {
    if (this.paymentData.method !== 'Cheque') {
      this.paymentData.chequeNumber = '';
      this.chequeError = '';
    }
  }

  validateForm(): boolean {
    this.amountError = '';
    this.chequeError = '';

    // Validate amount
    if (!this.paymentData.amount || this.paymentData.amount <= 0) {
      this.amountError = 'Amount must be greater than 0.';
      return false;
    }
    if (this.paymentData.amount > this.invoice.remainingDue) {
      this.amountError = `Amount cannot exceed the remaining due (${this.invoice.remainingDue}).`;
      return false;
    }

    // Validate cheque number if method is Cheque
    if (this.paymentData.method === 'Cheque' && !this.paymentData.chequeNumber) {
      this.chequeError = 'Cheque number is required.';
      return false;
    }

    return true;
  }

  processPayment(): void {
    if (!this.validateForm()) {
      return;
    }

    if (this.paymentData.method === 'Online') {
      this.processOnlinePayment();
    } else {
      this.processManualPayment();
    }
  }

  processManualPayment(): void {
    this.isProcessing = true;
    const paymentPayload = {
      amount: this.paymentData.amount,
      method: this.paymentData.method,
      date: this.paymentData.date,
      ...(this.paymentData.method === 'Cheque' && { chequeNumber: this.paymentData.chequeNumber })
    };

    this.feeService.processPayment(this.invoiceId!, paymentPayload).subscribe({
      next: (res) => {
        this.toastr.success(res.message || 'Payment processed successfully.');
        this.isProcessing = false;
        this.router.navigate(['/fee/invoice-list']);
      },
      error: (err) => {
        this.toastr.error(err.message || 'Failed to process payment.');
        this.isProcessing = false;
      }
    });
  }

  processOnlinePayment(): void {
    this.isProcessing = true;
    const options = {
      key: 'YOUR_RAZORPAY_KEY', // Replace with your Razorpay key
      amount: this.paymentData.amount * 100, // Amount in paise
      currency: 'INR',
      name: 'School Fee Payment',
      description: `Payment for Invoice ${this.invoiceId} (${this.invoice.month})`,
      handler: (response: any) => {
        const paymentPayload = {
          amount: this.paymentData.amount,
          method: 'Online',
          date: this.paymentData.date,
          transactionId: response.razorpay_payment_id
        };
        this.feeService.processPayment(this.invoiceId!, paymentPayload).subscribe({
          next: (res) => {
            this.toastr.success(res.message || 'Payment processed successfully.');
            this.isProcessing = false;
            this.router.navigate(['/fee/invoice-list']);
          },
          error: (err) => {
            this.toastr.error(err.message || 'Failed to process payment.');
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
    rzp.on('payment.failed', (response: any) => {
      this.toastr.error('Payment failed. Please try again.');
      this.isProcessing = false;
    });
  }
}