// src/app/default.component.ts
import { Component, inject, OnInit, AfterViewInit, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { NgApexchartsModule } from 'ng-apexcharts';

// Project imports
import tableData from 'src/fake-data/default-data.json';
import { MonthlyBarChartComponent } from 'src/app/theme/shared/apexchart/monthly-bar-chart/monthly-bar-chart.component';
import { IncomeOverviewChartComponent } from 'src/app/theme/shared/apexchart/income-overview-chart/income-overview-chart.component';
import { AnalyticsChartComponent } from 'src/app/theme/shared/apexchart/analytics-chart/analytics-chart.component';
import { SalesReportChartComponent } from 'src/app/theme/shared/apexchart/sales-report-chart/sales-report-chart.component';
import { CardComponent } from 'src/app/theme/shared/components/card/card.component';
import { IconService, IconDirective } from '@ant-design/icons-angular';
import { FallOutline, GiftOutline, MessageOutline, RiseOutline, SettingOutline } from '@ant-design/icons-angular/icons';
import { ChartComponent } from 'ng-apexcharts';
import { ApexOptions } from 'ng-apexcharts';
import { DashboardService } from 'src/app/theme/shared/service/dashboard.service';

@Component({
  selector: 'app-default',
  standalone: true,
  imports: [
    CommonModule,
    HttpClientModule,
    CardComponent,
    IconDirective,
    MonthlyBarChartComponent,
    IncomeOverviewChartComponent,
    AnalyticsChartComponent,
    SalesReportChartComponent,
    NgApexchartsModule
  ],
  templateUrl: './default.component.html',
  styleUrls: ['./default.component.scss']
})
export class DefaultComponent implements OnInit, AfterViewInit {
  private iconService = inject(IconService);
  private dashboardService = inject(DashboardService);

  recentOrder = tableData;

  AnalyticEcommerce = [
    {
      title: 'Total Page Views',
      amount: '4,42,236',
      background: 'bg-light-primary',
      border: 'border-primary',
      icon: 'rise',
      percentage: '59.3%',
      color: 'text-primary',
      number: '35,000'
    },
    {
      title: 'Total Users',
      amount: '78,250',
      background: 'bg-light-primary',
      border: 'border-primary',
      icon: 'rise',
      percentage: '70.5%',
      color: 'text-primary',
      number: '8,900'
    },
    {
      title: 'Total Order',
      amount: '18,800',
      background: 'bg-light-warning',
      border: 'border-warning',
      icon: 'fall',
      percentage: '27.4%',
      color: 'text-warning',
      number: '1,943'
    },
    {
      title: 'Total Sales',
      amount: '$35,078',
      background: 'bg-light-warning',
      border: 'border-warning',
      icon: 'fall',
      percentage: '27.4%',
      color: 'text-warning',
      number: '$20,395'
    }
  ];

  transaction = [
    {
      background: 'text-success bg-light-success',
      icon: 'gift',
      title: 'Order #002434',
      time: 'Today, 2:00 AM',
      amount: '+ $1,430',
      percentage: '78%'
    },
    {
      background: 'text-primary bg-light-primary',
      icon: 'message',
      title: 'Order #984947',
      time: '5 August, 1:45 PM',
      amount: '- $302',
      percentage: '8%'
    },
    {
      background: 'text-danger bg-light-danger',
      icon: 'setting',
      title: 'Order #988784',
      time: '7 hours ago',
      amount: '- $682',
      percentage: '16%'
    }
  ];

  studentAttendanceData: any;
  chartOptions!: Partial<ApexOptions>;
  chart = viewChild<ChartComponent>('chart');

  totalStudents: number = 0;
  totalPresent: number = 0;
  totalAbsent: number = 0;
  classes: { _id: string; name: string }[] = [];
  selectedClassId: string = '';

  constructor() {
    this.iconService.addIcon(...[RiseOutline, FallOutline, SettingOutline, GiftOutline, MessageOutline]);
  }

  ngOnInit() {
    this.fetchStudentAttendance();
  }

  fetchStudentAttendance(classId?: string) {
    this.dashboardService.getStudentAttendance(classId).subscribe(
      (data) => {
        this.studentAttendanceData = data;
        console.log('Fetched data:', data);
        this.totalStudents = data.totalStudents || 0;
        this.classes = data.classes || [];
        const attendance = classId ? data.classAttendance : data.overallAttendance;
        if (!attendance) {
          console.warn('Attendance data is missing or undefined:', attendance);
          return;
        }
        this.totalPresent = attendance.Present || 0;
        this.totalAbsent = this.totalStudents - this.totalPresent;
        this.prepareChartData();
      },
      (error) => {
        console.error('Error fetching student attendance:', error);
      }
    );
  }

  onClassChange(event: any) {
    this.selectedClassId = event.target.value;
    this.fetchStudentAttendance(this.selectedClassId);
  }

  prepareChartData() {
    const attendance = this.selectedClassId ? this.studentAttendanceData.classAttendance : this.studentAttendanceData.overallAttendance;
    if (!attendance) {
      console.warn('No attendance data available for chart:', this.studentAttendanceData);
      this.chartOptions = {
        chart: { type: 'pie', height: 150, toolbar: { show: false } },
        labels: ['Present', 'Absent', 'Late'],
        series: [0, 0, 0],
        colors: ['#36A2EB', '#FF6384', '#FFCE56'],
        legend: { 
          position: 'bottom', 
          fontSize: '12px', 
          fontFamily: 'Helvetica, Arial, sans-serif',
          labels: { colors: '#FFFFFF' } // Set legend labels to white
        },
        responsive: [{ breakpoint: 480, options: { chart: { width: 150 }, legend: { position: 'bottom' } } }]
      };
      return;
    }

    this.chartOptions = {
      chart: {
        type: 'pie',
        height: 250,
        toolbar: { show: false }
      },
      labels: ['Present', 'Absent', 'Late'],
      series: [attendance.Present || 0, this.totalAbsent, attendance.Late || 0],
      colors: ['#36A2EB', '#FF6384', '#FFCE56'],
      legend: {
        position: 'bottom',
        fontSize: '12px',
        fontFamily: 'Helvetica, Arial, sans-serif',
        labels: { colors: '#FFFFFF' } // Set legend labels to white
      },
      responsive: [{
        breakpoint: 480,
        options: {
          chart: { width: 150 },
          legend: { position: 'bottom' }
        }
      }]
    };
    console.log('Chart options updated with height:', this.chartOptions.chart.height);
    if (this.chart()) {
      this.chart()?.updateOptions(this.chartOptions, true); // Force re-render
    } else {
      console.warn('Chart component not yet initialized');
    }
  }

  ngAfterViewInit() {
    if (this.chart() && this.chartOptions) {
      this.chart()?.render();
      console.log('Chart rendered with height:', this.chartOptions.chart.height);
    } else {
      console.error('Chart component or options not available');
    }
  }
}