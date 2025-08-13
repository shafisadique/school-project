import { Component } from '@angular/core';
import { SubscriptionService } from '../subscription.service';
import { ToastrService } from 'ngx-toastr';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-subscription-management',
  imports: [CommonModule,FormsModule],
  templateUrl: './subscription-management.component.html',
  styleUrl: './subscription-management.component.scss'
})
export class SubscriptionManagementComponent {
schools: any[] = [];
  selectedSchoolId: string = '';
  planType: string = 'trial';
  expiresAt: string = '';
  isLoading: boolean = false;
error: string = '';
  constructor(
    private subscriptionService: SubscriptionService,
    private toastr: ToastrService,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadSchools();
  }
  onSchoolChange() {}

  loadSchools() {
    this.isLoading = true;
    this.subscriptionService.getSchools().subscribe({
      next: (data) => {
        this.schools = data;
        this.isLoading = false;
      },
      error: (err) => {
        this.toastr.error(err.error?.message || 'Failed to load schools');
        this.isLoading = false;
      }
    });
  }

  updateSubscription() {
    if (!this.selectedSchoolId || !this.planType) {
      this.toastr.error('Please select a school and plan type');
      return;
    }

    this.isLoading = true;
    this.subscriptionService.updateSubscription(this.selectedSchoolId, this.planType, this.expiresAt).subscribe({
      next: (res: any) => {
        this.toastr.success(res.message);
        this.isLoading = false;
      },
      error: (err) => {
        this.toastr.error(err.error?.message || 'Failed to update subscription');
        this.isLoading = false;
      }
    });
  }
}
