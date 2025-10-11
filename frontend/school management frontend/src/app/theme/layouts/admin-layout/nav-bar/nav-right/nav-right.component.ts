import { CommonModule } from '@angular/common';
import { Component, inject, input, output, TemplateRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
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
  GithubOutline,
} from '@ant-design/icons-angular/icons';
import { NgbDropdownModule, NgbModal, NgbNavModule } from '@ng-bootstrap/ng-bootstrap';
import { NgScrollbarModule } from 'ngx-scrollbar';
import { AuthService } from 'src/app/theme/shared/service/auth.service';
import { DashboardService } from 'src/app/theme/shared/service/dashboard.service';
import { environment } from 'src/environments/environment';
import { HttpClient } from '@angular/common/http';
import { ToastrService } from 'ngx-toastr';

interface Notification {
  _id: string;
  title: string;
  message: string;
  type: string;
  studentId: { _id: string; name: string; admissionNo: string };
  senderId: { _id: string; name: string };
  data: { reportId: string };
  status: string;
  createdAt: string;
}

interface StudentProgress {
  studentId: string;
  progress: string;
}
@Component({
  selector: 'app-nav-right',
  standalone: true,
  imports: [IconDirective,RouterModule, FormsModule, RouterModule, NgScrollbarModule, NgbNavModule, NgbDropdownModule, CommonModule],
  templateUrl: './nav-right.component.html',
  styleUrls: ['./nav-right.component.scss'],
})
export class NavRightComponent {
  private iconService = inject(IconService);
  public authService = inject(AuthService);
  private dashboardService = inject(DashboardService);
  public modalService = inject(NgbModal);
  private router = inject(Router);
  private http = inject(HttpClient);
  private toastr = inject(ToastrService);
  studentProgress: StudentProgress[] = [];
  styleSelectorToggle = input<boolean>();
  Customize = output();
  windowWidth: number;
  screenFull: boolean = true;
  username: string = '';
  role: string = '';
  notifications: Notification[] = []; // Store fetched notifications
  notificationCount: number = 0; // Count of unread notifications (for badge)

  isExpiringSoon: boolean = false;
  isExpired: boolean = false;
  isPending: boolean = false;
  selectedPlan: string | null = null;
  plans: any[] = [];
  upiId: string = '';
  subscriptionData: any = {};
  selectedPaymentMethod: string | null = null;
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
      WalletOutline,
    ]);
    this.authService.getProfile().subscribe((profile) => {
      this.username = profile.data.name || 'Unknown Name';
      this.role = profile.data.role || 'Not Available';
      if (this.role === 'parent') {
        this.loadNotifications(); // Fetch notifications only for parents
      }
    });
    this.fetchPlans();
  }

  fetchPlans() {
    this.dashboardService.getPlans().subscribe({
      next: (data: any) => {
        const normalizedPlans: any[] = [];
        if (data.basic) {
          Object.entries(data.basic).forEach(([key, plan]: [string, any]) => {
            normalizedPlans.push({
              ...plan,
              value: `basic_${key}`,
              discount: plan.savings || 0,
            });
          });
        }
        if (data.premium) {
          Object.entries(data.premium).forEach(([key, plan]: [string, any]) => {
            normalizedPlans.push({
              ...plan,
              value: `premium_${key}`,
              discount: plan.savings || 0,
            });
          });
        }
        this.plans = normalizedPlans;
      },
      error: (error) => console.error('Error fetching plans:', error),
    });
  }

  openUpgradeModal(template: TemplateRef<any>) {
    this.selectedPlan = null;
    this.selectedPaymentMethod = null;
    this.paymentProof = null;
    this.bankDetails = null;
    this.subscriptionId = null;
    this.upiId = '';
    this.modalService.open(template, {
      centered: true,
      size: 'lg',
      windowClass: 'custom-modal',
      backdrop: 'static',
    });
    this.fetchSubscription();
  }

  selectPlan(planValue: string) {
    this.selectedPlan = planValue;
  }

  selectPaymentMethod(method: string) {
    this.selectedPaymentMethod = method;
  }

  onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length) {
      this.paymentProof = input.files[0];
    }
  }

  upgradePlan() {
    if (!this.selectedPlan || !this.selectedPaymentMethod) {
      alert('Please select both a plan and a payment method.');
      return;
    }
    if (this.selectedPaymentMethod === 'phonepe' && !this.upiId) {
      alert('Please enter your UPI ID.');
      return;
    }
    this.isLoading = true;
    this.dashboardService
      .upgradeSubscription({
        planType: this.selectedPlan,
        paymentMethod: this.selectedPaymentMethod,
        autoRenew: false,
        upiId: this.upiId,
      })
      .subscribe({
        next: (response: any) => {
          if (this.selectedPaymentMethod === 'bank_transfer') {
            this.bankDetails = response.bankDetails;
            this.subscriptionId = response.subscriptionId;
            this.isLoading = false;
            return;
          }

          const { order } = response;
          if (!order || !order.id) {
            alert('Failed to initialize payment. Please try again.');
            this.isLoading = false;
            return;
          }

          const options = {
            key: environment.razorpayKey,
            amount: order.amount,
            currency: order.currency,
            name: 'School Management',
            description: `Upgrade to ${this.selectedPlan.split('_')[0]} (${this.selectedPlan.split('_')[1]})`,
            order_id: order.id,
            handler: (paymentResponse: any) => this.handlePaymentSuccess(paymentResponse),
            prefill: { name: this.username, email: this.authService.getUserEmail() },
            theme: { color: '#4a90e2' },
            ...(this.selectedPaymentMethod === 'phonepe' && { upi: { flow: 'intent', upi_intent: this.upiId } }),
          };

          const rzp = new (window as any).Razorpay(options);
          rzp.on('payment.failed', (response: any) => {
            console.error('Payment failed:', response.error);
            alert('Payment failed. Please try again or contact support.');
            this.isLoading = false;
          });
          rzp.open();
        },
        error: (error) => {
          console.error('Error initiating upgrade:', error);
          alert('Failed to initiate payment. Please try again or contact support.');
          this.isLoading = false;
        },
      });
  }

  handlePaymentSuccess(paymentResponse: any) {
    this.verifyPayment(paymentResponse).subscribe({
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
      },
    });
  }

  verifyPayment(paymentResponse: any) {
    return this.dashboardService.verifyPayment(paymentResponse);
  }

  uploadPaymentProof() {
    if (!this.paymentProof || !this.subscriptionId) {
      alert('Please select a payment proof file and ensure a subscription ID is available.');
      return;
    }
    this.isLoading = true;
    this.dashboardService.uploadPaymentProof(this.subscriptionId, this.paymentProof).subscribe({
      next: () => {
        alert('Payment proof uploaded. Awaiting verification by the super admin.');
        this.fetchSubscription();
        this.modalService.dismissAll();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error uploading payment proof:', error);
        alert('Failed to upload payment proof. Please try again.');
        this.isLoading = false;
      },
    });
  }

  fetchSubscription() {
    this.dashboardService.getSubscription().subscribe({
      next: (data: any) => {
        this.subscriptionData = data;
        this.isExpiringSoon = data.daysRemaining !== undefined && data.daysRemaining <= 7 && data.subscriptionStatus === 'active';
        this.isExpired = data.subscriptionStatus === 'expired';
        this.isPending = data.subscriptionStatus === 'pending';
      },
      error: (error) => console.error('Error fetching subscription:', error),
    });
  }

  logOut() {
    this.authService.logOut().subscribe({
      next: () => this.router.navigate(['/auth/login'], { replaceUrl: true }),
      error: (err) => {
        console.error('Logout error:', err);
        alert('Failed to log out. Please try again.');
      },
    });
  }
// New method for teacher to submit progress reports
  submitProgressReport() {
    if (this.role !== 'teacher') return;

    // Simple example: Hardcoded for now, replace with a form in UI
    this.studentProgress = [
      { studentId: '68bc52d38d80a74ea113d391', progress: 'Excellent' }, // Aayat
      { studentId: 'anotherStudentId1', progress: 'Good' },      // Rahul
      { studentId: 'anotherStudentId2', progress: 'Needs improvement' } // Sneha
    ];

    this.http.post(`${environment.apiUrl}/notifications/submit-progress-report`, { studentProgress: this.studentProgress }).subscribe({
      next: (response) => {
        this.toastr.success('Progress reports saved');
        this.studentProgress = []; // Clear form
        console.log('Response:', response);
      },
      error: (err) => {
        this.toastr.error('Failed to save progress report: ' + err.message);
        console.error('Error:', err);
      }
    });
  }

  loadNotifications() {
    if (this.role !== 'parent') return;

    this.http.get<any>(`${environment.apiUrl}/api/notifications/parent`).subscribe({
      next: (data) => {
        console.log(data.notifications)
        this.notifications = data.notifications.filter(n => n.type === 'progress-report');
        this.notificationCount = this.notifications.filter(n => n.status !== 'delivered').length;
      },
      error: (err) => {
        this.toastr.error('Failed to load notifications: ' + (err.error?.error || err.message), 'Error');
      }
    });
  }

  markNotificationAsRead(notificationId: string) {
    this.http.patch(`${environment.apiUrl}/api/notifications/${notificationId}/read`, {}).subscribe({
      next: () => {
        const notification = this.notifications.find(n => n._id === notificationId);
        if (notification) {
          notification.status = 'delivered';
          this.notificationCount = this.notifications.filter(n => n.status !== 'delivered').length;
        }
      },
      error: (err) => {
        this.toastr.error('Failed to mark notification as read: ' + (err.error?.error || err.message), 'Error');
      }
    });
  }


  profile = [
    { icon: 'anti', title: 'Academic Year', link: '/academic-year/details' },
    { icon: 'calendar', title: 'Calendar', link: '/holiday-calendar' },
    { icon: 'profile', title: 'Update School', link: '/school/school-modify' },
    { icon: 'unordered-list', title: 'Profile List', link: '/settings/profiles' },
    { icon: 'edit', title: 'Profile Update', link: '/settings/profile' },
  ];

  setting = [
    { icon: 'question-circle', title: 'Support' },
    { icon: 'user', title: 'Account Settings' },
    { icon: 'lock', title: 'Privacy Center' },
    { icon: 'comment', title: 'Feedback' },
    { icon: 'unordered-list', title: 'History' },
  ];
}