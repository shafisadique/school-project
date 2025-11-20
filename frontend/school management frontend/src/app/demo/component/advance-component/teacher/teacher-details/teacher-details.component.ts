import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Subject, forkJoin } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { Teacher } from '../teacher.interface';
import { TeacherService } from '../teacher.service';
import { ToastrService } from 'ngx-toastr';
import { takeUntil } from 'rxjs/operators';
import { PaginationComponent } from '../../pagination/pagination.component';

@Component({
  selector: 'app-teacher-details',
  imports: [CommonModule, FormsModule,PaginationComponent,ReactiveFormsModule],
  templateUrl: './teacher-details.component.html',
  styleUrls: ['./teacher-details.component.scss'],
  standalone: true
})
export class TeacherDetailsComponent implements OnInit, OnDestroy {
  teachers: Teacher[] = [];
  selectedTeachers: Teacher[] = [];
  searchQuery = '';
  currentPage = 1;
  pageSize = 25;
  totalItems = 0;
  sortColumn = 'name';
  sortDirection = 'asc';
  selectedStatus = ''; // Simple filter: '' (all), 'true' (active), 'false' (inactive)

  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();

  constructor(
    private teacherService: TeacherService,
    private router: Router,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.setupSearchDebounce();
    this.loadTeachers();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupSearchDebounce(): void {
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.currentPage = 1;
      this.loadTeachers();
    });
  }

  loadTeachers(): void {
    const params: any = {
      page: this.currentPage,
      limit: this.pageSize,
      search: this.searchQuery.trim() || undefined,
      status: this.selectedStatus || undefined,
      sortBy: this.sortColumn,
      sortDir: this.sortDirection
    };

    this.teacherService.getTeachersBySchool(params).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (response: any) => {
        this.teachers = response.data || [];
        this.totalItems = response.total || response.count || 0;
        this.selectedTeachers = []; // Clear selection
      },
      error: (err) => {
        console.error('Error loading teachers:', err);
        this.toastr.error('Failed to load teachers. Please try again.', 'Error');
      }
    });
  }

  onSearchInputChange(event: Event): void {
    const query = (event.target as HTMLInputElement).value;
    this.searchQuery = query;
    this.searchSubject.next(query);
  }

  onSearch(): void {
    this.currentPage = 1;
    this.loadTeachers();
  }

  onFilterChange(): void {
    this.currentPage = 1;
    this.loadTeachers();
  }

  onSort(column: string): void {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
    this.loadTeachers();
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadTeachers();
  }

  onPageSizeChange(size: number): void {
    this.pageSize = size;
    this.currentPage = 1;
    this.loadTeachers();
  }

  // Checkbox Selection Logic
  isTeacherSelected(teacher: Teacher): boolean {
    return this.selectedTeachers.some(t => t._id === teacher._id);
  }

  toggleTeacherSelection(teacher: Teacher, event: Event): void {
    const isChecked = (event.target as HTMLInputElement).checked;
    if (isChecked) {
      this.selectedTeachers.push(teacher);
    } else {
      this.selectedTeachers = this.selectedTeachers.filter(t => t._id !== teacher._id);
    }
  }

  isAllSelected(): boolean {
    return this.teachers.length > 0 && this.teachers.length === this.selectedTeachers.length;
  }

  areSomeSelected(): boolean {
    return this.selectedTeachers.length > 0 && this.selectedTeachers.length < this.teachers.length;
  }

  toggleAllSelection(event: Event): void {
    const isChecked = (event.target as HTMLInputElement).checked;
    this.selectedTeachers = isChecked ? [...this.teachers] : [];
  }

  getImageUrl(profileImage: string): string {
    // Backend returns profileImageUrl directly (full proxy URL), so use it as-is
    // Fallback to key-based proxy if no URL
    if (!profileImage || profileImage.trim() === '') {
      return 'assets/avatar-new.png'; // Fixed typo
    }
    if (profileImage.startsWith('http')) {
      return profileImage;
    }
    const backendUrl = 'https://school-management-backend-khaki.vercel.app';
    return `${backendUrl}/api/proxy-image/${encodeURIComponent(profileImage)}`;
  }

  onImageError(event: Event, teacher: Teacher): void {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
    // Show initials span
    const span = img.nextElementSibling as HTMLElement;
    if (span) {
      span.style.display = 'flex';
    }
    // Update teacher object to hide image next load
    teacher.profileImageUrl = null;
  }

  onUpdateTeacher(): void {
  if (this.selectedTeachers.length === 1) {
    const teacherId = this.selectedTeachers[0]._id;
    this.router.navigate(['/teacher/teacher-update', teacherId]);
  } else {
    this.toastr.warning('Select exactly one teacher to update.', 'Warning');
  }
}

  onDeleteTeacher(): void {
    if (this.selectedTeachers.length === 0) {
      this.toastr.warning('Select at least one teacher to delete.', 'Warning');
      return;
    }

    if (confirm(`Soft delete ${this.selectedTeachers.length} teacher(s)?`)) {
      const deleteRequests = this.selectedTeachers.map(teacher =>
        this.teacherService.softDeleteTeacher(teacher._id) // Use softDeleteTeacher
      );

      forkJoin(deleteRequests).pipe(
        takeUntil(this.destroy$)
      ).subscribe({
        next: () => {
          this.toastr.success('Teacher(s) soft deleted successfully!', 'Success');
          this.loadTeachers();
        },
        error: (err) => {
          console.error('Error deleting teacher(s):', err);
          this.toastr.error('Failed to delete teacher(s). Try again.', 'Error');
        }
      });
    }
  }

  downloadExcel(): void {
    this.teacherService.downloadTeachersExcel().pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (response: Blob) => {
        const url = window.URL.createObjectURL(response);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'teachers.xlsx';
        a.click();
        window.URL.revokeObjectURL(url);
        this.toastr.success('Teachers exported to Excel!', 'Success');
      },
      error: (err) => {
        console.error('Excel download error:', err);
        this.toastr.error('Failed to export Excel.', 'Error');
      }
    });
  }

  getInitials(name: string): string {
    if (!name) return '';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  }

  onViewDetails(teacher: Teacher): void {
    this.router.navigate(['/teacher/details', teacher._id]);
  }

  createTeacher(): void {
    this.router.navigate(['/teacher/teacher-create']);
  }
}