import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { FeeService } from '../fee.service';
import { AuthService } from 'src/app/theme/shared/service/auth.service';
import { ClassSubjectService } from '../../class-subject-management/class-subject.service';
import { StudentService } from '../../students/student.service';
import { ActivatedRoute, Router } from '@angular/router';
import { PaginationComponent } from '../../pagination/pagination.component';

interface LedgerRow {
  _id: string;
  month: string;
  previousDue: number;
  currentFee: number;
  paidAmount: number;
  totalDues: number;
  remainingDue: number;
  carryForward: number;
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

@Component({
  selector: 'app-bulk-invoice-list',
  standalone: true,
  imports: [CommonModule, FormsModule, PaginationComponent],
  providers: [DatePipe],
  templateUrl: './bulk-invoice-list.component.html',
  styleUrls: ['./bulk-invoice-list.component.scss']
})
export class BulkInvoiceListComponent implements OnInit {
  schoolId: string | null = null;
  activeAcademicYearId: string | null = null;
  classList: { id: string; name: string }[] = [];
  studentData: any[] = [];
  selectedClassId: string = '';
  selectedClassName: string = '';
  selectedStudentId: string = '';
  selectedStudent: any = null;
  month: string = '';
  invoices: any[] = []; // For class view
  filteredInvoices: any[] = []; // Shared for table binding
  statusFilter: string = '';
  currentPage: number = 1;
  pageSize: number = 10;
  totalItems: number = 0;
  pageSizeOptions: number[] = [10, 25, 50, 100];
  viewMode: 'class' | 'student' = 'class';

  // Student view properties
  summary: any = null;
  ledgerData: LedgerRow[] = [];
  expandedRows: Set<string> = new Set<string>();

  constructor(
    private feeService: FeeService,
    private authService: AuthService,
    private classSubjectService: ClassSubjectService,
    private studentService: StudentService,
    private toastr: ToastrService,
    private datePipe: DatePipe,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.schoolId = this.authService.getSchoolId();
    this.activeAcademicYearId = this.authService.getActiveAcademicYearId();
    if (this.schoolId) {
      if (!this.activeAcademicYearId || !this.isValidObjectId(this.activeAcademicYearId)) {
        this.toastr.error('No valid active academic year found. Please set an active academic year.');
        return;
      }
      this.loadClasses();
    } else {
      this.toastr.error('School ID not found. Please log in again.');
    }
  }

  private isValidObjectId(id: string): boolean {
    const objectIdPattern = /^[0-9a-fA-F]{24}$/;
    return objectIdPattern.test(id);
  }

  loadClasses(): void {
    this.classSubjectService.getClassesBySchool(this.schoolId!).subscribe({
      next: (classes: any[]) => {
        this.classList = classes.map(c => ({ id: c._id, name: c.name }));
        if (this.classList.length === 0) {
          this.toastr.warning('No classes found for this school.');
        }
        this.route.queryParams.subscribe(params => {
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
      },
      error: (err) => {
        console.error('Error loading classes:', err);
        this.toastr.error(err.message || 'Failed to load classes.');
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
          this.toastr.error(err.message || 'Failed to load students.');
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
      this.loadStudents().then(() => {
        if (this.month) {
          this.loadInvoices();
        }
      });
    } else {
      this.selectedClassId = '';
      this.selectedClassName = '';
      this.studentData = [];
      this.invoices = [];
      this.filteredInvoices = [];
      this.ledgerData = [];
      this.summary = null;
    }
  }

  updateStudentSelection(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.selectedStudentId = target.value;
    this.selectedStudent = this.studentData.find(student => student._id === this.selectedStudentId) || null;
    if (this.selectedStudentId && this.activeAcademicYearId) {
      this.getStudentInvoicesData(this.selectedStudentId, this.activeAcademicYearId);
    } else {
      this.ledgerData = [];
      this.summary = null;
      this.filteredInvoices = [];
    }
  }

  getStudentInvoicesData(studentId: string, academicYearId: string): void {
    this.feeService.getStudentInvoices(studentId, academicYearId).subscribe({
      next: (res: any) => {
        this.ledgerData = this.transformToLedger(res.data || []);
        this.summary = res.summary || {};
        this.totalItems = this.ledgerData.length;
        this.filteredInvoices = [...this.ledgerData]; // Bind to table
        if (this.ledgerData.length === 0) {
          this.toastr.info('No invoices found for this student.');
        }
      },
      error: (err) => {
        console.error('Error loading student invoices:', err);
        this.toastr.error(err.error?.message || 'Failed to load student invoices.');
        this.ledgerData = [];
        this.filteredInvoices = [];
      }
    });
  }

  private transformToLedger(rawInvoices: any[]): LedgerRow[] {
    let runningPrevious = 0;
    return rawInvoices.map((inv) => {
      const previousDue = runningPrevious;
      const currentFee = inv.totalAmount - previousDue;
      const totalDues = inv.totalAmount;
      const remainingDue = inv.remainingDue;
      runningPrevious = remainingDue;

      return {
        _id: inv._id,
        month: inv.month,
        previousDue,
        currentFee,
        paidAmount: inv.paidAmount,
        totalDues,
        remainingDue,
        carryForward: remainingDue,
        status: inv.status,
        dueDate: inv.dueDate,
        payments: inv.payments || []
      };
    });
  }

  toggleRowExpansion(invoiceId: string): void {
    if (this.expandedRows.has(invoiceId)) {
      this.expandedRows.delete(invoiceId);
    } else {
      this.expandedRows.add(invoiceId);
    }
  }

  loadInvoices(): void {
    if (!this.selectedClassId || !this.month || !this.activeAcademicYearId) {
      this.toastr.error('Please select a class and month.');
      return;
    }

    this.feeService.getInvoicesByClassAndMonth(this.selectedClassId, this.month, this.activeAcademicYearId).subscribe({
      next: (res) => {
        this.invoices = res.data || [];
        this.totalItems = this.invoices.length;
        this.filterInvoices();
        if (this.invoices.length === 0) {
          this.toastr.info('No invoices found for the selected class and month.');
        }
      },
      error: (err) => {
        console.error('Error loading invoices:', err);
        const errorMessage = err.error?.message || err.message || 'Failed to load invoices.';
        this.toastr.error(errorMessage);
      }
    });
  }

  filterInvoices(): void {
    let dataSource = this.viewMode === 'class' ? this.invoices : this.ledgerData;
    let filtered = dataSource.map(item => {
      const dueDate = new Date(item.dueDate);
      if (item.status === 'Pending' && new Date() > dueDate) {
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
  }

  setViewMode(mode: 'class' | 'student'): void {
    this.viewMode = mode;
    if (this.viewMode === 'class') {
      this.selectedStudentId = '';
      this.selectedStudent = null;
      this.ledgerData = [];
      this.summary = null;
      if (this.month && this.selectedClassId) {
        this.loadInvoices(); // Reload class data
      }
    } else {
      // Student view – if student selected, reload ledger
      if (this.selectedStudentId) {
        this.getStudentInvoicesData(this.selectedStudentId, this.activeAcademicYearId);
      }
    }
    this.filterInvoices();
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
        a.click();
        window.URL.revokeObjectURL(url);
        this.toastr.success('Invoice PDF downloaded successfully.');
      },
      error: (err) => {
        console.error('Error downloading PDF:', err);
        const errorMessage = err.error?.message || err.message || 'Failed to download invoice PDF.';
        this.toastr.error(errorMessage);
      }
    });
  }

  processPayment(invoiceId: string, amount: number): void {
    this.feeService.getInvoiceById(invoiceId).subscribe({
      next: (response) => {
        const invoice = response.data; // Assume { data: Invoice }
        if (invoice && invoice.student?._id) {
          this.router.navigate(['/fee/payment', invoiceId]);
        } else {
          this.toastr.error('Invalid invoice data or student not found.');
        }
      },
      error: (err) => {
        this.toastr.error('Failed to load invoice details: ' + (err.error?.message || err.message));
        console.error('Error fetching invoice:', err);
      }
    });
  }

  notifyParents(): void {
    if (!this.selectedClassId || !this.month || !this.activeAcademicYearId) {
      this.toastr.error('Please select a class and month.');
      return;
    }

    this.feeService.notifyParents(this.selectedClassId, this.month, this.activeAcademicYearId).subscribe({
      next: (res) => {
        this.toastr.success(res.message);
      },
      error: (err) => {
        console.error('Error notifying parents:', err);
        const errorMessage = err.error?.message || err.message || 'Failed to notify parents.';
        this.toastr.error(errorMessage);
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

  // NEW: For ledger table (student view)
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

  getColspan(): number {
    return this.viewMode === 'student' ? 10 : 7; // Ledger 10 columns, class 7
  }
}