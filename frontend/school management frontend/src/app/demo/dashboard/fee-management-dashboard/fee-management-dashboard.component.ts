import { Component, Input, SimpleChanges, viewChild } from '@angular/core';
import { ClassBreakdown, FeeSummary, MonthlyTrend, PaymentMethod, TopDefaulter } from '../default/dashboard.model';
import { ApexOptions, ChartComponent, NgApexchartsModule } from 'ng-apexcharts';
import { Subject, takeUntil } from 'rxjs';
import { DashboardService } from 'src/app/theme/shared/service/dashboard.service';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { OrderByPipe } from 'src/app/theme/shared/interceptor/order.pipe';

@Component({
  selector: 'app-fee-management-dashboard',
  imports: [CommonModule, NgApexchartsModule, OrderByPipe],
  templateUrl: './fee-management-dashboard.component.html',
  styleUrl: './fee-management-dashboard.component.scss'
})
export class FeeManagementDashboardComponent {
@Input() selectedMonth: string = '';
  @Input() selectedAcademicYearId: string = '';
  @Input() selectedClassId: string = '';

  summary: FeeSummary = { totalRemainingDue: 0, totalPaid: 0, overdueCount: 0, collectionRate: 0, invoiceCount: 0 };
  breakdownByClass: ClassBreakdown[] = [];
  paymentMethods: PaymentMethod[] = [];
  topDefaulters: TopDefaulter[] = [];
  monthlyTrend: MonthlyTrend[] = [];
  paymentMethodChart = viewChild<ChartComponent>('paymentMethodChart');
  monthlyTrendChart = viewChild<ChartComponent>('monthlyTrendChart');
  paymentMethodChartOptions: Partial<ApexOptions> = {};
  monthlyTrendChartOptions: Partial<ApexOptions> = {};
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';
  private destroyed$ = new Subject<void>();

  constructor(private dashboardService: DashboardService) {}

  ngOnInit() {
    this.fetchFeeDashboard();
  }

  ngOnChanges(changes: SimpleChanges) {
    const monthChanged = changes['selectedMonth'] && !changes['selectedMonth'].firstChange;
    const yearChanged = changes['selectedAcademicYearId'] && !changes['selectedAcademicYearId'].firstChange;
    const classChanged = changes['selectedClassId'] && !changes['selectedClassId'].firstChange;

    if (monthChanged || yearChanged || classChanged) {
      console.log('Input changed, refetching fee dashboard:', changes);
      this.fetchFeeDashboard();
    }
  }

  ngOnDestroy(): void {
    this.destroyed$.next();
    this.destroyed$.complete();
  }

  fetchFeeDashboard() {
    if (!this.selectedAcademicYearId) {
      console.warn('No academic year selected, skipping fee dashboard fetch');
      this.resetData();
      return;
    }

    // Ensure selectedMonth is in a valid format (YYYY-MM)
    const month = this.selectedMonth && this.selectedMonth.match(/^\d{4}-\d{2}$/) ? this.selectedMonth : undefined;
    const params = {
      month: month, // Only send if valid format
      classId: this.selectedClassId || undefined,
      academicYearId: this.selectedAcademicYearId
    };
    console.log('Fetching fee dashboard with params:', params); // Debug log

    this.dashboardService.getFeeDashboard(params).pipe(takeUntil(this.destroyed$)).subscribe({
      next: (data: any) => {
        console.log('Fee dashboard data received:', data); // Debug log
        if (data && typeof data === 'object') {
          this.summary = {
            totalRemainingDue: data.summary?.totalRemainingDue || 0,
            totalPaid: data.summary?.totalPaid || 0,
            overdueCount: data.summary?.overdueCount || 0,
            collectionRate: data.summary?.collectionRate || 0,
            invoiceCount: data.summary?.invoiceCount || 0
          };
          this.breakdownByClass = Array.isArray(data.breakdownByClass) ? data.breakdownByClass.map((item: any) => ({
            _id: item._id || '',
            className: item.className || 'Unknown',
            invoiceCount: item.invoiceCount || 0,
            totalAmount: item.totalAmount || 0,
            totalPaid: item.totalPaid || 0,
            totalRemainingDue: item.totalRemainingDue || 0,
            overdueCount: item.overdueCount || 0,
            collectionRate: item.collectionRate || 0
          })) : [];
          this.paymentMethods = Array.isArray(data.paymentMethods) ? data.paymentMethods : [];
          this.topDefaulters = Array.isArray(data.topDefaulters) ? data.topDefaulters : [];
          this.monthlyTrend = Array.isArray(data.monthlyTrend) ? data.monthlyTrend : [];
        } else {
          console.warn('Invalid data format received:', data);
          this.resetData();
        }
        this.prepareCharts();
      },
      error: (error) => {
        console.error('Error fetching fee dashboard:', error);
        this.resetData();
      }
    });
  }

  resetData() {
    this.summary = { totalRemainingDue: 0, totalPaid: 0, overdueCount: 0, collectionRate: 0, invoiceCount: 0 };
    this.breakdownByClass = [];
    this.paymentMethods = [];
    this.topDefaulters = [];
    this.monthlyTrend = [];
    this.prepareCharts(); // Reset charts to reflect no data
  }

  prepareCharts() {
    this.paymentMethodChartOptions = {
      chart: { type: 'pie', height: 300, toolbar: { show: false } },
      series: this.paymentMethods.length ? this.paymentMethods.map(m => m.totalAmount || 0) : [0], // Use 0 instead of 1 for empty data
      labels: this.paymentMethods.length ? this.paymentMethods.map(m => m.method || 'Unknown') : ['No Data'],
      colors: ['#007BFF', '#198754', '#dc3545'],
      fill: { type: 'gradient', gradient: { shade: 'light', type: 'vertical', opacityFrom: 0.8, opacityTo: 0.4, stops: [0, 100] } },
      dataLabels: { enabled: this.paymentMethods.length > 0, formatter: (val) => `${val}%`, style: { colors: ['#fff'], fontSize: '12px', fontFamily: 'Poppins, sans-serif' } },
      legend: { position: 'bottom', fontSize: '12px', fontFamily: 'Poppins, sans-serif', labels: { colors: '#333' } },
      plotOptions: {
        pie: {
          donut: {
            size: '65%',
            labels: {
              show: this.paymentMethods.length > 0,
              name: { show: false },
              value: {
                show: true,
                fontSize: '20px',
                fontFamily: 'Poppins, sans-serif',
                color: '#333',
                formatter: () => {
                  const total = this.paymentMethods.reduce((sum, m) => sum + (m.totalAmount || 0), 0);
                  return total ? `Total: ₹${total.toLocaleString()}` : 'No Data';
                }
              }
            }
          }
        }
      },
      responsive: [{ breakpoint: 480, options: { chart: { height: 200 }, plotOptions: { pie: { donut: { size: '50%' } } } } }]
    };

    this.monthlyTrendChartOptions = {
      chart: { type: 'line', height: 250, toolbar: { show: false }, foreColor: '#333' },
      series: [
        { name: 'Paid', data: this.monthlyTrend.map(t => t.totalPaid || 0), color: '#007BFF' },
        { name: 'Remaining Due', data: this.monthlyTrend.map(t => t.totalRemainingDue || 0), color: '#dc3545' }
      ],
      stroke: { curve: 'smooth', width: 3, colors: ['#007BFF', '#dc3545'] },
      fill: {
        type: 'gradient',
        gradient: { shade: 'light', type: 'vertical', shadeIntensity: 0.5, gradientToColors: ['#a0afe8', '#f8d7da'], opacityFrom: 0.7, opacityTo: 0.3, stops: [0, 100] }
      },
      markers: { size: 5, colors: ['#007BFF', '#dc3545'], strokeWidth: 2, strokeColors: '#fff', hover: { size: 7 } },
      xaxis: { categories: this.monthlyTrend.map(t => t.month || 'Unknown'), labels: { style: { colors: '#666', fontSize: '12px', fontFamily: 'Poppins, sans-serif' } }, axisBorder: { show: true, color: '#e0e0e0' }, axisTicks: { show: false } },
      yaxis: { labels: { style: { colors: '#666', fontSize: '12px', fontFamily: 'Poppins, sans-serif' }, formatter: (value) => `₹${value.toLocaleString()}` } },
      grid: { borderColor: '#e0e0e0', strokeDashArray: 4 },
      legend: { position: 'bottom', fontSize: '12px', fontFamily: 'Poppins, sans-serif', labels: { colors: '#333' } },
      tooltip: { theme: 'light', y: { formatter: (value) => `₹${value.toLocaleString()}` } },
      responsive: [{ breakpoint: 480, options: { chart: { height: 200 } } }]
    };

    if (this.paymentMethodChart()) {
      this.paymentMethodChart()?.updateOptions(this.paymentMethodChartOptions, true);
    }
    if (this.monthlyTrendChart()) {
      this.monthlyTrendChart()?.updateOptions(this.monthlyTrendChartOptions, true);
    }
  }

  sortTable(column: string) {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
  }

  generateReceipts() {
    console.log('Generate receipts for', this.selectedClassId, this.selectedMonth);
    // Implement receipt generation logic here
  }

  sendSMSReminders() {
    console.log('Send SMS reminders for defaulters');
    // Implement SMS reminder logic here
  }

  exportData() {
    console.log('Export data as CSV/PDF');
    // Implement export logic here
  }

  trackById(index: number, item: any): string {
    return item._id || index;
  }
}