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
  students: any[] = [];
  selectedClassId: string = '';
  selectedClassName: string = '';
  selectedStudentId: string = '';
  selectedStudent: any = null; // To store the selected student object
  month: string = '';
  invoices: any[] = [];
  filteredInvoices: any[] = [];
  statusFilter: string = '';
  currentPage: number = 1;
  pageSize: number = 10;
  totalItems: number = 0;
  pageSizeOptions: number[] = [10, 25, 50, 100];
  viewMode: 'class' | 'student' = 'class'; // Toggle between class and student view

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
            console.log('working 1',params['classId'])
          if (params['classId'] && params['month']) {
            console.log('working 2')
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
        this.students = [];
        resolve();
        return;
      }
      this.studentService.getStudentsByClass(this.selectedClassId, this.activeAcademicYearId).subscribe({
        next: (res: any[]) => {
          this.students = res;
          console.log('Loaded students:', this.students);
          if (this.students.length === 0) {
            this.toastr.warning('No students found for the selected class.');
          }
          resolve();
        },
        error: (err) => {
          console.error('Error loading students:', err);
          this.toastr.error(err.message || 'Failed to load students.');
          this.students = [];
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
      this.students = [];
      this.invoices = [];
      this.filteredInvoices = [];
    }
  }

  updateStudentSelection(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.selectedStudentId = target.value;
    this.selectedStudent = this.students.find(student => student._id === this.selectedStudentId) || null;
    this.filterInvoices();
  }

  loadInvoices(): void {
    console.log('working')
    if (!this.selectedClassId || !this.month || !this.activeAcademicYearId) {
      this.toastr.error('Please select a class and month.');
      return;
    }

    this.feeService.getInvoicesByClassAndMonth(this.selectedClassId, this.month, this.activeAcademicYearId).subscribe({
      next: (res) => {
        console.log('Invoices response:', res);
        this.invoices = res.data || [];
        console.log('Parsed invoices:', this.invoices);
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
    const currentDate = new Date('2025-06-17T13:55:00+05:30');
    let filtered = this.invoices.map(invoice => {
      const dueDate = new Date(invoice.dueDate);
      if (invoice.status === 'Pending' && currentDate > dueDate) {
        return { ...invoice, status: 'Overdue' };
      }
      return invoice;
    });

    if (this.statusFilter) {
      filtered = filtered.filter(invoice => invoice.status === this.statusFilter);
    }

    // Apply view mode filtering
    if (this.viewMode === 'student' && this.selectedStudentId) {
      filtered = filtered.filter(invoice => invoice.studentId?._id === this.selectedStudentId);
    }
    // In class view, no student filter is applied unless explicitly selected

    this.totalItems = filtered.length;
    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    this.filteredInvoices = filtered.slice(start, end);
    console.log('Filtered invoices:', this.filteredInvoices);
  }

  setViewMode(mode: 'class' | 'student'): void {
    this.viewMode = mode;
    if (this.viewMode === 'class') {
      this.selectedStudentId = ''; // Reset student selection in class view
      this.selectedStudent = null;
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
        this.toastr.error(errorMessage) ;
      }
    });
  }

processPayment(invoiceId: string, amount: number): void {
    console.log('Processing payment for invoiceId:', invoiceId); // Debug log
    this.feeService.getInvoiceById(invoiceId).subscribe({
      next: (invoice) => {
        console.log('Invoice data:', invoice); // Debug the full response
        if (invoice && invoice.data && invoice.data.student && invoice.data.student._id) {
          this.router.navigate(['/fee/payment', invoiceId]); // Navigate without queryParams
        } else {
          this.toastr.error('Invalid invoice data or student not found.');
        }
      },
      error: (err) => {
        this.toastr.error('Failed to load invoice details: ' + (err.error?.message || err.message));
        console.error('Error fetching invoice:', err); // Debug error
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
        console.log('Notify parents response:', res);
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
}