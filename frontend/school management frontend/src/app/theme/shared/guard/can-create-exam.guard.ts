// guards/can-create-exam.guard.ts → FINAL 100% WORKING
import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { SubscriptionService } from 'src/app/demo/component/subscription-management/subscription.service';

@Injectable({
  providedIn: 'root'
})
export class CanCreateExamGuard implements CanActivate {

  constructor(
    private subscriptionService: SubscriptionService,
    private router: Router,
    private toastr: ToastrService
  ) {}

  async canActivate(): Promise<boolean> {
    try {
      const sub = await this.subscriptionService.getCurrentSubscription().toPromise();

      // CHECK PLAN TYPE — NOT FEATURES ARRAY
      const isPremium = sub?.planType && 
        sub.planType.toLowerCase().includes('premium');

      if (isPremium) {
        return true; // Allow access
      }

      // BLOCK NON-PREMIUM
      this.toastr.warning(
        'Exam module is only available in Premium plan. Please upgrade to continue.',
        'Premium Feature Required',
        { timeOut: 8000 }
      );
      this.router.navigate(['/subscription/plans']);
      return false;

    } catch (error) {
      this.toastr.error('Failed to verify your plan');
      this.router.navigate(['/dashboard/default']);
      return false;
    }
  }
}