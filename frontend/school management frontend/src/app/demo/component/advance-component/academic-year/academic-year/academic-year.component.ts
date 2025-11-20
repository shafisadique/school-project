// academic-year.component.ts — FULLY PRODUCTION READY (2025 Standards)

import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';

import { AuthService } from 'src/app/theme/shared/service/auth.service';
import { AcademicYearService } from '../academic-year.service';

interface AcademicYear {
  _id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive?: boolean;
}

@Component({
  selector: 'app-academic-year',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './academic-year.component.html',
  styleUrl: './academic-year.component.scss',
})
export class AcademicYearComponent implements OnInit {
  // Inject services (modern Angular way)
  private destroyRef = inject(DestroyRef);
  private authService = inject(AuthService);
  private academicYearService = inject(AcademicYearService);
  private toastr = inject(ToastrService);

  // Form state
  newAcademicYear = {
    academicYearId: '',
    name: '',
    startDate: '',
    endDate: '',
  };
  isEditMode = false;
  loading = false;

  // Data
  availableYears: AcademicYear[] = [];
  currentAcademicYear: AcademicYear | null = null;
  schoolId: string | null = null;

  ngOnInit(): void {
    this.schoolId = this.authService.currentSchoolId();
    if (!this.schoolId) {
      this.toastr.error('School session expired. Please login again.', 'Error');
      return;
    }

    this.loadAcademicYears();
  }

  private loadAcademicYears(): void {
    if (!this.schoolId) return;

    // Load active year
    this.academicYearService
      .getActiveAcademicYear(this.schoolId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => (this.currentAcademicYear = data),
        error: () => this.toastr.error('Failed to load active session'),
      });

    // Load all years
    this.academicYearService
      .getAllAcademicYears(this.schoolId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => (this.availableYears = data),
        error: () => this.toastr.error('Failed to load academic sessions'),
      });
  }

  createAcademicYear(): void {
    if (this.loading) return;

    const { name, startDate, endDate } = this.newAcademicYear;
    if (!name?.trim() || !startDate || !endDate) {
      this.toastr.warning('Please fill all fields');
      return;
    }

    if (new Date(startDate) >= new Date(endDate)) {
      this.toastr.error('End date must be after start date');
      return;
    }

    this.loading = true;

    const payload: any = {
      name: name.trim(),
      startDate: new Date(startDate).toISOString(),
      endDate: new Date(endDate).toISOString(),
    };

    const action$ = this.isEditMode
      ? this.academicYearService.editAcademicYear({
          ...payload,
          academicYearId: this.newAcademicYear.academicYearId,
        })
      : this.academicYearService.createAcademicYear(payload);

    action$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toastr.success(
            this.isEditMode ? 'Session updated!' : 'Session created!'
          );
          this.resetForm();
          this.loadAcademicYears();
        },
        error: (err) => {
          this.loading = false;
          this.toastr.error(
            err.error?.message || 'Operation failed. Please try again.'
          );
        },
        complete: () => (this.loading = false),
      });
  }

  editYear(year: AcademicYear): void {
    this.newAcademicYear = {
      academicYearId: year._id,
      name: year.name,
      startDate: year.startDate.split('T')[0],
      endDate: year.endDate.split('T')[0],
    };
    this.isEditMode = true;
  }

  cancelEdit(): void {
    this.resetForm();
  }

  private resetForm(): void {
    this.newAcademicYear = {
      academicYearId: '',
      name: '',
      startDate: '',
      endDate: '',
    };
    this.isEditMode = false;
    this.loading = false;
  }

  activateYear(yearId: string): void {
    if (!this.schoolId || yearId === this.currentAcademicYear?._id) return;

    this.academicYearService
      .activateAcademicYear(yearId, this.schoolId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toastr.success('Active session updated!');
          this.loadAcademicYears();
        },
        error: () => this.toastr.error('Failed to activate session'),
      });
  }
}