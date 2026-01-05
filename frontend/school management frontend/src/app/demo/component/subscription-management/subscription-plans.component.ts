// subscription-plans.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SubscriptionService } from './subscription.service'; // Adjust path
import { ToastrService } from 'ngx-toastr';
import { environment } from 'src/environments/environment';

interface Plan {
  name: string;
  price: number;
  duration: number; // days
  sms: number;
  whatsapp: number;
  priority: number;
  planType: string;
  isYearly?: boolean;
}

@Component({
  selector: 'app-subscription-plans',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './subscription-plans.component.html',
  styleUrls: ['./subscription-plans.component.scss']
})
export class SubscriptionPlansComponent implements OnInit {
  plans: Plan[] = [];
  currentPlanType: string | null = null;
  isLoading = false;
  viewMode: 'monthly' | 'yearly' = 'monthly';

  constructor(
    private subscriptionService: SubscriptionService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.loadCurrentPlan();
    this.loadPlans();
  }

  loadCurrentPlan() {
    this.subscriptionService.getCurrentSubscription().subscribe({
      next: (sub) => {
        this.currentPlanType = sub.planType;
      },
      error: () => {
        this.currentPlanType = null;
        this.toastr.warning('Could not load current plan');
      }
    });
  }

  loadPlans() {
    this.isLoading = true;
    this.subscriptionService.getPlans().subscribe({
      next: (data) => {
        this.plans = Object.values(data).map((p: any) => ({
          ...p,
          isYearly: p.planType.includes('yearly')
        }));
        this.plans.sort((a, b) => a.priority - b.priority);
        this.isLoading = false;
      },
      error: () => {
        this.toastr.error('Failed to load subscription plans');
        this.isLoading = false;
      }
    });
  }

  toggleViewMode(mode: 'monthly' | 'yearly') {
    this.viewMode = mode;
  }

  getFilteredPlans(): Plan[] {
    return this.plans.filter(p => this.viewMode === 'yearly' ? p.isYearly : !p.isYearly);
  }

  selectPlan(plan: Plan) {
    if (plan.planType === this.currentPlanType) {
      this.toastr.info('This is your current plan');
      return;
    }

    if (this.isLoading) return;

    this.isLoading = true;

    // Call upgrade API (sends planType, backend uses current school from auth)
    this.subscriptionService.upgradeSubscription({ planType: plan.planType }).subscribe({
      next: (response) => {
        this.toastr.info(`Initiating upgrade to ${plan.name}...`);

        // Razorpay flow if backend returns order
        if (response.order) {
          this.initiateRazorpayPayment(response.order, plan);
        } else {
          // If backend handles upgrade directly (no payment needed)
          this.toastr.success('Plan upgraded successfully!');
          this.currentPlanType = plan.planType;
          this.isLoading = false;
        }
      },
      error: (err) => {
        this.toastr.error(err.error?.message || 'Upgrade failed. Please try again.');
        this.isLoading = false;
      }
    });
  }

  // Razorpay Payment (opens popup)
  private initiateRazorpayPayment(order: any, plan: Plan) {
    const options = {
      key: environment.razorpayKey, // Your Razorpay public key from environment
      amount: order.amount,
      currency: order.currency || 'INR',
      name: 'Your School Management System',
      description: `Upgrade to ${plan.name}`,
      image: '/assets/images/logo.png', // Optional logo
      order_id: order.id,
      prefill: {
        name: 'Admin Name', // Can fetch from auth service
        email: 'admin@school.com',
        contact: '9999999999'
      },
      handler: (response: any) => {
        // Payment success → verify with backend
        this.handlePaymentSuccess(response, plan.planType);
      },
      modal: {
        ondismiss: () => {
          this.toastr.info('Payment was cancelled');
          this.isLoading = false;
        }
      },
      theme: {
        color: '#667eea' // Matches your theme
      }
    };

    try {
      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (error) {
      this.toastr.error('Failed to open Razorpay. Please try again.');
      this.isLoading = false;
    }
  }

  // Verify payment after Razorpay success
  private handlePaymentSuccess(paymentResponse: any, planType: string) {
    this.subscriptionService.verifyPayment({
      ...paymentResponse,
      planType
    }).subscribe({
      next: (verification) => {
        this.toastr.success('Payment successful! Your plan is now upgraded.');
        this.currentPlanType = planType;
        this.isLoading = false;
        // Optional: reload or redirect to dashboard
        setTimeout(() => window.location.reload(), 2000);
      },
      error: (err) => {
        this.toastr.error('Payment verification failed. Contact support with payment ID.');
        this.isLoading = false;
      }
    });
  }
}