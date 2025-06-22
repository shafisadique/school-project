import { Component, OnInit } from '@angular/core';
import { FeeService } from '../fee.service';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ClassSubjectService } from '../../class-subject-management/class-subject.service';
import { AuthService } from 'src/app/theme/shared/service/auth.service';

@Component({
  selector: 'app-cash-report',
  imports: [CommonModule,FormsModule],
  templateUrl: './cash-report.component.html',
  styleUrl: './cash-report.component.scss',
  providers:[DatePipe]
})
export class CashReportComponent implements OnInit{
 reportData: any = null;
  filters = {
    method: 'Cash',
    startDate: '',
    endDate: '',
    classId: '' as any, // Can be string or class object
    section: ''
  };
  isLoading = false;
  classes: any[] = [];
  sections: string[] = [];
  paymentMethods = [
    { value: 'Cash', label: 'Cash' },
    { value: 'Cheque', label: 'Cheque' },
    { value: 'Online', label: 'Online' },
    { value: '', label: 'All Methods' }
  ];

  constructor(
    private feeService: FeeService,
    private classService: ClassSubjectService,
    private authService: AuthService,
    private datePipe: DatePipe
  ) {}

  ngOnInit(): void {
    // Load classes
    const schoolId = this.authService.getSchoolId();
    this.classService.getClassesBySchool(schoolId).subscribe({
      next: (classes) => {
        this.classes = classes;
      },
      error: (err) => console.error('Failed to load classes', err)
    });

    // Default to current month
    const today = new Date();
    this.filters.startDate = this.datePipe.transform(
      new Date(today.getFullYear(), today.getMonth(), 1), 
      'yyyy-MM-dd'
    ) as string;
    this.filters.endDate = this.datePipe.transform(today, 'yyyy-MM-dd') as string;
  }

  onClassChange(): void {
    this.sections = [];
    if (this.filters.classId && this.filters.classId.sections) {
      this.sections = this.filters.classId.sections;
    }
  }

  generateReport(): void {
    this.isLoading = true;
    this.reportData = null;
    
    // Convert class object to ID if needed
    const params = { 
      ...this.filters,
      classId: typeof this.filters.classId === 'object' 
               ? this.filters.classId._id 
               : this.filters.classId
    };
    
    this.feeService.getFeeCollectionReport(params).subscribe({
      next: (res) => {
        console.log(res)
        this.reportData = res.data;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading report:', err);
        this.isLoading = false;
      }
    });
  }
  exportToCSV(): void {
    if (!this.reportData) return;
    
    const headers = [
      'Date', 'Student Name', 'Admission No', 'Class', 'Section',
      'Amount', 'Payment Method', 'Processed By', 'Invoice Month'
    ];
    
    const rows = this.reportData.transactions.map((t: any) => [
      this.datePipe.transform(t.date, 'dd/MM/yyyy'),
      t.student.name,
      t.student.admissionNo,
      t.student.className,
      t.student.section,
      t.amount,
      t.method,
      t.processedBy,
      t.invoiceMonth
    ]);
    
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += headers.join(',') + '\n';
    rows.forEach((row: any) => {
      csvContent += row.join(',') + '\n';
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `cash-payments-${new Date().toISOString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
