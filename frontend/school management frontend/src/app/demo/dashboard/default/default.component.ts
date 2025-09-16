import { Component, OnInit, AfterViewInit, viewChild, inject, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { NgApexchartsModule, ChartComponent } from 'ng-apexcharts';
import { FormsModule } from '@angular/forms';
import { CardComponent } from 'src/app/theme/shared/components/card/card.component';
import { IconService, IconDirective } from '@ant-design/icons-angular';
import { FallOutline, GiftOutline, MessageOutline, RiseOutline, SettingOutline } from '@ant-design/icons-angular/icons';
import { ApexOptions } from 'ng-apexcharts';
import { DashboardService } from 'src/app/theme/shared/service/dashboard.service';
import { AuthService } from 'src/app/theme/shared/service/auth.service';
import { AcademicYearService } from '../../component/advance-component/academic-year/academic-year.service';
import { ClassSubjectService } from '../../component/advance-component/class-subject-management/class-subject.service';
import { MonthlyBarChartComponent } from 'src/app/theme/shared/apexchart/monthly-bar-chart/monthly-bar-chart.component';
import { IncomeOverviewChartComponent } from 'src/app/theme/shared/apexchart/income-overview-chart/income-overview-chart.component';
import { AnalyticsChartComponent } from 'src/app/theme/shared/apexchart/analytics-chart/analytics-chart.component';
import { SalesReportChartComponent } from 'src/app/theme/shared/apexchart/sales-report-chart/sales-report-chart.component';
import tableData from 'src/fake-data/default-data.json';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { environment } from 'src/environments/environment';
import {AnalyticEcommerce,MonthlyTrend,FeeDashboardData,TopDefaulter,Transaction,Class,PaymentMethod,ClassBreakdown,AcademicYear,StudentAttendanceData,TeacherDashboardData,FeeSummary} from './dashboard.model'

@Component({
  selector: 'app-default',
  standalone: true,
  imports: [
    CommonModule,
    CardComponent,
    IconDirective,
    MonthlyBarChartComponent,
    IncomeOverviewChartComponent,
    AnalyticsChartComponent,
    SalesReportChartComponent,
    NgApexchartsModule,
    FormsModule,
  ],
  templateUrl: './default.component.html',
  styleUrls: ['./default.component.scss']
})
export class DefaultComponent implements OnInit, AfterViewInit {
   managementChartOptions: Partial<ApexOptions> = {
    chart: {
      type: 'area',
      height: 300,
      toolbar: { show: false }
    },
    stroke: {
      curve: 'smooth',
      width: 3
    },
    dataLabels: { enabled: false },
    markers: {
      size: 6,
      colors: ['#fff'],
      strokeWidth: 3,
      strokeColors: ['#ff7043']
    },
    series: [
      {
        name: 'Present',
        data: [50, 45, 70, 55, 48, 42],
        color: '#42a5f5'
      },
      {
        name: 'Late',
        data: [30, 40, 50, 35, 45, 38],
        color: '#f2e41fff'
      },
      {
        name: 'Absent',
        data: [20, 25, 40, 28, 36, 30],
        color: '#ff7043'
      }
    ],
    fill: {
  type: "gradient",
    gradient: {
      shadeIntensity: 1,
      type: "vertical",
      opacityFrom: 0.6,
      opacityTo: 0.09,
      colorStops: [
    { offset: 0, color: '#2C3E50', opacity: 1 },    // Start color
    { offset: 100, color: '#3498DB', opacity: 1 }   // End color
  ],
  },
},

    xaxis: {
      categories: ['Week1', 'Week2', 'Week3', 'Week4', 'Week5', 'Week6'],
      labels: { style: { colors: '#666' } },
      axisBorder: { show: false },
      axisTicks: { show: false }
    },
    yaxis: {
      min: 0,
      max: 120,
      tickAmount: 6,
      labels: { style: { colors: '#666' } }
    },
    grid: {
      borderColor: '#eee',
      strokeDashArray: 4
    },
    legend: { show: false }
  };
  private iconService = inject(IconService);
  private dashboardService = inject(DashboardService);
  private academicYearService = inject(AcademicYearService);
  private classSubjectService = inject(ClassSubjectService);
  public authService = inject(AuthService);
  public modalService = inject(NgbModal);
  subscriptionData: any = {};
  isExpiringSoon: boolean = false;
  isExpired: boolean = false;
  isPending: boolean = false;
  selectedPlan: string = 'basic';
  plans = [
    { value: 'basic', name: 'Basic', price: 500, features: ['Up to 5 users', 'Basic features', '1 year support'] },
    { value: 'premium', name: 'Premium', price: 1000, features: ['Unlimited users', 'All features', 'Priority support'] }
  ];
  recentOrder = tableData;
  AnalyticEcommerce: AnalyticEcommerce[] = [
    { title: 'Total Page Views', amount: '4,42,236', background: 'bg-light-primary', border: 'border-primary', icon: 'rise', percentage: '59.3%', color: 'text-primary', number: '35,000' },
    { title: 'Total Users', amount: '78,250', background: 'bg-light-primary', border: 'border-primary', icon: 'rise', percentage: '70.5%', color: 'text-primary', number: '8,900' },
    { title: 'Total Order', amount: '18,800', background: 'bg-light-warning', border: 'border-warning', icon: 'fall', percentage: '27.4%', color: 'text-warning', number: '1,943' },
    { title: 'Total Sales', amount: '$35,078', background: 'bg-light-warning', border: 'border-warning', icon: 'fall', percentage: '27.4%', color: 'text-warning', number: '$20,395' }
  ];
  transaction: Transaction[] = [
    { background: 'text-success bg-light-success', icon: 'gift', title: 'Order #002434', time: 'Today, 2:00 AM', amount: '+ $1,430', percentage: '78%' },
    { background: 'text-primary bg-light-primary', icon: 'message', title: 'Order #984947', time: '5 August, 1:45 PM', amount: '- $302', percentage: '8%' },
    { background: 'text-danger bg-light-danger', icon: 'setting', title: 'Order #988784', time: '7 hours ago', amount: '- $682', percentage: '16%' }
  ];

  studentAttendanceData: StudentAttendanceData = {};
  totalStudents: number = 0;
  studentPresent: number = 0;
  studentAbsent: number = 0;
  classes: Class[] = [];
  selectedClassId: string = '';
  studentChartOptions: Partial<ApexOptions> = {};
  studentChart = viewChild<ChartComponent>('studentChart');

  teacherDashboardData: TeacherDashboardData = {};
  totalTeachers: number = 0;
  teacherPresent: number = 0;
  teacherAbsent: number = 0;
  teacherOnLeave: number = 0;
  pendingLeaveRequests: number = 0;
  autoGeneratedAbsences: number = 0;
  averageLeaveBalance: number = 0;
  isHoliday: boolean = false;
  teacherChartOptions: Partial<ApexOptions> = {};
  teacherChart = viewChild<ChartComponent>('teacherChart');

  summary: FeeSummary = { totalRemainingDue: 0, totalPaid: 0, overdueCount: 0, collectionRate: 0, invoiceCount: 0 };
  breakdownByClass: ClassBreakdown[] = [];
  paymentMethods: PaymentMethod[] = [];
  topDefaulters: TopDefaulter[] = [];
  monthlyTrend: MonthlyTrend[] = [];
  academicYears: AcademicYear[] = [];
  selectedMonth: string = '';
  selectedAcademicYearId: string = '';
    selectedPaymentMethod: string = 'razorpay';
    paymentProof: File | null = null;
    bankDetails: any = null;
  subscriptionId: string | null = null;
  paymentMethodChart = viewChild<ChartComponent>('paymentMethodChart');
  monthlyTrendChart = viewChild<ChartComponent>('monthlyTrendChart');
  paymentMethodChartOptions: Partial<ApexOptions> = {};
  monthlyTrendChartOptions: Partial<ApexOptions> = {};
  isViewInitialized: boolean = false;

  constructor() {
    this.iconService.addIcon(...[RiseOutline, FallOutline, SettingOutline, GiftOutline, MessageOutline]);
  }

  ngOnInit() {
    const today = new Date();
    this.selectedMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    this.fetchClassesAndAcademicYears();
    this.fetchSubscription();
    this.fetchDataBasedOnRole();
  }
  fetchDataBasedOnRole() {
    const role = this.authService.getUserRole();
    if (role === 'teacher') {
      this.fetchStudentAttendance(); // Only fetch student attendance for teachers
    } else {
      // Admin role: fetch all data
      this.fetchStudentAttendance();
      this.fetchTeacherDashboard();
      this.fetchFeeDashboard();
    }
  }

  fetchSubscription() {
    this.dashboardService.getSubscription().subscribe({
      next: (data: any) => {
        console.log(data)
        this.subscriptionData = data;
        this.isExpiringSoon = data.isExpiringSoon;
        this.isExpired = data.subscriptionStatus === 'expired';
        this.isPending = data.subscriptionStatus === 'pending';
      },
      error: (error) => console.error('Error fetching subscription:', error)
    });
  }

  openUpgradeModal(template: TemplateRef<any>) {
      this.selectedPaymentMethod = 'razorpay'; // Reset to default payment method
      this.paymentProof = null; // Reset file
      this.bankDetails = null; // Reset bank details
      this.subscriptionId = null; // Reset subscription ID
      this.modalService.open(template, {
        centered: true,
        size: 'lg',
        windowClass: 'custom-modal',
        backdrop: 'static'
      });
    }

  onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length) {
      this.paymentProof = input.files[0];
    }
  }

  upgradePlan() {
    this.dashboardService.upgradeSubscription({
      planType: this.selectedPlan,
      paymentMethod: this.selectedPaymentMethod
    }).subscribe({
      next: (response: any) => {
        if (this.selectedPaymentMethod === 'bank_transfer') {
          this.bankDetails = response.bankDetails;
          this.subscriptionId = response.subscriptionId;
          return; // Wait for proof upload
        }

        const { order } = response;
        const options = {
          key: environment.razorpayKey,
          amount: order.amount,
          currency: order.currency,
          name: 'School Management',
          description: `Upgrade to ${this.selectedPlan}`,
          order_id: order.id,
          handler: (paymentResponse: any) => {
            this.verifyPayment(paymentResponse);
          },
          theme: { color: '#4a90e2' },
          ...(this.selectedPaymentMethod === 'phonepe' && {
            upi: { flow: 'intent', upi_intent: 'phonepe' } // PhonePe UPI intent
          })
        };
        const rzp = new (window as any).Razorpay(options);
        rzp.on('payment.failed', (response: any) => {
          console.error('Payment failed:', response.error);
          alert('Payment failed. Please try again.');
        });
        rzp.open();
      },
      error: (error) => {
        console.error('Error initiating upgrade:', error);
        alert('Failed to initiate payment. Please try again.');
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

  verifyPayment(paymentResponse: any) {
    this.dashboardService.verifyPayment(paymentResponse).subscribe({
      next: () => {
        alert('Subscription upgraded successfully!');
        this.fetchSubscription();
        this.modalService.dismissAll();
      },
      error: (error) => {
        console.error('Payment verification failed:', error);
        alert('Payment verification failed. Please contact support.');
      }
    });
  }

  ngAfterViewInit() {
    this.isViewInitialized = true;
    setTimeout(() => this.updateCharts(), 100); // Increased delay for safety
  }

  fetchClassesAndAcademicYears() {
    const schoolId = this.authService.getUserSchoolId() || '';
    if (!schoolId) {
      console.error('No schoolId found in authService. Please ensure user is authenticated.');
      this.classes = [];
      this.academicYears = [];
      return;
    }

    this.classSubjectService.getClassesBySchool(schoolId).subscribe({
      next: (data: Class[]) => {
        this.classes = data || [];
        if (!this.classes.length) {
          console.warn('No classes found for schoolId:', schoolId);
        }
      },
      error: (error) => {
        console.error('Error fetching classes:', error);
        this.classes = [];
      }
    });

    // Fetch academic years
    this.academicYearService.getAllAcademicYears(schoolId).subscribe({
      next: (data: AcademicYear[]) => {
        this.academicYears = data || [];
        console.log('Fetched academic years:', this.academicYears);
        if (!this.academicYears.length) {
          console.warn('No academic years found for schoolId:', schoolId);
          this.selectedAcademicYearId = '';
        } else {
          this.academicYearService.getActiveAcademicYear(schoolId).subscribe({
            next: (activeYear: AcademicYear) => {
              this.selectedAcademicYearId = activeYear?._id || this.academicYears[0]?._id || '';
              console.log('Selected academic year ID:', this.selectedAcademicYearId);
              if (this.selectedAcademicYearId) {
                this.fetchFeeDashboard();
                this.fetchStudentAttendance(); // Ensure student attendance is fetched with academicYearId
              } else {
                console.warn('No active academic year found for schoolId:', schoolId);
              }
            },
            error: (error) => {
              console.error('Error fetching active academic year:', error);
              this.selectedAcademicYearId = '';
            }
          });
        }
      },
      error: (error) => {
        console.error('Error fetching academic years:', error);
        this.academicYears = [];
      }
    });
  }

  fetchStudentAttendance(classId: string = '') {
  const params = this.selectedAcademicYearId ? { classId, academicYearId: this.selectedAcademicYearId } : { classId };
  if (this.authService.getUserRole() === 'admin')
  this.dashboardService.getStudentAttendance(params).subscribe({
    next: (data: StudentAttendanceData) => {
      this.studentAttendanceData = data || {};
      this.totalStudents = data.totalStudents || 0;
      const attendance = classId ? data.classAttendance : data.overallAttendance;
      this.studentPresent = attendance?.Present || 0;
      this.studentAbsent = this.totalStudents - this.studentPresent;
      this.prepareStudentChartData();
      console.log('Fetched student attendance:', data);
    },
    error: (error) => console.error('Error fetching student attendance:', error)
  });
}

  fetchTeacherDashboard() {
    this.dashboardService.getTeacherDashboard().subscribe({
      next: (data: TeacherDashboardData) => {
        this.teacherDashboardData = data || {};
        this.totalTeachers = data.totalTeachers || 0;
        this.teacherPresent = data.presentToday || 0;
        this.teacherAbsent = data.absentToday || 0;
        this.teacherOnLeave = data.onLeaveToday || 0;
        this.pendingLeaveRequests = data.pendingLeaveRequests || 0;
        this.autoGeneratedAbsences = data.autoGeneratedAbsences || 0;
        this.averageLeaveBalance = data.averageLeaveBalance || 0;
        this.isHoliday = data.isHoliday || false;
        this.prepareTeacherChartData();
      },
      error: (error) => console.error('Error fetching teacher dashboard:', error)
    });
  }

  fetchFeeDashboard() {
  if (!this.selectedAcademicYearId) {
    console.warn('No academic year selected, skipping fee dashboard fetch');
    return;
  }
  const params = {
    month: this.selectedMonth,
    classId: this.selectedClassId || undefined,
    academicYearId: this.selectedAcademicYearId
  };
  console.log('Fetching fee dashboard with params:', params);
  this.dashboardService.getFeeDashboard(params).subscribe({
    next: (data: FeeDashboardData) => {
      this.summary = data.summary || { totalRemainingDue: 0, totalPaid: 0, overdueCount: 0, collectionRate: 0, invoiceCount: 0 };
      this.breakdownByClass = data.breakdownByClass || [];
      this.paymentMethods = data.paymentMethods || [];
      this.topDefaulters = data.topDefaulters || [];
      this.monthlyTrend = data.monthlyTrend || [];
      console.log('Fetched fee dashboard data:', data);
      console.log('Filtered breakdownByClass:', this.breakdownByClass.filter(b => !this.selectedClassId || b.classId === this.selectedClassId));
      this.prepareCharts();
    },
    error: (error) => console.error('Error fetching fee dashboard:', error)
  });
}

  prepareCharts() {
    this.paymentMethodChartOptions = {
      chart: { type: 'pie', height: 300, toolbar: { show: false } },
      series: this.paymentMethods.length ? this.paymentMethods.map(m => m.totalAmount) : [1],
      labels: this.paymentMethods.length ? this.paymentMethods.map(m => m.method || 'Unknown') : ['No Data'],
      colors: ['#36A2EB', '#FF6384', '#FFCE56'],
      legend: { position: 'bottom', labels: { colors: '#FFFFFF' } },
      responsive: [{ breakpoint: 480, options: { chart: { height: 200 } } }]
    };

    this.monthlyTrendChartOptions = {
      chart: {
        type: 'line',
        height: 250,
        toolbar: { show: false },
        foreColor: '#FFFFFF',
      },
      series: [
        { name: 'Paid', data: this.monthlyTrend.map(t => t.totalPaid || 0) },
        { name: 'Remaining Due', data: this.monthlyTrend.map(t => t.totalRemainingDue || 0) }
      ],
      xaxis: {
        categories: this.monthlyTrend.map(t => t.month || 'Unknown'),
        labels: {
          style: {
            colors: ['#FFFFFF'],
            fontSize: '12px',
            fontFamily: 'Poppins, sans-serif',
          }
        }
      },
      yaxis: {
        labels: {
          style: {
            colors: ['blue'],
            fontSize: '12px',
            fontFamily: 'Poppins, sans-serif',
          }
        }
      },
      colors: ['#36A2EB', '#FF6384'],
      legend: {
        position: 'bottom',
        labels: {
          colors: '#FFFFFF',
        }
      },
      tooltip: {
        theme: 'dark'
      },
      grid: {
        borderColor: '#4A6FA5'
      },
      responsive: [
        {
          breakpoint: 480,
          options: {
            chart: { height: 200 }
          }
        }
      ]
    };

    if (this.isViewInitialized) {
      this.updateCharts();
    }
  }

  prepareStudentChartData() {
    const attendance = this.selectedClassId ? this.studentAttendanceData?.classAttendance : this.studentAttendanceData?.overallAttendance;
    this.studentChartOptions = {
      chart: { type: 'pie', height: 220, toolbar: { show: false } },
      labels: ['Present', 'Absent', 'Late'],
      series: attendance ? [attendance.Present || 0, this.studentAbsent || 0, attendance.Late || 0] : [0, 0, 0],
      colors: ['#36A2EB', '#FF6384', '#FFCE56'],
      legend: { position: 'bottom', fontSize: '12px', fontFamily: 'Helvetica, Arial, sans-serif', labels: { colors: '#FFFFFF' } },
      responsive: [{ breakpoint: 480, options: { chart: { width: 150 }, legend: { position: 'bottom' } } }]
    };
    if (this.isViewInitialized) {
      setTimeout(() => {
        if (this.studentChart()) {
          this.studentChart()?.updateOptions(this.studentChartOptions, true);
        } else {
          console.warn('Student chart component not initialized');
        }
      }, 100);
    }
  }

  prepareTeacherChartData() {
    this.teacherChartOptions = {
      chart: { type: 'pie', height: 220, toolbar: { show: false } },
      labels: ['Present', 'Absent', 'On Leave'],
      series: this.teacherDashboardData ? [this.teacherPresent, this.teacherAbsent, this.teacherOnLeave] : [0, 0, 0],
      colors: ['#36A2EB', '#FF6384', '#FFCE56'],
      legend: { position: 'bottom', fontSize: '12px', fontFamily: 'Helvetica, Arial, sans-serif', labels: { colors: '#FFFFFF' } },
      responsive: [{ breakpoint: 480, options: { chart: { width: 150 }, legend: { position: 'bottom' } } }]
    };
    if (this.isViewInitialized) {
      setTimeout(() => {
        if (this.teacherChart()) {
          this.teacherChart()?.updateOptions(this.teacherChartOptions, true);
        } else {
          console.warn('Teacher chart component not initialized');
        }
      }, 100);
    }
  }

  updateCharts() {
    if (this.studentChart() && this.studentChartOptions.series) {
      this.studentChart()?.updateOptions(this.studentChartOptions, true);
    } else {
      console.warn('Student chart not updated: component or options missing');
    }
    if (this.teacherChart() && this.teacherChartOptions.series) {
      this.teacherChart()?.updateOptions(this.teacherChartOptions, true);
    } else {
      console.warn('Teacher chart not updated: component or options missing');
    }
    if (this.paymentMethodChart() && this.paymentMethodChartOptions.series) {
      this.paymentMethodChart()?.updateOptions(this.paymentMethodChartOptions, true);
    } else {
      console.warn('Payment method chart not updated: component or options missing');
    }
    if (this.monthlyTrendChart() && this.monthlyTrendChartOptions.series) {
      this.monthlyTrendChart()?.updateOptions(this.monthlyTrendChartOptions, true);
    } else {
      console.warn('Monthly trend chart not updated: component or options missing');
    }
  }

  onClassChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    this.selectedClassId = target.value;
    console.log('Selected classId:', this.selectedClassId);
    this.fetchStudentAttendance(this.selectedClassId);
    this.fetchFeeDashboard();
  }

  onFilterChange() {
    console.log('Filter changed:', { month: this.selectedMonth, classId: this.selectedClassId, academicYearId: this.selectedAcademicYearId });
    this.fetchFeeDashboard();
  }

  generateReceipts() {
    console.log('Generate receipts for', this.selectedClassId, this.selectedMonth);
    // Implement endpoint call to generateClassReceipts
  }

  sendSMSReminders() {
    console.log('Send SMS reminders for defaulters');
    // Implement endpoint call for SMS
  }

  exportData() {
    console.log('Export data as CSV/PDF');
    // Implement export logic
  }

  createAcademicYear() {
    console.log('Navigate to create academic year page or trigger API call');
    // Placeholder: Implement navigation or API call to create academic year
  }

  getMonthsForYear(): { value: string; label: string }[] {
    const months = [
      { value: '-01', label: 'January' },
      { value: '-02', label: 'February' },
      { value: '-03', label: 'March' },
      { value: '-04', label: 'April' },
      { value: '-05', label: 'May' },
      { value: '-06', label: 'June' },
      { value: '-07', label: 'July' },
      { value: '-08', label: 'August' },
      { value: '-09', label: 'September' },
      { value: '-10', label: 'October' },
      { value: '-11', label: 'November' },
      { value: '-12', label: 'December' }
    ];
    const selectedYear = this.academicYears.find(y => y._id === this.selectedAcademicYearId);
    if (!selectedYear) return months.map(m => ({ value: `2025${m.value}`, label: m.label }));
    
    const startDate = new Date(selectedYear.startDate);
    const endDate = new Date(selectedYear.endDate);
    const year = startDate.getFullYear();
    return months
      .filter(m => {
        const monthDate = new Date(`${year}${m.value}-01`);
        return monthDate >= startDate && monthDate <= endDate;
      })
      .map(m => ({ value: `${year}${m.value}`, label: m.label }));
  }
}