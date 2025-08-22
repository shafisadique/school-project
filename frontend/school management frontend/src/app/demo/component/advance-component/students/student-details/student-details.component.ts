import { Component, OnInit, OnDestroy } from '@angular/core';
import { StudentService } from '../student.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ClassSubjectService } from '../../class-subject-management/class-subject.service';
import { AcademicYearService } from '../../academic-year/academic-year.service';
import { PaginationComponent } from '../../pagination/pagination.component';
import { Subscription } from 'rxjs';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { ToastrService } from 'ngx-toastr';

interface Student {
  _id: string;
  name: string;
  admissionNo: string;
  classId?: { _id: string; name: string };
  phone: string;
  gender: string;
  profileImage: string;
  dateOfBirth:any;
  address:string;
  status:boolean;
  rollNo:string;
  portalUsername:string;
  portalPassword:string;
  parents: parentsDetails
}
interface parentsDetails{
fatherName:string;
fatherPhone:number;
motherName:string;
motherPhone:number;
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
  imports: [CommonModule, FormsModule, PaginationComponent,NgbDropdownModule],
  templateUrl: './student-details.component.html',
  styleUrls: ['./student-details.component.scss']
})
export class StudentDetailsComponent implements OnInit, OnDestroy {
  students: Student[] = [];
  classes: Class[] = [];
  academicYears: AcademicYear[] = [];
  backendUrl = 'http://localhost:5000';

  // Pagination and filtering
  currentPage = 1;
  pageSize = 25;
  totalItems = 0;
  totalPages = 0;
  pageSizeOptions = [10, 25, 50, 100];
  selectedClass = '';
  selectedSession = '';
  searchQuery = '';
  schoolId = '';
  isSidebarVisible = false;
  selectedStudent: Student | null = null;
  private queryParamsSubscription?: Subscription;

  constructor(
    private studentService: StudentService,
    private classService: ClassSubjectService,
    private toastr:ToastrService,
    private academicYearService: AcademicYearService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.schoolId = localStorage.getItem('schoolId') || '';
    this.loadClasses();
    this.loadAcademicYears();

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
  }
 onUpdateStudent(studentId: string): void {
    this.router.navigate(['/student/student-update', studentId]);
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
        this.totalItems = response.total;
        this.totalPages = response.totalPages;
        this.currentPage = response.page;
        this.pageSize = response.limit;

      },
      error: (err) => {
        console.error('Error fetching students:', err);
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

  

  createPortal(studentId: string, role: 'student' | 'parent') {
    // Assume admin role is checked by backend
    this.studentService.createPortal(studentId, role).subscribe({
      next: (res) => {
        this.toastr.success(`${res.message}`, 'Success');
        console.log('Portal Details:', res.user); // Admin can copy username/password
        // Optionally, show a modal with credentials for admin to print/share
      },
      error: (err) => {
        this.toastr.error(err.error.message || 'Error creating portal', 'Error');
      }
    });
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
    console.log('Selected Student:', this.selectedStudent); // Debug log
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
    if (!profileImage) return 'assets/default-avatar.png';
    const cleanPath = profileImage.replace(/^.*[\\\/]uploads[\\\/]/, '');
    return `${this.backendUrl}/uploads/${cleanPath}`;
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