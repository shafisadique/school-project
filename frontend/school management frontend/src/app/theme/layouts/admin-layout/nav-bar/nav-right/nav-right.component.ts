import { CommonModule } from '@angular/common';
import { Component, inject, input, output, TemplateRef } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { IconService, IconDirective } from '@ant-design/icons-angular';
import {
  BellOutline,
  SettingOutline,
  GiftOutline,
  MessageOutline,
  PhoneOutline,
  CheckCircleOutline,
  LogoutOutline,
  EditOutline,
  UserOutline,
  ProfileOutline,
  WalletOutline,
  QuestionCircleOutline,
  LockOutline,
  CommentOutline,
  UnorderedListOutline,
  ArrowRightOutline,
  GithubOutline
} from '@ant-design/icons-angular/icons';
import { NgbDropdownModule, NgbModal, NgbNavModule } from '@ng-bootstrap/ng-bootstrap';
import { NgScrollbarModule } from 'ngx-scrollbar';
import { AuthService } from 'src/app/theme/shared/service/auth.service';
import { DashboardService } from 'src/app/theme/shared/service/dashboard.service';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-nav-right',
  standalone: true,
  imports: [IconDirective, RouterModule, NgScrollbarModule, NgbNavModule, NgbDropdownModule, CommonModule],
  templateUrl: './nav-right.component.html',
  styleUrls: ['./nav-right.component.scss']
})
export class NavRightComponent {
  private iconService = inject(IconService);
  public authService = inject(AuthService);
  private dashboardService = inject(DashboardService);
  public modalService = inject(NgbModal);
  private router = inject(Router);

  styleSelectorToggle = input<boolean>();
  Customize = output();
  windowWidth: number;
  screenFull: boolean = true;
  username: string = '';
  role: string = '';

  isExpiringSoon: boolean = false;
  isExpired: boolean = false;
  isPending: boolean = false;
  selectedPlan: string = 'basic_monthly';
  plans: any[] = [];
  subscriptionData: any = {};
  selectedPaymentMethod: string = 'razorpay';
  paymentProof: File | null = null;
  bankDetails: any = null;
  subscriptionId: string | null = null;
  isLoading: boolean = false;

  constructor() {
    this.windowWidth = window.innerWidth;
    this.iconService.addIcon(...[
      CheckCircleOutline,
      GiftOutline,
      MessageOutline,
      SettingOutline,
      PhoneOutline,
      LogoutOutline,
      UserOutline,
      EditOutline,
      ProfileOutline,
      QuestionCircleOutline,
      LockOutline,
      CommentOutline,
      UnorderedListOutline,
      ArrowRightOutline,
      BellOutline,
      GithubOutline,
      WalletOutline
    ]);
    this.authService.getProfile().subscribe(profile => {
      this.username = profile.data.name || 'Unknown Name';
      this.role = profile.data.role || 'Not Available';
    });
    this.fetchPlans();
  }

  fetchPlans() {
    this.dashboardService.getPlans().subscribe({
      next: (data: any) => {
        this.plans = [...data.basic, ...data.premium];
      },
      error: (error) => console.error('Error fetching plans:', error)
    });
  }

  openUpgradeModal(template: TemplateRef<any>) {
    this.selectedPaymentMethod = 'razorpay';
    this.paymentProof = null;
    this.bankDetails = null;
    this.subscriptionId = null;
    this.modalService.open(template, {
      centered: true,
      size: 'lg',
      windowClass: 'custom-modal',
      backdrop: 'static'
    });
    this.fetchSubscription();
  }

  onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length) {
      this.paymentProof = input.files[0];
    }
  }

  upgradePlan() {
    if (!this.selectedPlan) {
      alert('Please select a plan first.');
      return;
    }
    this.isLoading = true;
    this.dashboardService.upgradeSubscription({
      planType: this.selectedPlan,
      paymentMethod: this.selectedPaymentMethod
    }).subscribe({
      next: (response: any) => {
        if (this.selectedPaymentMethod === 'bank_transfer') {
          this.bankDetails = response.bankDetails;
          this.subscriptionId = response.subscriptionId;
          this.isLoading = false;
          return;
        }

        const { order } = response;
        const options = {
          key: environment.razorpayKeyId,
          amount: order.amount,
          currency: order.currency,
          name: 'School Management',
          description: `Upgrade to ${this.selectedPlan.split('_')[0]} (${this.selectedPlan.split('_')[1]})`,
          order_id: order.id,
          handler: (paymentResponse: any) => this.verifyPayment(paymentResponse),
          theme: { color: '#4a90e2' },
          ...(this.selectedPaymentMethod === 'phonepe' && {
            upi: { flow: 'intent', upi_intent: 'phonepe' }
          })
        };
        const rzp = new (window as any).Razorpay(options);
        rzp.on('payment.failed', (response: any) => {
          console.error('Payment failed:', response.error);
          alert('Payment failed. Please try again.');
          this.isLoading = false;
        });
        rzp.open();
      },
      error: (error) => {
        console.error('Error initiating upgrade:', error);
        alert('Failed to initiate payment. Please try again.');
        this.isLoading = false;
      }
    });
  }

  verifyPayment(paymentResponse: any) {
    this.dashboardService.verifyPayment(paymentResponse).subscribe({
      next: () => {
        alert('Subscription upgraded successfully!');
        this.fetchSubscription();
        this.modalService.dismissAll();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Payment verification failed:', error);
        alert('Payment verification failed. Please contact support.');
        this.isLoading = false;
      }
    });
  }

  logOut() {
    this.authService.logOut().subscribe({
      next: () => this.router.navigate(['/auth/login'], { replaceUrl: true }),
      error: (err) => {
        console.error('Logout error:', err);
        alert('Failed to log out. Please try again.');
      }
    });
  }

  uploadPaymentProof() {
    if (!this.paymentProof || !this.subscriptionId) {
      alert('Please select a file to upload.');
      return;
    }
    this.dashboardService.uploadPaymentProof(this.subscriptionId, this.paymentProof).subscribe({
      next: () => {
        alert('Payment proof uploaded. Awaiting verification.');
        this.fetchSubscription();
        this.modalService.dismissAll();
      },
      error: (error) => {
        console.error('Error uploading payment proof:', error);
        alert('Failed to upload payment proof. Please try again.');
      }
    });
  }

  fetchSubscription() {
    this.dashboardService.getSubscription().subscribe({
      next: (data: any) => {
        this.subscriptionData = data;
        this.isExpiringSoon = data.isExpiringSoon;
        this.isExpired = data.subscriptionStatus === 'expired';
        this.isPending = data.subscriptionStatus === 'pending';
      },
      error: (error) => console.error('Error fetching subscription:', error)
    });
  }

  profile = [
    { icon: 'anti', title: 'Academic Year', link: '/academic-year/details' },
    { icon: 'calendar', title: 'Calendar', link: '/holiday-calendar' },
    { icon: 'profile', title: 'Update School', link: '/school/school-modify' },
    { icon: 'unordered-list', title: 'Profile List', link: '/settings/profiles' },
    { icon: 'edit', title: 'Profile Update', link: '/settings/profile' }
  ];

  setting = [
    { icon: 'question-circle', title: 'Support' },
    { icon: 'user', title: 'Account Settings' },
    { icon: 'lock', title: 'Privacy Center' },
    { icon: 'comment', title: 'Feedback' },
    { icon: 'unordered-list', title: 'History' }
  ];
}