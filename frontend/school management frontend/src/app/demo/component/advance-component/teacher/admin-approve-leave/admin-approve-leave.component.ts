// src/app/admin-approve-leave/admin-approve-leave.component.ts
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ToastrService } from 'ngx-toastr';
import { TeacherAbsenceService, TeacherAbsence, AbsenceStatus } from '../teacher-absence.service';
import { Teacher, TeacherService } from '../teacher.service';
import { AuthService } from 'src/app/theme/shared/service/auth.service';
import { DatePipe } from '@angular/common';

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
    private modalService: NgbModal,
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
      next: (response) => {
        this.teachers = Array.isArray(response.data) ? response.data : response;
      },
      error: (err) => {
        this.error = 'Failed to load teachers';
        this.toastr.error(this.error);
        console.error(err);
      }
    });
  }

  loadAbsences(): void {
    this.loading = true;
    this.error = null;
    const schoolId = this.authService.getSchoolId();
    const params: any = { schoolId };
    const { startDate, endDate, teacherId } = this.filterForm.value;
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    if (teacherId) params.teacherId = teacherId;

    this.teacherAbsenceService.getAbsences(params).subscribe({
      next: (absences) => {
        this.absences = absences;
        this.filterAbsences();
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.message || 'Failed to load absences';
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
    if (teacherId) result = result.filter(a => a.teacherId === teacherId);
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
      next: (updatedAbsence) => {
        this.toastr.success(`Leave ${status.toLowerCase()}d successfully`);
        // Update the local absence array
        const index = this.absences.findIndex(a => a._id === id);
        if (index !== -1) this.absences[index] = updatedAbsence;
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