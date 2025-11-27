import { Component, OnInit, OnDestroy } from '@angular/core';
import { StudentService } from '../student.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ClassSubjectService } from '../../class-subject-management/class-subject.service';
import { AcademicYearService } from '../../academic-year/academic-year.service';
import { PaginationComponent } from '../../pagination/pagination.component';
import { Subscription, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { NgbDropdownModule, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ToastrService } from 'ngx-toastr';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { SubscriptionService } from '../../../subscription-management/subscription.service';

interface Student {
  _id: string;
  name: string;
  admissionNo: string;
  classId?: { _id: string; name: string };
  phone: string;
  academicYearId: any;
  gender: string;
  profileImage: string;
  dateOfBirth: any;
  address: string;
  status: boolean;
  rollNo: string;
  portalUsername: string;
  portalPassword: string;
  parentPortalPassword: string;
  parentPortalUsername: string;
  parents: parentsDetails;
  selected?: boolean; // Added for selection tracking
}

interface parentsDetails {
  fatherName: string;
  fatherPhone: number;
  motherName: string;
  motherPhone: number;
}

interface Class {
  _id: string;
  name: string;
}

interface AcademicYear {
  _id: string;
  name: string;
}

interface PaginatedResponse {
  students: Student[];
  total: number;
  totalPages: number;
  page: number;
  limit: number;
}

@Component({
  selector: 'app-student-details',
  standalone: true,
  imports: [CommonModule, FormsModule, PaginationComponent, NgbDropdownModule],
  templateUrl: './student-details.component.html',
  styleUrls: ['./student-details.component.scss']
})
export class StudentDetailsComponent implements OnInit, OnDestroy {
  students: Student[] = [];
  selectedStudents: Student[] = []; // Track selected students
  classes: Class[] = [];
  academicYears: AcademicYear[] = [];
  backendUrl = 'http://localhost:5000';

  // Pagination and filtering
  currentPage = 1;
  pageSize = 25;
  totalItems = 0;
  totalPages = 0;
  pageSizeOptions = [10, 25, 50, 100];
  sortColumn: string = 'name'; // Default sort column
  sortDirection: string = 'asc'; // Default sort direction
  selectedClass = '';
  selectedSession = '';
  searchQuery = '';
  schoolId = '';
  isSidebarVisible = false;
  selectedStudent: Student | null = null;
  private queryParamsSubscription?: Subscription;
  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  constructor(
    private studentService: StudentService,
    private classService: ClassSubjectService,
    private toastr: ToastrService,
    private academicYearService: AcademicYearService,
    private subscriptionService:SubscriptionService,
    private route: ActivatedRoute,
    private router: Router,
    private modalService: NgbModal
  ) {}

  ngOnInit(): void {
    this.schoolId = localStorage.getItem('schoolId') || '';
    this.loadClasses();
    this.loadAcademicYears();

    // Debounced search
    this.searchSubject.pipe(
      debounceTime(300),  // Wait 300ms after typing
      distinctUntilChanged(),  // Only if query changed
      takeUntil(this.destroy$)
    ).subscribe(query => {
      this.searchQuery = query;
      this.onSearch();
    });

    this.queryParamsSubscription = this.route.queryParams.subscribe(params => {
      this.currentPage = params['page'] ? parseInt(params['page'], 10) : 1;
      this.pageSize = params['limit'] ? parseInt(params['limit'], 10) : 25;
      this.selectedClass = params['classId'] || '';
      this.selectedSession = params['academicYearId'] || '';
      this.searchQuery = params['search'] || '';
      this.loadStudents();
    });
  }

  ngOnDestroy(): void {
    if (this.queryParamsSubscription) {
      this.queryParamsSubscription.unsubscribe();
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Public method to handle search input changes
  onSearchInputChange(value: any): void {
    this.searchSubject.next(value);
  }

  // Toggle student selection
  toggleStudentSelection(student: Student, event: any): void {
    const isChecked = event.target.checked;
    
    if (isChecked) {
      student.selected = true;
      this.selectedStudents.push(student);
    } else {
      student.selected = false;
      this.selectedStudents = this.selectedStudents.filter(s => s._id !== student._id);
    }
  }

  // Select all students on current page
  toggleAllSelection(event: any): void {
    const isChecked = event.target.checked;
    
    this.students.forEach(student => {
      student.selected = isChecked;
    });
    
    if (isChecked) {
      this.selectedStudents = [...this.students];
    } else {
      this.selectedStudents = [];
    }
  }

  // Check if all students on current page are selected
  areAllSelected(): boolean {
    if (this.students.length === 0) return false;
    return this.students.every(student => student.selected);
  }

  // Check if some but not all students are selected
  areSomeSelected(): boolean {
    return this.selectedStudents.length > 0 && !this.areAllSelected();
  }

  onUpdateStudent(): void {
    if (this.selectedStudents.length === 1) {
      this.router.navigate(['/student/student-update', this.selectedStudents[0]._id]);
    }
  }

  downloadExcel(): void {
    // Prepare data for Excel
    const excelData = this.students.map(student => ({
      Name: student.name,
      'Admission No': student.admissionNo,
      Class: student.classId?.name || '',
      'Academic Year': student?.academicYearId?.name || '',
      'Student Portal Username': student.portalUsername,
      'Student Portal Password': student.portalPassword,
      'Profile Image Key': student.profileImage,
    }));

    // Create worksheet
    const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(excelData);

    // Create workbook
    const workbook: XLSX.WorkBook = {
      Sheets: { 'Students': worksheet },
      SheetNames: ['Students']
    };

    // Generate Excel file
    const excelBuffer: any = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });

    // Save as file
    const data: Blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(data, `students_list_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  onDeleteStudents(): void {
    if (this.selectedStudents.length === 0) return;
    
    const confirmMessage = this.selectedStudents.length === 1 
      ? `Are you sure you want to delete ${this.selectedStudents[0].name}?`
      : `Are you sure you want to delete ${this.selectedStudents.length} students?`;
    
    if (confirm(confirmMessage)) {
      const studentIds = this.selectedStudents.map(s => s._id);
      console.log('Deleting students with IDs:', studentIds); // Debug log
      
      this.studentService.deleteStudents(studentIds).subscribe({
        next: () => {
          this.toastr.success('Students deleted successfully', 'Success');
          this.selectedStudents = [];
          this.loadStudents(); // Reload the student list
        },
        error: (err) => {
          console.error('Delete error:', err); // Debug error
          this.toastr.error(err.error.message || 'Error deleting students', 'Error');
        }
      });
    }
  }

  openStudentDetails(student: Student, content: any): void {
    this.selectedStudent = { ...student };  // Clone to avoid mutations
    this.modalService.open(content, { size: 'lg', backdrop: 'static', centered: true });
  }

  onImageError(event: Event): void {
    const element = event.target as HTMLImageElement;
    element.src = 'assets/avtart-new.png'; // fallback avatar
  }

  loadClasses(): void {
    this.classService.getClassesBySchool(this.schoolId).subscribe({
      next: (classes: Class[]) => {
        this.classes = classes;
      },
      error: (err) => {
        console.error('Error fetching classes:', err);
      }
    });
  }

  loadAcademicYears(): void {
    this.academicYearService.getAllAcademicYears(this.schoolId).subscribe({
      next: (years: AcademicYear[]) => {
        this.academicYears = years;
      },
      error: (err) => {
        console.error('Error fetching academic years:', err);
      }
    });
  }

  loadStudents(): void {
    const params: any = {
      page: this.currentPage,
      limit: this.pageSize
    };

    if (this.selectedClass) params.classId = this.selectedClass;
    if (this.selectedSession) params.academicYearId = this.selectedSession;
    if (this.searchQuery) params.search = this.searchQuery;

    this.studentService.getStudents(params).subscribe({
      next: (response: PaginatedResponse) => {
        this.students = response.students;
        this.students = this.sortStudents(response.students); // Sort the data
        this.totalItems = response.total;
        this.totalPages = response.totalPages;
        this.currentPage = response.page;
        this.pageSize = response.limit;

        // Clear selection when loading new data
        this.students.forEach(s => s.selected = false);
        this.selectedStudents = [];

        // Enhanced empty state
        if (response.students.length === 0) {
          this.toastr.warning('No students found matching your criteria.', 'No Results');
        }
      },
      error: (err) => {
        console.error('Error fetching students:', err);
        this.toastr.error(err.error?.message || 'Failed to load students. Please try again.', 'Error');
        // Fallback: Reset to empty if critical error
        this.students = [];
      }
    });

    this.updateUrl();
  }

  updateUrl(): void {
    const queryParams: any = {
      page: this.currentPage,
      limit: this.pageSize
    };

    if (this.selectedClass) queryParams.classId = this.selectedClass;
    if (this.selectedSession) queryParams.academicYearId = this.selectedSession;
    if (this.searchQuery) queryParams.search = this.searchQuery;

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  onSort(column: string): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    this.loadStudents(); // Reload and sort the data
  }

  private sortStudents(students: Student[]): Student[] {
    return students.sort((a, b) => {
      let aValue = a[this.sortColumn as keyof Student];
      let bValue = b[this.sortColumn as keyof Student];

      // Handle nested properties like classId.name
      if (this.sortColumn === 'classId' && a.classId && b.classId) {
        aValue = a.classId.name;
        bValue = b.classId.name;
      }

      if (aValue == null) aValue = '';
      if (bValue == null) bValue = '';

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return this.sortDirection === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      return this.sortDirection === 'asc' ? (aValue as number) - (bValue as number) : (bValue as number) - (aValue as number);
    });
  }

  createPortal(studentId: string, role: 'student' | 'parent') {
  if (role === 'parent' && localStorage.getItem('role') !== 'admin') {
    this.toastr.error('Only admins can create parent portals.', 'Error');
    return;
  }

  // CHECK PREMIUM PLAN BEFORE CALLING API
  this.subscriptionService.getCurrentSubscription().subscribe({
    next: (sub: any) => {
      const isPremium = sub.planType && (
        sub.planType.toLowerCase().includes('premium') ||
        sub.planType === 'Premium Yearly'
      );

      if (!isPremium) {
        this.toastr.warning(
          'Student/Parent Portal is only available in Premium plans. Please upgrade.',
          'Premium Feature Required',
          { timeOut: 8000 }
        );
        this.router.navigate(['/subscription/plans']);
        return;
      }

      // PREMIUM USER → CALL API
      this.studentService.createPortal(studentId, role).subscribe({
        next: (res) => {
          this.toastr.success(`${res.message}`, 'Success');
          if (role === 'parent' && res.parent) {
            this.showPortalCredentials(res.parent);
            this.loadStudents();
          }
        },
        error: (err) => {
          this.toastr.error(err.error?.message || 'Error creating portal', 'Error');
        }
      });
    },
    error: () => {
      this.toastr.error('Failed to check your plan');
    }
  });
}

  showPortalCredentials(parent: any) {
    const modalRef = this.modalService.open(NgbModal, { size: 'sm', backdrop: 'static' });
    modalRef.componentInstance.title = 'Parent Portal Credentials';
    modalRef.componentInstance.body = `
      <p><strong>Username:</strong> ${parent.username}</p>
      <p><strong>Password:</strong> ${parent.password || 'Set by parent on first login'}</p>
      <p>Please share these with the parent securely.</p>
    `;
    modalRef.componentInstance.okButton = 'Close';
  }

  onSearch(): void {
    this.currentPage = 1;
    this.loadStudents();
  }

  onFilterChange(): void {
    this.currentPage = 1;
    this.loadStudents();
  }

  toggleSidebar(studentId: string): void {
    if (this.isSidebarVisible && !studentId) {
      // Hide sidebar if clicking "Hide Details"
      this.isSidebarVisible = false;
      this.selectedStudent = null;
    } else if (studentId) {
      // Show sidebar and load selected student details
      this.isSidebarVisible = true;
      this.selectedStudent = this.students.find(student => student._id === studentId) || null;
      if (!this.selectedStudent) {
        console.warn('Student not found in students array for ID:', studentId);
      }
    }
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadStudents();
  }

  onPageSizeChange(newSize: number): void {
    this.pageSize = newSize;
    this.currentPage = 1;
    this.loadStudents();
  }

  getImageUrl(profileImage: string): string {
    if (!profileImage || profileImage.trim() === '') {
      return 'assets/avtart-new.png';
    }

    // If it's already a full URL (from older entries), use it directly
    if (profileImage.startsWith('http')) {
      return profileImage;
    }
    // If it's a key (new format), use the proxy endpoint
    const backendUrl = 'https://edglobe.vercel.app'; // Your backend URL
    return `${backendUrl}/api/proxy-image/${encodeURIComponent(profileImage)}`;
  }

  createStudent() {
    this.router.navigate(['/student/student-create']);
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }
}