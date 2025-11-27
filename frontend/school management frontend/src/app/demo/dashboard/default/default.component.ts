import { Component, OnInit, AfterViewInit, viewChild, inject, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgApexchartsModule, ChartComponent } from 'ng-apexcharts';
import { FormsModule } from '@angular/forms';
import { IconService } from '@ant-design/icons-angular';
import { FallOutline, GiftOutline, MessageOutline, RiseOutline, SettingOutline } from '@ant-design/icons-angular/icons';
import { ApexOptions } from 'ng-apexcharts';
import { DashboardService } from 'src/app/theme/shared/service/dashboard.service';
import { AuthService } from 'src/app/theme/shared/service/auth.service';
import { AcademicYearService } from '../../component/advance-component/academic-year/academic-year.service';
import { ClassSubjectService } from '../../component/advance-component/class-subject-management/class-subject.service';
import tableData from 'src/fake-data/default-data.json';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { environment } from 'src/environments/environment';
import { AnalyticEcommerce, MonthlyTrend, FeeDashboardData, TopDefaulter, Transaction, Class, PaymentMethod, ClassBreakdown, AcademicYear, StudentAttendanceData, TeacherDashboardData, FeeSummary } from './dashboard.model';
import { OrderByPipe } from "../../../theme/shared/interceptor/order.pipe";
import { ToastrService } from 'ngx-toastr';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { FeeService } from '../../component/advance-component/fee/fee.service';

@Component({
  selector: 'app-default',
  standalone: true,
  imports: [
    CommonModule,
    NgApexchartsModule,
    FormsModule,
    OrderByPipe
  ],
  templateUrl: './default.component.html',
  styleUrls: ['./default.component.scss']
})
export class DefaultComponent implements OnInit, AfterViewInit {
  managementChart = viewChild<ChartComponent>('managementChart');
  managementChartOptions: Partial<ApexOptions> = {
    chart: {
      height: 295,
      type: 'area',
      toolbar: { show: false },
      background: 'transparent',
      foreColor: '#333'
    },
    stroke: {
      curve: 'smooth',
      width: 2
    },
    dataLabels: { enabled: false },
    markers: {
      size: 4,
      colors: ['#fff'],
      strokeWidth: 2,
      strokeColors: ['#42a5f5', '#f2e41fff', '#ff7043']
    },
    series: [
      {
        name: 'Present',
        data: [],
        color: '#42a5f5'
      },
      {
        name: 'Late',
        data: [],
        color: '#f2e41fff'
      },
      {
        name: 'Absent',
        data: [],
        color: '#ff7043'
      }
    ],
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 0.8,
        type: 'vertical',
        opacityFrom: 0.7,
        opacityTo: 0.2,
        colorStops: [
          { offset: 0, color: '#42a5f5', opacity: 0.7 },
          { offset: 100, color: '#e0f7fa', opacity: 0.2 }
        ]
      }
    },
    xaxis: {
      categories: [],
      labels: {
        style: { colors: '#8c8c8c', fontFamily: 'Poppins, sans-serif' }
      },
      axisBorder: { show: true, color: '#e0e0e0' },
      axisTicks: { show: false }
    },
    yaxis: {
      min: 0,
      max: 1000,
      tickAmount: 5,
      labels: {
        style: { colors: '#8c8c8c', fontFamily: 'Poppins, sans-serif' },
        // formatter: (value) => Math.round(value / 10) * 10
      }
    },
    grid: {
      strokeDashArray: 4,
      borderColor: '#e0e0e0'
    },
    theme: {
      mode: 'light'
    },
    legend: {
      show: true,
      position: 'bottom',
      horizontalAlign: 'center',
      labels: { colors: '#333' }
    },
    tooltip: {
      theme: 'light',
      x: { show: true }
    }
  };

  private iconService = inject(IconService);
  private dashboardService = inject(DashboardService);
  private academicYearService = inject(AcademicYearService);
  private classSubjectService = inject(ClassSubjectService);
  public authService = inject(AuthService);
  private feeService=inject(FeeService)
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
  selectedPeriod: string = 'weekly';

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
  totalDefaultersCount: number = 0;
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
  totalStudent: number;
  totalTeacher: number;
  overallDue: number;
  overallPaid: number;

  // New property to check if user is admin
  isAdmin: boolean = false;

  constructor(private toastr:ToastrService) {
    
    this.iconService.addIcon(...[RiseOutline, FallOutline, SettingOutline, GiftOutline, MessageOutline]);
  }

  ngOnInit() {
    // Check user role immediately
    this.isAdmin = this.authService.getUserRole() === 'admin';

    if (this.isAdmin) {
      const today = new Date();
      this.selectedMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
      this.fetchClassesAndAcademicYears();
      this.fetchSubscription();
      this.fetchDataBasedOnRole();
    }
    // Else: No API calls or data fetching
  }

  fetchDataBasedOnRole() {
    const role = this.authService.getUserRole();
    if (role === 'admin') {
      this.fetchStudentAttendance();
      this.fetchTeacherDashboard();
      this.fetchFeeDashboard();
      this.fetchAllDashboardDetails();
    }
    // Else: No data fetching
  }

  fetchAllDashboardDetails() {
    this.dashboardService.getDashboardStats().subscribe(res => {
      this.totalStudent = res?.totalActiveStudents;
      this.totalTeacher = res?.totalActiveTeachers;
      this.overallDue = res?.overallDue;
      this.overallPaid = res.overallPaid;
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
          return;
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
            upi: { flow: 'intent', upi_intent: 'phonepe' }
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
    if (this.isAdmin) {
      this.isViewInitialized = true;
      setTimeout(() => this.updateCharts(), 100);
    }
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

    this.academicYearService.getAllAcademicYears(schoolId).subscribe({
      next: (data: AcademicYear[]) => {
        this.academicYears = data || [];
        if (!this.academicYears.length) {
          console.warn('No academic years found for schoolId:', schoolId);
          this.selectedAcademicYearId = '';
        } else {
          this.academicYearService.getActiveAcademicYear(schoolId).subscribe({
            next: (activeYear: AcademicYear) => {
              this.selectedAcademicYearId = activeYear?._id || this.academicYears[0]?._id || '';
              if (this.selectedAcademicYearId) {
                this.fetchFeeDashboard();
                this.fetchStudentAttendance();
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
    const params = {
      classId,
      academicYearId: this.selectedAcademicYearId,
      period: this.selectedPeriod,
      month: this.selectedMonth || undefined
    };
    this.dashboardService.getStudentAttendance(params).subscribe({
      next: (data: StudentAttendanceData) => {
        this.studentAttendanceData = data || {};
        this.totalStudents = data.totalStudents || 0;
        const attendance = data.attendance;
        this.studentPresent = attendance?.Present.reduce((a, b) => a + b, 0) || 0;
        this.studentAbsent = attendance?.Absent.reduce((a, b) => a + b, 0) || 0;
        const totalLate = attendance?.Late.reduce((a, b) => a + b, 0) || 0;
        this.updateManagementChartData(attendance.Present, attendance.Absent, attendance.Late, data.categories);
        this.prepareStudentChartData();
      },
      error: (error) => console.error('Error fetching student attendance:', error)
    });
  }

  fetchTeacherDashboard() { 
    this.dashboardService.getTeacherData().subscribe({
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
    this.dashboardService.getFeeDashboard(params).subscribe({
      next: (data: FeeDashboardData) => {
        this.summary = data.summary || { totalRemainingDue: 0, totalPaid: 0, overdueCount: 0, collectionRate: 0, invoiceCount: 0 };
        this.breakdownByClass = data.breakdownByClass || [];
        this.paymentMethods = data.paymentMethods || [];
        this.topDefaulters = data.topDefaulters || [];
        this.monthlyTrend = data.monthlyTrend || [];
        this.totalDefaultersCount = data.totalDefaultersCount || data.topDefaulters.length;
        this.prepareCharts();
      },
      error: (error) => console.error('Error fetching fee dashboard:', error)
    });
  }
  viewAllDefaulters() {
  // Naya route kholo jahan pura defaulter list dikhega
  // this.router.navigate(['/admin/fee/defaulters'], {
  //   queryParams: {
  //     month: this.selectedMonth || undefined,
  //     classId: this.selectedClassId || undefined,
  //     academicYearId: this.selectedAcademicYearId
  //   }
  // });
}

  updateManagementChartData(present: number[], absent: number[], late: number[], categories: string[]) {
    const maxLength = categories.length;
    const paddedPresent = [...present, ...Array(maxLength - present.length).fill(0)].slice(0, maxLength);
    const paddedAbsent = [...absent, ...Array(maxLength - absent.length).fill(0)].slice(0, maxLength);
    const paddedLate = [...late, ...Array(maxLength - late.length).fill(0)].slice(0, maxLength);

    this.managementChartOptions = {
      ...this.managementChartOptions,
      series: [
        { name: 'Present', data: paddedPresent, color: '#42a5f5' },
        { name: 'Late', data: paddedLate, color: '#f2e41fff' },
        { name: 'Absent', data: paddedAbsent, color: '#ff7043' }
      ],
      xaxis: {
        ...this.managementChartOptions.xaxis,
        categories: categories
      }
    };

    const allData = [...paddedPresent, ...paddedAbsent, ...paddedLate];
    const maxValue = Math.max(...allData, 10); // Minimum 10 to avoid scaling issues
    this.managementChartOptions.yaxis = {
      ...this.managementChartOptions.yaxis,
      max: Math.ceil(maxValue / 10) * 10 || 120 // Round up to nearest 10
    };

    if (this.isViewInitialized && this.managementChart()) {
      try {
        // Reset chart to clear previous state
        this.managementChart()?.updateOptions({
          series: [],
          xaxis: { categories: [] }
        }, false, true);
      } catch (error) {
        console.error('Error updating chart:', error);
      }
    }
  }

  onPeriodChange(period: string) {
    this.selectedPeriod = period;
    this.fetchStudentAttendance(this.selectedClassId);
  }

  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  sortTable(column: string, dataSource: string) {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    // Trigger change detection or re-render if needed
    // Note: The | orderBy pipe will handle the sorting if implemented
  }

  prepareCharts() {
    // Payment Method Chart (Doughnut)
    this.paymentMethodChartOptions = {
      chart: { type: 'pie', height: 300, toolbar: { show: false } },
      series: this.paymentMethods.length ? this.paymentMethods.map(m => m.totalAmount) : [1],
      labels: this.paymentMethods.length ? this.paymentMethods.map(m => m.method || 'Unknown') : ['No Data'],
      colors: ['#007BFF', '#198754', '#dc3545'], // Dashboard-aligned colors
      fill: {
        type: 'gradient',
        gradient: {
          shade: 'light',
          type: 'vertical',
          opacityFrom: 0.8,
          opacityTo: 0.4,
          stops: [0, 100]
        }
      },
      dataLabels: {
        enabled: true,
        formatter: (val) => `${val}%`,
        style: { colors: ['#fff'], fontSize: '12px', fontFamily: 'Poppins, sans-serif' }
      },
      legend: {
        position: 'bottom',
        fontSize: '12px',
        fontFamily: 'Poppins, sans-serif',
        labels: { colors: '#333' }
      },
      plotOptions: {
        pie: {
          donut: {
            size: '65%',
            labels: {
              show: true,
              name: { show: false },
              value: {
                show: true,
                fontSize: '20px',
                fontFamily: 'Poppins, sans-serif',
                color: '#333',
                formatter: () => {
                  const total = this.paymentMethods.reduce((sum, m) => sum + m.totalAmount, 0);
                  return total ? `Total: ₹${total.toLocaleString()}` : 'No Data';
                }
              }
            }
          }
        }
      },
      responsive: [{ breakpoint: 480, options: { chart: { height: 200 }, plotOptions: { pie: { donut: { size: '50%' } } } } }]
    };

    // Monthly Trend Chart (Line with Enhancements)
    this.monthlyTrendChartOptions = {
      chart: {
        type: 'line',
        height: 250,
        toolbar: { show: false },
        foreColor: '#333'
      },
      series: [
        { name: 'Paid', data: this.monthlyTrend.map(t => t.totalPaid || 0), color: '#007BFF' },
        { name: 'Remaining Due', data: this.monthlyTrend.map(t => t.totalRemainingDue || 0), color: '#dc3545' }
      ],
      stroke: {
        curve: 'smooth',
        width: 3,
        colors: ['#007BFF', '#dc3545']
      },
      fill: {
        type: 'gradient',
        gradient: {
          shade: 'light',
          type: 'vertical',
          shadeIntensity: 0.5,
          gradientToColors: ['#a0afe8', '#f8d7da'], // Lighter gradients
          opacityFrom: 0.7,
          opacityTo: 0.3,
          stops: [0, 100]
        }
      },
      markers: {
        size: 5,
        colors: ['#007BFF', '#dc3545'],
        strokeWidth: 2,
        strokeColors: '#fff',
        hover: { size: 7 }
      },
      xaxis: {
        categories: this.monthlyTrend.map(t => t.month || 'Unknown'),
        labels: {
          style: {
            colors: '#666',
            fontSize: '12px',
            fontFamily: 'Poppins, sans-serif'
          }
        },
        axisBorder: { show: true, color: '#e0e0e0' },
        axisTicks: { show: false }
      },
      yaxis: {
        labels: {
          style: {
            colors: '#666',
            fontSize: '12px',
            fontFamily: 'Poppins, sans-serif'
          },
          formatter: (value) => `₹${value.toLocaleString()}` // Currency formatting
        }
      },
      grid: {
        borderColor: '#e0e0e0',
        strokeDashArray: 4
      },
      legend: {
        position: 'bottom',
        fontSize: '12px',
        fontFamily: 'Poppins, sans-serif',
        labels: { colors: '#333' }
      },
      tooltip: {
        theme: 'light',
        y: {
          formatter: (value) => `₹${value.toLocaleString()}`
        }
      },
      responsive: [{ breakpoint: 480, options: { chart: { height: 200 } } }]
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
      series: attendance ? [attendance.Present || 0, attendance.Absent || 0, attendance.Late || 0] : [0, 0, 0],
      colors: ['#36A2EB', '#FF6384', '#FFCE56'],
      legend: { position: 'bottom', fontSize: '12px', fontFamily: 'Helvetica, Arial, sans-serif', labels: { colors: '#FFFFFF' } },
      responsive: [{ breakpoint: 480, options: { chart: { width: 150 }, legend: { position: 'bottom' } } }]
    };
    if (this.isViewInitialized) {
      setTimeout(() => {
        if (this.studentChart()) this.studentChart()?.updateOptions(this.studentChartOptions, true);
        else console.warn('Student chart component not initialized');
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
        if (this.teacherChart()) this.teacherChart()?.updateOptions(this.teacherChartOptions, true);
        else console.warn('Teacher chart component not initialized');
      }, 100);
    }
  }

  updateCharts() {
    if (this.studentChart() && this.studentChartOptions.series) this.studentChart()?.updateOptions(this.studentChartOptions, true);
    else console.warn('Student chart not updated: component or options missing');
    if (this.teacherChart() && this.teacherChartOptions.series) this.teacherChart()?.updateOptions(this.teacherChartOptions, true);
    else console.warn('Teacher chart not updated: component or options missing');
    if (this.paymentMethodChart() && this.paymentMethodChartOptions.series) this.paymentMethodChart()?.updateOptions(this.paymentMethodChartOptions, true);
    else console.warn('Payment method chart not updated: component or options missing');
    if (this.monthlyTrendChart() && this.monthlyTrendChartOptions.series) this.monthlyTrendChart()?.updateOptions(this.monthlyTrendChartOptions, true);
    else console.warn('Monthly trend chart not updated: component or options missing');
  }

  onClassChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    this.selectedClassId = target.value;
    this.fetchStudentAttendance(this.selectedClassId);
    this.fetchFeeDashboard();
  }

  onFilterChange() {
    this.fetchFeeDashboard();
  }

  generateReceipts() {
  if (this.totalDefaultersCount === 0) {
    this.toastr.warning('No defaulters found!');
    return;
  }

  const payload = {
    schoolId: this.authService.getUserSchoolId(),
    className: this.selectedClassId 
      ? this.classes.find(c => c._id === this.selectedClassId)?.name 
      : null,
    month: this.selectedMonth,
    academicYearId: this.selectedAcademicYearId
  };

  // Important: responseType: 'blob'
  this.dashboardService.generateClassReceipts(payload).subscribe({
    next: (blob: Blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Defaulter_Receipts_${new Date().toISOString().slice(0,10)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      this.toastr.success('Defaulter receipts downloaded successfully!');
    },
    error: (error: any) => {
      console.error('Receipt generation failed:', error);
      this.toastr.error('Failed to generate receipts. Please try again.');
    }
  });
}

 // dashboard.component.ts
sendSMSReminders() {
  this.toastr.info('SMS Reminder feature is coming soon!', 'Feature Update', {
    timeOut: 5000,
    positionClass: 'toast-top-right'
  });
  return;
  if (confirm('Send SMS to ' + this.totalDefaultersCount + ' defaulters?')) {
    this.dashboardService.sendDefaulterSMS({
      message: 'Dear Parent, Fee due alert...'
    }).subscribe((res:any) => {
      this.toastr.success(`${res.sent} SMS sent! ${res.remainingSMS} left`);
    });
  }
}
// Export Defaulters to Excel with full details
exportDefaultersExcel() {
  if (this.topDefaulters.length === 0) {
    this.toastr.warning('No defaulters to export!');
    return;
  }

  // Prepare clean data
  const exportData = this.topDefaulters.map((d, index) => ({
    'S.No': index + 1,
    'Student Name': d.studentName || '-',
    'Admission No': d.admissionNo || '-',
    'Class': d.className || '-',
    'Parent Phone': d.parentPhone || 'Not Available',
    'Total Due (₹)': d.remainingDue || 0,
    'Due Since': this.formatDueMonths(d.dueMonths) // Optional helper
  }));

  // Create worksheet
  const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(exportData);

  // Auto-size columns
  const colWidths = exportData.reduce((acc: any[], row: any) => {
    Object.keys(row).forEach((key, i) => {
      const value = String(row[key]);
      const length = value.length;
      acc[i] = Math.max(acc[i] || 12, length + 4);
    });
    return acc;
  }, []);
  ws['!cols'] = colWidths.map(w => ({ width: w }));

  // Create workbook
  const wb: XLSX.WorkBook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Defaulters');

  // Generate Excel file
  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const data = new Blob([excelBuffer], { type: 'application/octet-stream' });

  // Download
  const fileName = `Defaulters_Report_${new Date().toISOString().slice(0,10)}.xlsx`;
  saveAs(data, fileName);

  this.toastr.success(`${this.topDefaulters.length} defaulters exported to Excel!`, 'Success');
}

// Optional: Format due months nicely
private formatDueMonths(months: string[] | undefined): string {
  if (!months || months.length === 0) return 'This Month';
  return months.join(', ');
}

// Helper function for Excel export
// private exportToExcel(data: any[], filename: string) {
//   const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(data);
//   const wb: XLSX.WorkBook = XLSX.utils.book_new();
//   XLSX.utils.book_append_sheet(wb, ws, 'Defaulters');
  
//   // Auto-size columns
//   const colWidths = data.reduce((acc: any[], row: any) => {
//     Object.keys(row).forEach((key, i) => {
//       const length = String(row[key]).length;
//       acc[i] = Math.max(acc[i] || 10, length + 2);
//     });
//     return acc;
//   }, []);
//   ws['!cols'] = colWidths.map(w => ({ width: w }));

//   XLSX.writeFile(wb, `${filename}.xlsx`);
// }

  createAcademicYear() {
    console.log('Navigate to create academic year page or trigger API call');
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