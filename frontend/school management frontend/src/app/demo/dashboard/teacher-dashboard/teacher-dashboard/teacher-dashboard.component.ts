import { Component, inject, viewChild, AfterViewInit, OnInit } from '@angular/core';
import { ApexOptions, ChartComponent, NgApexchartsModule } from 'ng-apexcharts';
import { IconService } from '@ant-design/icons-angular';
import { DashboardService } from 'src/app/theme/shared/service/dashboard.service';
import { TeacherDashboardData, StudentAttendanceData } from './teacher.model'; // ✅ Your local model
import { FallOutline, GiftOutline, MessageOutline, RiseOutline } from '@ant-design/icons-angular/icons';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-teacher-dashboard',
  standalone: true,
  imports: [CommonModule, NgApexchartsModule, FormsModule, DatePipe],
  templateUrl: './teacher-dashboard.component.html',
  styleUrls: ['./teacher-dashboard.component.scss']
})
export class TeacherDashboardComponent implements OnInit, AfterViewInit {
  private iconService = inject(IconService);
  private dashboardService = inject(DashboardService);

  teacherDashboardData: TeacherDashboardData = {} as TeacherDashboardData;
  studentAttendanceData: StudentAttendanceData = {} as StudentAttendanceData;
  personalAttendanceStatus: string = 'Absent';
  pendingAssignmentsCount: number = 0;
  pendingLeavesCount: number = 0;
  upcomingHolidaysCount: number = 0;
  isHoliday: boolean = false;

  attendanceChartOptions: Partial<ApexOptions> = {
    chart: { type: 'pie', height: 220, toolbar: { show: false } },
    labels: ['Present', 'Absent', 'On Leave'],
    series: [5, 3, 2], // Dummy data to test
    colors: ['#198754', '#dc3545', '#ffc107'],
    legend: { position: 'bottom', fontSize: '12px', fontFamily: 'Poppins, sans-serif', labels: { colors: '#333' } },
    responsive: [{ breakpoint: 480, options: { chart: { width: 150 }, legend: { position: 'bottom' } } }]
  };
  attendanceChart = viewChild<ChartComponent>('attendanceChart');

  isViewInitialized: boolean = false;
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  constructor() {
    this.iconService.addIcon(...[RiseOutline, FallOutline, GiftOutline, MessageOutline]);
  }

  ngOnInit() {
    this.fetchTeacherDashboard();
  }

  ngAfterViewInit() {
    this.isViewInitialized = true;
    this.updateCharts();
  }

  fetchTeacherDashboard() {
    this.dashboardService.getTeacherDashboard().subscribe({
      next: (data: TeacherDashboardData) => {
        console.log('Dashboard Data:', data);
        this.teacherDashboardData = data || {} as TeacherDashboardData;
        
        // ✅ FIXED: Access data.data
        this.personalAttendanceStatus = data.data.personalAttendanceStatus || 'Absent';
        this.pendingAssignmentsCount = data.data.pendingAssignments?.length || 0;
        this.pendingLeavesCount = data.data.pendingLeaves?.length || 0;
        this.upcomingHolidaysCount = data.data.upcomingHolidays?.length || 0;
        this.isHoliday = data.data.isHoliday || false;

        // Update chart
        let presentCount = 0;
        let absentCount = 0;
        let onLeaveCount = 0;
        if (data.data.recentStudentAttendance?.length > 0) {
          data.data.recentStudentAttendance.forEach((attendance: any) => {
            if (attendance.status === 'Present') presentCount++;
            else if (attendance.status === 'Absent') absentCount++;
            else if (attendance.status === 'On Leave') onLeaveCount++;
          });
        }
        const attendance:any = data.data.recentStudentAttendance || { presentCount: 0, absentCount: 0, lateCount: 0, totalStudents: 0 };
        this.attendanceChartOptions = {
          ...this.attendanceChartOptions,
          series: [attendance.presentCount, attendance.absentCount, attendance.lateCount]
        };
        console.log(this.attendanceChartOptions)
        this.updateCharts();
      },
      error: (error) => console.error('Error fetching teacher dashboard:', error)
    });
  }

  updateCharts() {
    if (this.isViewInitialized && this.attendanceChart() && this.attendanceChartOptions.series) {
      this.attendanceChart()?.updateOptions(this.attendanceChartOptions, true, true); // Force re-render
    } else {
      console.log('Chart not initialized or series invalid:', { isViewInitialized: this.isViewInitialized, attendanceChart: this.attendanceChart(), series: this.attendanceChartOptions.series });
    }
  }

  // ✅ NEW GETTER METHODS (Fixes NG5002 & TS2339)
  getPendingAssignments() {
    return this.teacherDashboardData.data.pendingAssignments || [];
  }

  getPendingLeaves() {
    return this.teacherDashboardData.data.pendingLeaves || [];
  }

  getUpcomingHolidays() {
    return this.teacherDashboardData.data.upcomingHolidays || [];
  }

  get hasNoPendingAssignments() {
    return this.getPendingAssignments().length === 0;
  }

  get hasNoPendingLeaves() {
    return this.getPendingLeaves().length === 0;
  }

  get hasNoUpcomingHolidays() {
    return this.getUpcomingHolidays().length === 0;
  }

  get hasNoAttendanceData() {
    return !this.attendanceChartOptions.series?.length || this.attendanceChartOptions.series.every(s => s === 0);
  }

  sortTable(column: string) {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
  }
}