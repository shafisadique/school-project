import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ToastrService } from 'ngx-toastr';
import { TeacherAbsenceService, TeacherAbsence, AbsenceStatus } from '../teacher-absence.service';
import {  TeacherService } from '../teacher.service';
import { AuthService } from 'src/app/theme/shared/service/auth.service';
import { DatePipe } from '@angular/common';
import { Teacher } from '../teacher.interface';

@Component({
  selector: 'app-admin-approve-leave',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  providers: [DatePipe],
  templateUrl: './admin-approve-leave.component.html',
  styleUrls: ['./admin-approve-leave.component.scss']
})
export class AdminApproveLeaveComponent implements OnInit {
  absences: TeacherAbsence[] = [];
  filteredAbsences: TeacherAbsence[] = [];
  teachers: Teacher[] = [];
  loading = false;
  error: string | null = null;
  filterForm: FormGroup;
  currentPage = 1;
  itemsPerPage = 10;
  totalItems = 0;

  constructor(
    private fb: FormBuilder,
    private teacherAbsenceService: TeacherAbsenceService,
    private teacherService: TeacherService,
    private authService: AuthService,
    private toastr: ToastrService,
    private datePipe: DatePipe
  ) {
    this.filterForm = this.fb.group({
      startDate: [''],
      endDate: [''],
      teacherId: ['']
    });
  }

  ngOnInit(): void {
    const schoolId = this.authService.getSchoolId();
    if (!schoolId) {
      this.error = 'Invalid or missing schoolId';
      this.toastr.error(this.error);
      return;
    }
    this.loadTeachers();
    this.loadAbsences();
  }

  loadTeachers(): void {
    this.teacherService.getTeachersBySchool().subscribe({
      next: (response:any) => {
        this.teachers = (Array.isArray(response.data) ? response.data : response).filter(teacher => teacher.status === true);
      },
      error: (err) => {
        this.error = 'Failed to load active teachers';
        this.toastr.error(this.error);
        console.error(err);
      }
    });
  }

  loadAbsences(): void {
    this.loading = true;
    this.error = null;
    const schoolId = this.authService.getSchoolId();
    if (!schoolId) {
      this.error = 'School ID not found';
      this.toastr.error(this.error);
      this.loading = false;
      return;
    }
    const { startDate, endDate, teacherId } = this.filterForm.value;

    this.teacherAbsenceService.getPendingAbsences(schoolId, startDate, endDate, teacherId).subscribe({
      next: (response:any) => {
        this.absences = response.data || response; // Handle response structure
        this.filterAbsences();
        this.loading = false;
        if (!this.absences.length) {
          this.toastr.info('No pending leave applications found.');
        }
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to load pending absences';
        this.toastr.error(this.error);
        this.loading = false;
        console.error(err);
      }
    });
  }

  filterAbsences(): void {
    let result = [...this.absences];
    const { startDate, endDate, teacherId } = this.filterForm.value;
    if (startDate) result = result.filter(a => new Date(a.date) >= new Date(startDate));
    if (endDate) result = result.filter(a => new Date(a.date) <= new Date(endDate));
    if (teacherId) result = result.filter((a: any) => a.teacherId === teacherId || a.teacherId?._id === teacherId);
    this.filteredAbsences = result.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    this.totalItems = result.length;
    this.currentPage = 1;
  }

  getTeacherName(teacherId: string | { _id: string; name: string } | null): string {
    if (!teacherId) return 'Not Assigned';
    if (this.teachers.length && typeof teacherId === 'string') {
      const teacher = this.teachers.find(t => t._id === teacherId);
      return teacher ? teacher.name : teacherId;
    }
    return typeof teacherId === 'string' ? teacherId : (teacherId?.name || 'Unknown');
  }

  approveAbsence(id: string): void {
    this.updateStatus(id, 'Approved');
  }

  rejectAbsence(id: string): void {
    this.updateStatus(id, 'Rejected');
  }

  private updateStatus(id: string, status: AbsenceStatus): void {
    const schoolId = this.authService.getSchoolId();
    if (!schoolId) {
      this.toastr.error('School ID not found');
      this.loading = false;
      return;
    }
    this.loading = true;
    const absenceToUpdate = this.absences.find(a => a._id === id);
    if (!absenceToUpdate) {
      this.toastr.error('Absence not found');
      this.loading = false;
      return;
    }
    this.teacherAbsenceService.updateAbsence(id, { status, schoolId }).subscribe({
      next: (updatedAbsence:any) => {
        this.toastr.success(`Leave ${status.toLowerCase()} successfully`);
        const index = this.absences.findIndex(a => a._id === id);
        if (index !== -1) {
          if (status === 'Approved' || status === 'Rejected') {
            this.absences.splice(index, 1); // Remove from list since it's no longer pending
          } else {
            this.absences[index] = updatedAbsence;
          }
        }
        this.filterAbsences();
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.message || `Failed to ${status.toLowerCase()} leave`;
        this.toastr.error(this.error);
        this.loading = false;
        console.error(err);
      }
    });
  }

  deleteAbsence(id: string): void {
    if (confirm('Are you sure you want to delete this absence?')) {
      const schoolId = this.authService.getSchoolId();
      if (!schoolId) {
        this.toastr.error('School ID not found');
        return;
      }
      this.loading = true;
      this.teacherAbsenceService.deleteAbsence(id, schoolId).subscribe({
        next: () => {
          this.toastr.success('Absence deleted successfully');
          this.absences = this.absences.filter(a => a._id !== id);
          this.filterAbsences();
          this.loading = false;
        },
        error: (err) => {
          this.error = err.error?.message || 'Failed to delete absence';
          this.toastr.error(this.error);
          this.loading = false;
          console.error(err);
        }
      });
    }
  }

  get paginatedAbsences(): TeacherAbsence[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredAbsences.slice(startIndex, startIndex + this.itemsPerPage);
  }

  get totalPages(): number {
    return Math.ceil(this.totalItems / this.itemsPerPage);
  }

  getPageNumbers(): number[] {
    const pages = [];
    for (let i = 1; i <= this.totalPages; i++) pages.push(i);
    return pages;
  }

  prevPage(): void { if (this.currentPage > 1) this.currentPage--; }
  nextPage(): void { if (this.currentPage < this.totalPages) this.currentPage++; }
  goToPage(page: number): void { if (page >= 1 && page <= this.totalPages) this.currentPage = page; }
}