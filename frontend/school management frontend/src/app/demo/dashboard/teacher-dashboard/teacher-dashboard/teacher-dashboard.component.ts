import { Component, inject, ViewChild, AfterViewInit, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { ApexAxisChartSeries, ApexChart, ApexDataLabels, ApexFill, ApexGrid, ApexLegend, ApexMarkers, ApexNoData, ApexPlotOptions, ApexStroke, ApexTooltip, ApexXAxis, ApexYAxis, ChartComponent, NgApexchartsModule } from "ng-apexcharts";
import { DashboardService } from 'src/app/theme/shared/service/dashboard.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { Subject, takeUntil } from 'rxjs';

export type ChartOptions = {
  series: ApexAxisChartSeries;
  chart: ApexChart;
  xaxis: ApexXAxis;
  yaxis: ApexYAxis;
  plotOptions: ApexPlotOptions;
  dataLabels: ApexDataLabels;
  colors: string[];
  legend: ApexLegend;
  tooltip: ApexTooltip;
  grid: ApexGrid;
};

@Component({
  selector: 'app-teacher-dashboard',
  standalone: true,
  imports: [CommonModule, NgApexchartsModule, FormsModule],
  templateUrl: './teacher-dashboard.component.html',
  styleUrls: ['./teacher-dashboard.component.scss']
})
export class TeacherDashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  private dashboardService = inject(DashboardService);
  private toastr = inject(ToastrService);
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();

  teacherDashboardData: any = null;
  personalAttendanceStatus = 'Absent';
  pendingAssignmentsCount = 0;
  pendingLeavesCount = 0;
  upcomingHolidaysCount = 0;

  @ViewChild('attendanceChart') attendanceChart!: ChartComponent;

  public chartOptions: any = {
    series: [
      { name: 'Present', data: [] },
      { name: 'Absent', data: [] },
      { name: 'Holiday/Sunday', data: [] }
    ],
    chart: {
      type: 'bar',
      height: 320,
      stacked: true,
      stackType: '100%',
      toolbar: { show: false },
      animations: { enabled: true },
      parentHeightOffset: 0,
      zoom: { enabled: false }
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: '70%',    // ← Ye badhao → bars moti ho jayengi
        borderRadius: 8,
        dataLabels: { position: 'top' }
      }
    },
    dataLabels: {
      enabled: true,
      formatter: (val: number, opts) => {
        const seriesIndex = opts.seriesIndex;
        const dataPointIndex = opts.dataPointIndex;
        const w = opts.w;

        // Only show label for Holiday/Sunday
        if (seriesIndex === 2 && val === 1) {
          const day = w.config.xaxis.categories[dataPointIndex];
          const date = new Date();
          date.setDate(parseInt(day));
          const dayName = date.toLocaleString('en-US', { weekday: 'short' });
          return dayName === 'Sun' ? 'SUN' : 'HOLI';
        }
        return val === 1 ? '●' : '';
      },
      offsetY: -25,
      style: { fontSize: '11px', fontWeight: 'bold', colors: ['#fff'] },
      background: {
        enabled: true,
        foreColor: '#000',
        padding: 4,
        borderRadius: 4,
        borderWidth: 0,
        opacity: 0.8
      }
    },
    colors: ['#28a745', '#dc3545', '#6c757d'], // Green, Red, Grey
    xaxis: {
      type: 'category',
      categories: [],
      labels: { style: { fontSize: '13px', fontWeight: 600 } },
      title: { text: 'Day of Month', style: { fontWeight: 600 } }
    },
    yaxis: { show: false },
    legend: { position: 'top', horizontalAlign: 'center' },
    tooltip: { enabled: false },
    grid: { show: false },
    states: {
      hover: { filter: { type: 'none' } },
      active: { filter: { type: 'none' } }
    }
  };

  ngOnInit(): void {
    this.loadDashboard();
  }

  ngAfterViewInit(): void {
    this.cdr.detectChanges();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadDashboard(): void {
    this.dashboardService.getTeacherDashboard()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          if (res?.success && res.data) {
            const data = res.data;
            this.teacherDashboardData = data;

            this.personalAttendanceStatus = data.personalAttendanceStatus || 'Absent';
            this.pendingAssignmentsCount = data.pendingAssignments?.length || 0;
            this.pendingLeavesCount = data.pendingLeaves?.length || 0;
            this.upcomingHolidaysCount = data.upcomingHolidays?.length || 0;

            // PASS BOTH: today's status + full month records
            this.buildTeacherAttendanceChart(
              data.personalAttendanceStatus,
              data.monthlyTeacherAttendance || {}
            );
          }
        },
        error: () => {
          this.toastr.error('Failed to load dashboard', 'Error');
          this.buildTeacherAttendanceChart('Absent', []);
        }
      });
  }

  private buildTeacherAttendanceChart(todayStatus: string, monthlyAttendance: any): void {
    const present: number[] = [];
    const absent: number[] = [];
    const holiday: number[] = [];
    const categories: string[] = [];

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      categories.push(day.toString());
      const status = monthlyAttendance[day]; // ← yahan string key hai: "22", "23"...

      if (day === now.getDate()) {
        if (todayStatus === 'Present') {
          present.push(1); absent.push(0); holiday.push(0);
        } else {
          present.push(0); absent.push(1); holiday.push(0);
        }
      }
      else if (status === 'Present') {
        present.push(1); absent.push(0); holiday.push(0);
      }
      else if (status === 'Holiday') {
        present.push(0); absent.push(0); holiday.push(1);
      }
      else if (status === 'Absent') {
        present.push(0); absent.push(1); holiday.push(0);
      }
      else {
        // Agar key hi nahi hai (jaise 1 se 21) → blank bar (no color)
        present.push(0); absent.push(0); holiday.push(0);
      }
    }

    // UPDATE SERIES
    this.chartOptions = {
      ...this.chartOptions,
      series: [
        { name: 'Present', data: present },
        { name: 'Absent', data: absent },
        { name: 'Holiday/Sunday', data: holiday }
      ],
      xaxis: {
        ...this.chartOptions.xaxis,
        categories
      }
    };

    this.renderChart();
  }

  private renderChart(): void {
    setTimeout(() => {
      if (this.attendanceChart) {
        this.attendanceChart.updateOptions(this.chartOptions, false, true);
      }
    }, 300);
  }

  // Getters
  getPendingAssignments() { return this.teacherDashboardData?.pendingAssignments || []; }
  getPendingLeaves() { return this.teacherDashboardData?.pendingLeaves || []; }
  getUpcomingHolidays() { return this.teacherDashboardData?.upcomingHolidays || []; }
  get hasNoPendingAssignments() { return this.pendingAssignmentsCount === 0; }
  get hasNoPendingLeaves() { return this.pendingLeavesCount === 0; }
  get hasNoUpcomingHolidays() { return this.upcomingHolidaysCount === 0; }
}