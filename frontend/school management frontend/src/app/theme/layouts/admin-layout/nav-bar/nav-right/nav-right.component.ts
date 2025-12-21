import { CommonModule } from '@angular/common';
import { Component, inject, input, OnDestroy, OnInit, output, TemplateRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { IconService, IconDirective } from '@ant-design/icons-angular';
import { io } from 'socket.io-client';
import {
  AppstoreOutline,
  CalendarOutline,
  BankOutline,
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
  studentId: { id: string; name: string; admissionNo: string };
  senderId: { id: string; name: string };
  data: { reportId: string };
  status: 'pending' | 'sent' | 'read' | 'delivered';
  createdAt: string;
}

interface StudentProgress {
  studentId: string;
  progress: string;
}

@Component({
  selector: 'app-nav-right',
  standalone: true,
  imports: [IconDirective, RouterModule, FormsModule, NgScrollbarModule, NgbNavModule, NgbDropdownModule, CommonModule],
  templateUrl: './nav-right.component.html',
  styleUrls: ['./nav-right.component.scss'],
})
export class NavRightComponent implements OnInit, OnDestroy {
  private iconService = inject(IconService);
  public authService = inject(AuthService);
  private dashboardService = inject(DashboardService);
  public modalService = inject(NgbModal);
  private router = inject(Router);
  private http = inject(HttpClient);
  private toastr = inject(ToastrService);
  private socket: any;
  studentProgress: StudentProgress[] = [];
  styleSelectorToggle = input<boolean>();
  Customize = output();
  windowWidth: number;
  screenFull: boolean = true;
  username: string = '';
  role: string = '';
  notifications: Notification[] = [];
  notificationCount: number = 0;
  filteredProfile: any[] = [];
  filteredSetting: any[] = [];

  // SIMPLE AUDIO: One object, pre-set
  private audio = new Audio('assets/notification.wav');
  private hasUserInteracted = false;  // NEW: Unlock flag
  private oldNotificationCount = 0;   // NEW: Track new notifs only
  private hasPlayedSound = false;
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
      CheckCircleOutline, GiftOutline, MessageOutline, SettingOutline, PhoneOutline,
      LogoutOutline, UserOutline, EditOutline, ProfileOutline, QuestionCircleOutline,
      LockOutline, CommentOutline, UnorderedListOutline, ArrowRightOutline,
      BellOutline, AppstoreOutline, CalendarOutline, BankOutline, GithubOutline, WalletOutline,
    ]);

    // SIMPLE SETUP: Preload audio
    this.audio.preload = 'auto';
    this.audio.volume = 0.7;
    this.audio.load();  // Start loading early

    // NEW: Unlock on ANY user click (global, once)
    document.addEventListener('click', () => {
      if (!this.hasUserInteracted) {
        this.hasUserInteracted = true;
        console.log('User clicked – audio unlocked!');  // Check console
      }
    }, { once: true });

    this.fetchPlans();
  }

  ngOnInit(): void {
    this.authService.getProfile().subscribe((profile) => {
      this.username = profile.data.name || 'Unknown Name';
      this.role = profile.data.role || 'Not Available';
      this.oldNotificationCount = 0;  // Reset count
      this.loadNotifications();
      this.filteredProfile = this.profile.filter(item => item.roles.includes(this.role));
      this.filteredSetting = this.setting;
      if (this.role === 'admin') {
        this.fetchSubscription();
      }
      this.connectSocket();
    });
  }
  private connectSocket() {
  // Import socket.io-client
    this.socket = io(environment.apiUrl, {
      withCredentials: true,
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });
    const userData = {
      id: this.authService.getUserId(),
      schoolId: this.authService.getSchoolId(),
      role: this.role
    };
    this.socket.on('connect', () => {
      this.socket.emit('join', {
      userId: this.authService.getUserId(),
      schoolId: this.authService.getSchoolId(),
      role: this.role
    });
    this.socket.emit('join-role', this.role);
    });

    this.socket.on('new-notification', (notif: any) => {
      console.log('Real-time notification!', notif);
      this.notifications.unshift(notif);
      this.notificationCount++;
      this.playNotificationSoundOnce();
      this.toastr.show(notif.message, notif.title, { timeOut: 5000 });
    });

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });
  }

  playNotificationSoundOnce() {
  if (this.hasPlayedSound) return;

  this.hasPlayedSound = true;

  this.playNotificationSound();

  // Reset after 3 seconds so next batch can play sound
  setTimeout(() => {
    this.hasPlayedSound = false;
  }, 3000);
}
directUpgrade(planValue: string) {
  this.selectedPlan = planValue;
  this.selectedPaymentMethod = 'razorpay';  // Auto select
  this.upgradePlan();  // Direct payment
}

  ngOnDestroy(): void {
    this.audio.pause();
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // SIMPLE PLAY: Only after unlock
  public playNotificationSound() {
    if (!this.hasUserInteracted) {
      console.log('Sound blocked: Need a click first.');  // Debug
      return;
    }

    this.audio.currentTime = 0;  // Restart
    this.audio.play().then(() => {
      console.log('Sound playing! 🎵');  // Success log
    }).catch((err) => {
      console.error('Play failed:', err);  // Error log
    });
  }


  // UPDATED: Only play if NEW notifs (not on every load)
  // loadNotifications() {
  //   const url = `${environment.apiUrl}/api/notifications/me`;

  //   this.http.get<any>(url).subscribe({
  //     next: (res) => {
  //       console.log(res)
  //       this.notifications = (res.notifications || []).filter(n =>
  //         ['announcement', 'assignment', 'progress-report', 'absence', 'fee-alert'].includes(n.type)
  //       );

  //       this.notificationCount = res.unreadCount || this.notifications.filter(n =>
  //         !['read', 'delivered'].includes(n.status)
  //       ).length;

  //       // NEW: Play ONLY if count increased (new notifs) AND unlocked
  //       if (this.notificationCount > this.oldNotificationCount && this.hasUserInteracted) {
  //         console.log(`New notifs! Old: ${this.oldNotificationCount}, New: ${this.notificationCount}`);
  //         setTimeout(() => this.playNotificationSound(), 200);  // Tiny delay for safety
  //       }
  //       this.oldNotificationCount = this.notificationCount;  // Update tracker
  //     },
  //     error: () => {
  //       this.notifications = [];
  //       this.notificationCount = 0;
  //       this.oldNotificationCount = 0;
  //     }
  //   });
  // }

loadNotifications() {
  const url = `${environment.apiUrl}/api/notifications/me`;

  this.http.get<any>(url).subscribe({
    next: (res) => {
      const notifications = res.notifications || [];

      const currentUserId = this.authService.getUserId();

      // DO NOT FILTER BY RECIPIENTID FIRST — IT KILLS EVERYTHING
      this.notifications = notifications;  // SHOW ALL

      // Just count unread
      this.notificationCount = notifications.filter(n => 
        n.status === 'pending' || n.status === 'sent'
      ).length;

      // Play sound for new ones
      if (this.notificationCount > this.oldNotificationCount && this.hasUserInteracted) {
        setTimeout(() => this.playNotificationSound(), 200);
      }
      this.oldNotificationCount = this.notificationCount;

      console.log('Notifications loaded:', this.notifications.length); // Debug
    },
    error: (err) => {
      console.error('Load notifications error:', err);
      this.notifications = [];
      this.notificationCount = 0;
    }
  });
}

  fetchPlans() {
    this.dashboardService.getPlans().subscribe({
      next: (data: any) => {
        this.plans = Object.keys(data).map(key => ({
          value: key,
          ...data[key]
        }));
        console.log('Plans loaded:', this.plans);
      },
      error: (error) => {
        console.error('Error fetching plans:', error);
        this.toastr.error('Failed to load plans');
      }
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
    const options = {
      key: environment.razorpayKey,
      amount: order.amount,
      currency: order.currency,
      name: 'School Management System',
      description: `Upgrade to ${plan.name}`,
      image: '/assets/images/logo.png',
      order_id: order.id,
      prefill: {
        name: this.username,
        email: this.authService.getUserEmail(),
        contact: ''
      },
      handler: (response: any) => {
        this.handlePaymentSuccess(response, subscriptionId);
      },
      modal: {
        ondismiss: () => {
          this.isLoading = false;
          this.toastr.info('Payment was cancelled. You can try again anytime.');
        this.dashboardService.cancelUpgrade({ orderId: order.id }).subscribe({
          next: (resp) => {
            console.log('Cleanup OK:', resp);
            this.fetchSubscription();  // Refresh to clear banner
            this.toastr.success('Upgrade cancelled – features restored!');
          },
          error: (err) => {
            console.error('Cleanup failed:', err);
            this.toastr.warning('Payment cancelled, but manual cleanup may be needed.');
            this.fetchSubscription();  // Still refresh
          }
        });          
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
    
    const verificationData = {
      ...paymentResponse,
      subscriptionId: subscriptionId
    };

    this.dashboardService.verifyPayment(verificationData).subscribe({
      next: (verificationResponse) => {
        console.log('Payment verified successfully:', verificationResponse);
        this.toastr.success('Subscription upgraded successfully!');
        
        this.fetchSubscription();
        
        this.modalService.dismissAll();
        this.isLoading = false;
        
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
        this.subscriptionData = data;
        const isActive = data.status === 'active';
        const isExpired = data.status === 'expired';
        const isPending = data.status === 'pending' ||data.hasPending;

        this.isExpiringSoon = data.daysRemaining !== undefined && data.daysRemaining <= 7 && isActive;
        this.isExpired = isExpired;
        this.isPending = isPending && !isActive;
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

  submitProgressReport() {
    if (this.role !== 'teacher') return;

    this.studentProgress = [];

    this.http.post(`${environment.apiUrl}/notifications/submit-progress-report`, { studentProgress: this.studentProgress }).subscribe({
      next: (response) => {
        this.toastr.success('Progress reports saved');
        this.studentProgress = [];
        console.log('Response:', response);
      },
      error: (err) => {
        this.toastr.error('Failed to save progress report: ' + err.message);
        console.error('Error:', err);
      }
    });
  }

  markNotificationAsRead(notificationId: string) {
    this.http.patch(`${environment.apiUrl}/api/notifications/${notificationId}/read`, {}).subscribe({
      next: () => {
        const notification = this.notifications.find(n => n._id === notificationId);
        if (notification) {
          notification.status = 'read';
          this.notificationCount = this.notifications.filter(n => n.status !== 'delivered' && n.status !== 'read').length;
        }
      },
      error: (err) => {
        this.toastr.error('Failed to mark notification as read: ' + (err.error?.error || err.message), 'Error');
      }
    });
  }

  markAsRead(notificationId: string) {
    const url = `${environment.apiUrl}/api/notifications/${notificationId}/read`;

    this.http.patch(url, {}).subscribe({
      next: () => {
        const notif = this.notifications.find(n => n._id === notificationId);
        if (notif) {
          notif.status = 'read';
          this.notificationCount = this.notifications.filter(n =>
            !['read', 'delivered'].includes(n.status)
          ).length;
        }
      },
      error: (err) => {
        this.toastr.error('Failed to mark as read');
        console.error(err);
      }
    });
  }

  // profile & setting arrays unchanged
  profile = [
    { icon: 'appstore', title: 'Academic Year', link: '/academic-year/details', roles: ['admin'] },
    { icon: 'calendar', title: 'Calendar', link: '/holiday-calendar', roles: ['admin'] },
    { icon: 'bank', title: 'Update School', link: '/school/school-modify', roles: ['admin'] },
    { icon: 'unordered-list', title: 'Profile List', link: '/settings/profiles', roles: ['admin'] },
    { icon: 'edit', title: 'Profile Update', link: '/settings/profile', roles: ['admin','teacher','student'] },
  ];

  setting = [
    { icon: 'question-circle', title: 'Support' },
    { icon: 'user', title: 'Account Settings' },
    { icon: 'lock', title: 'Privacy Center' },
    { icon: 'comment', title: 'Feedback' },
    { icon: 'unordered-list', title: 'History' },
  ];
}