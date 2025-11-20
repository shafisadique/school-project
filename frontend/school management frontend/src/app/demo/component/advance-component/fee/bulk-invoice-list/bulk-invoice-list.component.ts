import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { FeeService } from '../fee.service';
import { AuthService } from 'src/app/theme/shared/service/auth.service';
import { ClassSubjectService } from '../../class-subject-management/class-subject.service';
import { StudentService } from '../../students/student.service';
import { ActivatedRoute, Router } from '@angular/router';
import { PaginationComponent } from '../../pagination/pagination.component';
import { Subject, takeUntil } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

interface LedgerRow {
  _id: string;
  month: string;
  previousDue: number;
  currentFee: number;
  paidAmount: number;
  totalDues: number;
  remainingDue: number;
  status: string;
  dueDate: Date;
  payments: PaymentHistory[];
}

interface PaymentHistory {
  date: Date;
  amount: number;
  method: string;
  transactionId: string;
  processedBy: string;
}

interface ClassItem {
  id: string;
  name: string;
}

interface StudentItem {
  _id: string;
  name: string;
  admissionNo?: string;
}

@Component({
  selector: 'app-bulk-invoice-list',
  standalone: true,
  imports: [CommonModule, FormsModule, PaginationComponent],
  providers: [DatePipe],
  templateUrl: './bulk-invoice-list.component.html',
  styleUrls: ['./bulk-invoice-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BulkInvoiceListComponent implements OnInit, OnDestroy {
  @ViewChild('searchInput', { static: false }) searchInput!: ElementRef<HTMLInputElement>;

  schoolId: string | null = null;
  activeAcademicYearId: string | null = null;
  classList: ClassItem[] = [];
  studentData: any[] = [];
  searchResults: StudentItem[] = [];  // For custom dropdown
  searchQuery: string = '';
  queryLength: number = 0;
  showDropdown = false;  // Control custom dropdown visibility
  selectedClassId: string = '';
  selectedClassName: string = '';
  selectedStudentId: string = '';
  selectedStudent: StudentItem | null = null;
  month: string = '';
  invoices: any[] = [];
  filteredInvoices: any[] = [];
  statusFilter: string = '';
  currentPage: number = 1;
  pageSize: number = 10;
  totalItems: number = 0;
  pageSizeOptions: number[] = [10, 25, 50, 100];
  viewMode: 'class' | 'student' = 'class';

  // Student view properties
  summary: any = null;
  ledgerData: LedgerRow[] = [];
  selectedLedger: any = null;
  ledgers: any[] = [];
  showPaymentHistory = false;
  overallPayments: any[] = [];

  // Production: Error States
  errorMessage: string | null = null;

  // Production: RxJS Cleanup
  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();

  constructor(
    private feeService: FeeService,
    private authService: AuthService,
    private classSubjectService: ClassSubjectService,
    private studentService: StudentService,
    private toastr: ToastrService,
    private datePipe: DatePipe,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.schoolId = this.authService.getSchoolId();
    this.activeAcademicYearId = this.authService.getActiveAcademicYearId();
    if (this.schoolId) {
      if (!this.activeAcademicYearId || !this.isValidObjectId(this.activeAcademicYearId)) {
        this.setError('No valid active academic year found. Please set an active academic year.');
        return;
      }
      this.loadClasses();
      this.setupSearchDebounce();
    } else {
      this.setError('School ID not found. Please log in again.');
    }

    // Listen to route params for deep linking
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      if (params['classId'] && params['month']) {
        this.selectedClassId = params['classId'];
        this.month = params['month'];
        const selectedClass = this.classList.find(cls => cls.id === this.selectedClassId);
        if (selectedClass) {
          this.selectedClassName = selectedClass.name;
          this.loadStudents().then(() => {
            this.loadInvoices();
          });
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Production: Error Handling
  private setError(message: string): void {
    this.errorMessage = message;
    this.toastr.error(message);
    this.cdr.markForCheck();
  }

  clearError(): void {
    this.errorMessage = null;
    this.cdr.markForCheck();
  }

  private isValidObjectId(id: string): boolean {
    const objectIdPattern = /^[0-9a-fA-F]{24}$/;
    return objectIdPattern.test(id);
  }

  // Production: TrackBy Functions for Performance
  trackByClassId(index: number, item: ClassItem): string {
    return item.id;
  }

  trackByStudentId(index: number, item: StudentItem): string {
    return item._id;
  }

  trackByInvoiceId(index: number, item: any): string {
    return item._id;
  }

  trackByLedgerId(index: number, item: any): string {
    return item.yearId;
  }

  trackByLedgerRowId(index: number, item: LedgerRow): string {
    return item._id;
  }

  trackByPaymentId(index: number, item: any): string {
    return item._id;
  }

  loadClasses(): void {
    this.classSubjectService.getClassesBySchool(this.schoolId!).subscribe({
      next: (classes: any[]) => {
        this.classList = classes.map(c => ({ id: c._id, name: c.name }));
        if (this.classList.length === 0) {
          this.toastr.warning('No classes found for this school.');
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error loading classes:', err);
        this.setError(err.error?.message || 'Failed to load classes.');
      }
    });
  }

  loadStudents(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.selectedClassId || !this.activeAcademicYearId) {
        this.studentData = [];
        resolve();
        return;
      }
      this.studentService.getStudentsByClass(this.selectedClassId, this.activeAcademicYearId).subscribe({
        next: (res: any) => {
          this.studentData = res.students || [];
          if (this.studentData.length === 0) {
            this.toastr.warning('No students found for the selected class.');
          }
          resolve();
        },
        error: (err) => {
          console.error('Error loading students:', err);
          this.setError(err.error?.message || 'Failed to load students.');
          this.studentData = [];
          reject(err);
        }
      });
    });
  }

  updateClassSelection(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const selectedClass = this.classList.find(cls => cls.id === target.value);
    if (selectedClass) {
      this.selectedClassId = selectedClass.id;
      this.selectedClassName = selectedClass.name;
      this.selectedStudentId = '';
      this.selectedStudent = null;
      this.viewMode = 'class';
      if (this.month) {
        this.loadInvoices();
      }
    }
    this.cdr.markForCheck();
  }

  // Production: Debounced Search Setup
  private setupSearchDebounce(): void {
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(query => {
      if (query.length >= 2) {
        this.performStudentSearch(query);
      } else {
        this.searchResults = [];
        this.showDropdown = false;
      }
    });
  }

  searchStudents(event: any): void {
    const query = event.target.value;
    this.searchQuery = query;
    this.queryLength = query.length;
    if (query.length >= 2) {
      this.showDropdown = true;
      this.searchSubject.next(query);
    } else {
      this.showDropdown = false;
      this.searchResults = [];
    }
    this.cdr.markForCheck();
  }

  // Hide dropdown on outside click
  onDocumentClick(event: MouseEvent): void {
    if (this.searchInput && !this.searchInput.nativeElement.contains(event.target as Node)) {
      this.showDropdown = false;
      this.cdr.markForCheck();
    }
  }

  private performStudentSearch(query: string): void {
    this.feeService.searchInvoiceStudents(query, this.schoolId!).subscribe({
      next: (res: any) => {
        this.searchResults = res.students || [];
        this.showDropdown = this.searchResults.length > 0;
        this.cdr.markForCheck();
      },
      error: () => {
        this.searchResults = [];
        this.showDropdown = false;
        this.setError('Failed to search students');
      }
    });
  }

  selectStudentFromList(student: StudentItem): void {
    this.selectedStudentId = student._id;
    this.selectedStudent = student;
    this.searchQuery = `${student.name} ${student.admissionNo ? `(${student.admissionNo})` : ''}`;
    this.showDropdown = false;
    this.getStudentInvoicesData(student._id);
    this.cdr.markForCheck();
  }

  getStudentInvoicesData(studentId: string): void {
    this.feeService.getStudentInvoices(studentId).subscribe({
      next: (res: any) => {
        this.ledgers = res.ledgers || [];
        
        if (this.ledgers.length > 0) {
          this.selectedLedger = this.ledgers[this.ledgers.length - 1];
          this.updateLedgerTable();
        } else {
          this.ledgerData = [];
          this.summary = {};
        }
        
        // Load payment history
        this.loadPaymentHistory(studentId);
      },
      error: (err) => {
        this.setError(err.error?.message || 'Failed to load invoices');
        this.ledgers = [];
      }
    });
  }

loadPaymentHistory(studentId: string): void {
  this.feeService.getStudentPaymentHistory(studentId).subscribe({
    next: (res: any) => {
      if (res.success) {
        this.overallPayments = res.data || [];
        // Backend now sorts, but double-check ASC by invoiceMonth
        this.overallPayments.sort((a, b) => {
          const monthA = a.invoiceMonth ? new Date(`${a.invoiceMonth}-01`) : new Date(0);
          const monthB = b.invoiceMonth ? new Date(`${b.invoiceMonth}-01`) : new Date(0);
          return monthA.getTime() - monthB.getTime();
        });
        console.log('Payments sorted for cumulative:', this.overallPayments);
      }
      this.cdr.markForCheck();
    },
    error: (err) => {
      console.error('Failed to load payment history:', err);
      this.overallPayments = [];
      this.cdr.markForCheck();
    }
  });
}

  updateLedgerTable(): void {
    if (!this.selectedLedger) return;

    this.ledgerData = this.selectedLedger.ledger || [];
    this.summary = this.selectedLedger.summary || {};
    this.totalItems = this.ledgerData.length;
    this.filteredInvoices = [...this.ledgerData];
    this.filterInvoices();
    this.cdr.markForCheck();
  }

  onAcademicYearChange(): void {
    this.updateLedgerTable();
  }

  togglePaymentHistory(): void {
    this.showPaymentHistory = !this.showPaymentHistory;
    this.cdr.markForCheck();
  }

  getBalanceAfter(index: number): number {
  if (this.overallPayments.length === 0 || !this.summary || !this.ledgerData.length) {
    return this.summary?.totalDue || 0;
  }
  
  let cumulativeDue = 0;
  let cumulativePaid = 0;
  
  for (let i = 0; i <= index; i++) {
    const payment = this.overallPayments[i];
    // Find index of payment's invoiceMonth in ledger (sorted ASC)
    const monthIndex = this.ledgerData.findIndex(row => row.month === payment.invoiceMonth);
    if (monthIndex >= 0) {
      // Sum base fees from start to this month (ignore prior paid/dues for raw cumulative due)
      for (let j = 0; j <= monthIndex; j++) {
        cumulativeDue += this.ledgerData[j].currentFee;  // e.g., +₹650 per month
      }
    }
    cumulativePaid += payment.amount;
  }
  
  const balance = cumulativeDue - cumulativePaid;
  return balance;  // Allow negative for credits (display as -₹150)
}

  getTotalPaid(): number {
    return this.overallPayments.reduce((total, payment) => total + payment.amount, 0);
  }

  loadInvoices(): void {
    if (!this.selectedClassId || !this.month || !this.activeAcademicYearId) return;

    this.feeService.getInvoicesByClassAndMonth(
      this.selectedClassId,
      this.month,
      this.activeAcademicYearId
    ).subscribe({
      next: (res) => {
        this.invoices = res.data || [];
        this.totalItems = this.invoices.length;
        this.filterInvoices();
      },
      error: (err) => {
        this.setError('Failed to load invoices');
      }
    });
  }

  filterInvoices(): void {
  let dataSource = this.viewMode === 'class' ? this.invoices : this.ledgerData;
  let filtered = dataSource.map(item => {
    const dueDate = new Date(item.dueDate);
    const now = new Date('2025-11-14');  // Test current date; remove for prod: new Date()
    if (item.status === 'Pending' && now > dueDate) {
      return { ...item, status: 'Overdue' };
    }
    return item;
  });

  if (this.statusFilter) {
    filtered = filtered.filter(item => item.status === this.statusFilter);
  }

  this.totalItems = filtered.length;
  const start = (this.currentPage - 1) * this.pageSize;
  const end = start + this.pageSize;
  this.filteredInvoices = filtered.slice(start, end);
  this.cdr.markForCheck();
}

  setViewMode(mode: 'class' | 'student'): void {
    this.viewMode = mode;
    if (this.viewMode === 'class') {
      this.selectedStudentId = '';
      this.selectedStudent = null;
      this.searchQuery = '';
      this.searchResults = [];
      this.showDropdown = false;
      this.ledgerData = [];
      this.summary = null;
      this.overallPayments = [];
      if (this.month && this.selectedClassId) {
        this.loadInvoices();
      }
    } else {
      this.ledgerData = [];
      this.filteredInvoices = [];
      this.overallPayments = [];
    }
    this.filterInvoices();
    this.cdr.markForCheck();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.filterInvoices();
  }

  onPageSizeChange(newSize: number): void {
    this.pageSize = newSize;
    this.currentPage = 1;
    this.filterInvoices();
  }

  downloadInvoicePDF(invoiceId: string): void {
    this.feeService.downloadInvoicePDF(invoiceId).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `invoice_${invoiceId}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        this.toastr.success('Invoice PDF downloaded successfully.');
      },
      error: (err) => {
        console.error('Error downloading PDF:', err);
        const errorMessage = err.error?.message || err.message || 'Failed to download invoice PDF.';
        this.setError(errorMessage);
      }
    });
  }

  processPayment(invoiceId: string, amount: number): void {
    this.feeService.getInvoiceById(invoiceId).subscribe({
      next: (response) => {
        const invoice = response.data;
        if (invoice && invoice.student?._id) {
          this.router.navigate(['/fee/payment', invoiceId]);
        } else {
          this.setError('Invalid invoice data or student not found.');
        }
      },
      error: (err) => {
        this.setError('Failed to load invoice details: ' + (err.error?.message || err.message));
        console.error('Error fetching invoice:', err);
      }
    });
  }

  notifyParents(): void {
    if (!this.selectedClassId || !this.month || !this.activeAcademicYearId) {
      this.setError('Please select a class and month.');
      return;
    }

    this.feeService.notifyParents(this.selectedClassId, this.month, this.activeAcademicYearId).subscribe({
      next: (res) => {
        this.toastr.success(res.message);
      },
      error: (err) => {
        console.error('Error notifying parents:', err);
        const errorMessage = err.error?.message || err.message || 'Failed to notify parents.';
        this.setError(errorMessage);
      }
    });
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  get minMonth(): string {
    return this.datePipe.transform(new Date(), 'yyyy-MM') || '';
  }

  get maxMonth(): string {
    const date = new Date();
    date.setFullYear(date.getFullYear() + 1);
    return this.datePipe.transform(date, 'yyyy-MM') || '';
  }

  getRowClass(status: string): string {
    return status === 'Overdue' ? 'table-danger' : '';
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'Paid': return 'bg-success text-white';
      case 'Pending': return 'bg-warning text-dark';
      case 'Partial': return 'bg-info text-white';
      case 'Overdue': return 'bg-danger text-white';
      default: return 'bg-secondary text-white';
    }
  }

  openStudentView(studentId: string, studentName: string): void {
    if (!studentId) {
      this.setError('Student ID not found');
      return;
    }

    this.selectedStudentId = studentId;
    this.selectedStudent = { _id: studentId, name: studentName };
    this.viewMode = 'student';
    this.searchQuery = studentName;
    this.searchStudents({ target: { value: studentName } });
    this.getStudentInvoicesData(studentId);
  }

  getColspan(): number {
    return this.viewMode === 'student' ? 10 : 7;
  }
}