// src/app/admin-dashboard/reports/reports.component.ts (or wherever it is)
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from 'src/app/theme/shared/service/auth.service'; // Your auth service
import { CustomReportConfig, ReportResponse, ReportService } from 'src/app/theme/shared/service/report.service';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reports.component.html',
  styleUrls: ['./reports.component.scss']
})
export class ReportsComponent implements OnInit {
  udiseCompliance: any = null;
  isLoadingCompliance = true;
  showCustomBuilder = false;
  availableReports: any[] = [];
  udiseTemplates: any[] = [];
  customConfig: CustomReportConfig = {
    reportType: 'student',
    filters: {},
    columns: ['name', 'rollNo', 'classId'],
    reportName: 'Custom Report'
  };
  currentReport: ReportResponse | null = null;
  isLoading = false;
  selectedClassId: string = '';
  selectedAcademicYear: string = '';

  constructor(
    private reportService: ReportService,
    private authService: AuthService,
    private toastr: ToastrService
  ) {}

  ngOnInit() {
    this.loadAvailableReports();
    this.loadUDISECompliance();
  }

  // Load available report types
  // loadAvailableReports() {
  //   this.reportService.getAvailableReports().subscribe({
  //     next: (response) => {
  //       this.availableReports = response.data.availableReports || [];
  //       this.udiseTemplates = response.data.udiseTemplates || [];
  //     },
  //     error: (error) => {
  //       this.toastr.error('Failed to load report types');
  //     }
  //   });
  // }


  // REPLACE this method in reports.component.ts
loadAvailableReports() {
  // TEMPORARY: Hardcode reports so dropdown works immediately
  this.availableReports = [
    { 
      type: 'student', 
      name: 'Student Master List', 
      description: 'All students with basic information' 
    },
    { 
      type: 'fee-defaulters', 
      name: 'Fee Defaulters', 
      description: 'Students with pending fee payments' 
    },
    { 
      type: 'academic-performance', 
      name: 'Academic Performance', 
      description: 'Class-wise exam results and grades' 
    },
    { 
      type: 'attendance-summary', 
      name: 'Attendance Summary', 
      description: 'Teacher and student attendance records' 
    },
    { 
      type: 'teacher-performance', 
      name: 'Teacher Performance', 
      description: 'Teacher details and performance metrics' 
    }
  ];

  this.udiseTemplates = [
    { template: 'enrollment', name: 'Student Enrollment', description: 'UDISE Student Data' },
    { template: 'teachers', name: 'Teacher Qualifications', description: 'UDISE Teacher Data' },
    { template: 'infrastructure', name: 'School Infrastructure', description: 'UDISE Facility Data' }
  ];

  console.log('✅ Reports loaded:', this.availableReports);
}
  // Toggle custom builder
  toggleCustomBuilder() {
    this.showCustomBuilder = !this.showCustomBuilder;
    if (this.showCustomBuilder) {
      this.loadClassesAndYears(); // Load dropdown options
    }
  }
// Add this method inside ReportsComponent class
getAvailableColumns(reportType?: string): string[] {
  const columnsMap: { [key: string]: string[] } = {
    student: ['name', 'rollNo', 'className', 'gender', 'status','fatherName', 'motherName', 'fatherPhone', 'motherPhone', 'admissionNo'],
              'fee-defaulters': ['name', 'rollNo', 'className', 'totalDue', 'totalPaid', 'feeStatus', 'lastPaymentDate'],
              'academic-performance': ['studentName', 'rollNo', 'subjectName', 'marksObtained', 'totalMarks', 'percentage', 'grade', 'position'],
              'attendance-summary': ['teacherName', 'designation', 'date', 'status', 'subject', 'remarks'],
              'teacher-performance': ['name', 'designation', 'subjects', 'phone', 'email', 'experience', 'status', 'leaveBalance']
  };

  return columnsMap[reportType || 'student'] || ['name', 'rollNo', 'className'];
}
getReportColor(type: string): string {
  const colors: { [key: string]: string } = {
    student: '#3b82f6',
    'fee-defaulters': '#ef4444',
    'academic-performance': '#10b981',
    'attendance-summary': '#f59e0b',
    'teacher-performance': '#8b5cf6'
  };
  return colors[type] || '#6b7280';
}
loadUDISECompliance() {
  this.isLoadingCompliance = true;
  this.reportService.getUDISECompliance().subscribe({
    next: (res) => {
      this.udiseCompliance = res.data;
      this.isLoadingCompliance = false;
    },
    error: () => {
      this.toastr.error('Failed to load UDISE+ readiness');
      this.isLoadingCompliance = false;
    }
  });
}


generateQuickReport(type: any) {
  this.customConfig.reportType = type;
  this.customConfig.columns = this.getAvailableColumns(type);
  this.customConfig.reportName = `Quick ${type.replace('-', ' ')} Report`;
  this.generateCustomReport();
}
  // Generate custom report
 generateCustomReport() {
  const config: any = {
    reportType: this.customConfig.reportType,
    columns: this.customConfig.columns,
    reportName: this.customConfig.reportName,
    filters: {}
  };

  if (this.selectedClassId) {
    config.filters.classId = this.selectedClassId;
  }
  if (this.selectedAcademicYear) {
    config.filters.academicYearId = this.selectedAcademicYear;
  }

  this.reportService.generateCustomReport(config).subscribe({
    next: (res) => {
      this.currentReport = res;
      this.toastr.success('Report generated!');
    },
    error: (err) => {
      this.toastr.error(err.error.message || 'Failed to generate report');
    }
  });
}

  // Generate UDISE report
  generateUDISEReport(template: string) {
    this.isLoading = true;
    this.reportService.generateUDISEReport(template as any).subscribe({
      next: (response) => {
        this.currentReport = response;
        this.toastr.success(`UDISE ${template} report generated`);
        this.isLoading = false;
      },
      error: (error) => {
        this.isLoading = false;
      }
    });
  }

  // Export current report
  exportReport(format: 'csv') {
    if (!this.currentReport) {
      this.toastr.error('No report to export');
      return;
    }

    // For simplicity, send report data to backend for export
    this.reportService.exportReport(this.currentReport.data.name, format).subscribe({
      next: (blob) => {
        // Download blob
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.currentReport!.data.name}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        this.toastr.success('Report exported successfully');
      },
      error: (error) => {
        this.toastr.error('Export failed');
      }
    });
  }

  // Load classes and academic years for dropdowns (use your existing services)
  loadClassesAndYears() {
    // Call your existing class and academic year services
    // Example:
    // this.classService.getClasses().subscribe(classes => this.classes = classes);
    // this.academicYearService.getAcademicYears().subscribe(years => this.academicYears = years);
    console.log('Load classes and years here using your existing services');
  }

  // Your existing methods...
}