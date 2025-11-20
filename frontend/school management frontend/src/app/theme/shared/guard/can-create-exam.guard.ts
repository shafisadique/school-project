// guards/can-create-exam.guard.ts
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
      const response = await this.subscriptionService.getCurrentSubscription().toPromise();
      
      if (response.features?.includes('exam')) {
        return true;
      }

      // Not premium → block + show message
      this.toastr.warning(
        'Exam module is only available in Premium plan. Please upgrade to continue.',
        'Premium Feature Required',
        { timeOut: 8000 }
      );

      this.router.navigate(['/subscription/plans']); // Redirect to pricing page
      return false;

    } catch (error) {
      this.toastr.error('Failed to verify plan. Please try again.');
      this.router.navigate(['/dashboard/default']);
      return false;
    }
  }
}