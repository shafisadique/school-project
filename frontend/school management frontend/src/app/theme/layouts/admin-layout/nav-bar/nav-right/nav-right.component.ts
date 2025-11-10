import { CommonModule } from '@angular/common';
import { Component, inject, input, output, TemplateRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { IconService, IconDirective } from '@ant-design/icons-angular';
import {
  AppstoreOutline,      // ← for "Academic Year"
  CalendarOutline,      // ← for "Calendar"
  BankOutline,          // ← for "School Update" (or any you like)
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
import { SubscriptionPlan } from 'src/app/demo/component/advance-component/fee/plan.interface';

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
  filteredProfile: any[] = [];
  filteredSetting: any[] = [];

  isExpiringSoon: boolean = false;
  isExpired: boolean = false;
  isPending: boolean = false;
  selectedPlan: string | null = null;
  plans: SubscriptionPlan[] = [];
  upiId: string = '';
  subscriptionData: any = {};
  selectedPaymentMethod: string | null = null;
  paymentProof: File | null = null;
  bankDetails: any = null;
  subscriptionId: string | null = null;
  isLoading: boolean = false;
cardNumber: string = '';
  expiryDate: string = '';
  cvv: string = '';
  nameOnCard: string = '';
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
      AppstoreOutline,
      CalendarOutline,
      BankOutline,
      GithubOutline,
      WalletOutline,
    ]);
    this.authService.getProfile().subscribe((profile) => {
      this.username = profile.data.name || 'Unknown Name';
      this.role = profile.data.role || 'Not Available';
      this.filteredProfile = this.profile.filter(item => item.roles.includes(this.role));
      this.filteredSetting = this.setting;
      if (this.role === 'admin') {
        this.fetchSubscription(); // ← ADD THIS
      }
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

  getPlanPrice(planValue: string): number {
    const plan = this.plans.find(p => p.value === planValue);
    return plan ? plan.price : 0;
  }
upgradePlan() {
  if (!this.selectedPlan || !this.selectedPaymentMethod) {
    alert('Please select both a plan and a payment method.');
    return;
  }

  this.isLoading = true;

  const payload: any = {
    planType: this.selectedPlan,
    paymentMethod: this.selectedPaymentMethod,
    autoRenew: false
  };

  if (this.selectedPaymentMethod === 'phonepe') {
    payload.upiId = this.upiId;
  }

  this.dashboardService.upgradeSubscription(payload).subscribe({
    next: (response: any) => {
      if (environment.testMode) {
        alert('Test mode: Subscription upgraded successfully!');
        this.fetchSubscription();
        this.modalService.dismissAll();
        this.isLoading = false;
        return;
      }

      if (this.selectedPaymentMethod === 'bank_transfer') {
        this.bankDetails = response.bankDetails;
        this.subscriptionId = response.subscriptionId;
        this.isLoading = false;
        return;
      }

      // Handle Razorpay payment
      if (response.order) {
        this.initiateRazorpayPayment(response.order, response.plan, response.subscriptionId);
      } else {
        alert('Failed to initialize payment. Please try again.');
        this.isLoading = false;
      }
    },
    error: (error) => {
      console.error('Error initiating upgrade:', error);
      alert('Failed to initiate payment. Please try again or contact support.');
      this.isLoading = false;
    },
  });
}

private initiateRazorpayPayment(order: any, plan: any, subscriptionId: string) {
  console.log('this is working')
  const options = {
    key: environment.razorpayKey,
    amount: order.amount,
    currency: order.currency,
    name: 'School Management System',
    description: `Upgrade to ${plan.name}`,
    image: '/assets/images/logo.png', // Add your logo
    order_id: order.id,
    prefill: {
      name: this.username,
      email: this.authService.getUserEmail(),
      contact: '' // Add if you have user contact
    },
    handler: (response: any) => {
      console.log('Payment successful:', response);
      this.handlePaymentSuccess(response, subscriptionId);
    },
    modal: {
      ondismiss: () => {
        console.log('Payment modal closed');
        this.isLoading = false;
        // Optional: Show message that payment was cancelled
        this.toastr.info('Payment was cancelled. You can try again anytime.');
      }
    },
    theme: {
      color: '#4a90e2'
    }
  };

  try {
    const rzp = new (window as any).Razorpay(options);
    
    rzp.on('payment.failed', (response: any) => {
      console.error('Payment failed:', response.error);
      this.toastr.error(`Payment failed: ${response.error.description}`);
      this.isLoading = false;
    });

    rzp.open();
  } catch (error) {
    console.error('Error opening Razorpay:', error);
    this.toastr.error('Error initializing payment gateway');
    this.isLoading = false;
  }
}

private handlePaymentSuccess(paymentResponse: any, subscriptionId: string) {
  console.log('Handling payment success:', paymentResponse);
  
  // Add subscriptionId to the payment response
  const verificationData = {
    ...paymentResponse,
    subscriptionId: subscriptionId
  };

  this.dashboardService.verifyPayment(verificationData).subscribe({
    next: (verificationResponse) => {
      console.log('Payment verified successfully:', verificationResponse);
      this.toastr.success('Subscription upgraded successfully!');
      
      // Update local subscription data
      this.fetchSubscription();
      
      // Close modal
      this.modalService.dismissAll();
      this.isLoading = false;
      
      // Optional: Reload page to reflect changes
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    },
    error: (error) => {
      console.error('Payment verification failed:', error);
      this.toastr.error('Payment verification failed. Please contact support with your payment ID.');
      this.isLoading = false;
    },
  });
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
      console.log('Subscription data:', data);
      this.subscriptionData = data;

      // FIX: Use `status`, not `subscriptionStatus`
      const isActive = data.status === 'active';
      const isExpired = data.status === 'expired';
      const isPending = data.status === 'pending';

      this.isExpiringSoon = data.daysRemaining !== undefined && data.daysRemaining <= 7 && isActive;
      this.isExpired = isExpired;
      this.isPending = isPending;
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


// profile array – change the icon strings
profile = [
  { icon: 'appstore', title: 'Academic Year', link: '/academic-year/details', roles: ['admin'] },
  { icon: 'calendar', title: 'Calendar', link: '/holiday-calendar', roles: ['admin'] },
  { icon: 'bank',     title: 'Update School', link: '/school/school-modify', roles: ['admin'] },
  { icon: 'unordered-list', title: 'Profile List', link: '/settings/profiles', roles: ['admin'] },
  { icon: 'edit', title: 'Profile Update', link: '/settings/profile', roles: ['admin','teacher','student']},
];

  setting = [
    { icon: 'question-circle', title: 'Support' },
    { icon: 'user', title: 'Account Settings' },
    { icon: 'lock', title: 'Privacy Center' },
    { icon: 'comment', title: 'Feedback' },
    { icon: 'unordered-list', title: 'History' },
  ];
}