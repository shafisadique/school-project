// src/app/admin-teacher-absence/admin-teacher-absence.component.ts
import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/theme/shared/service/auth.service';
import { ToastrService } from 'ngx-toastr';
import { AbsenceStatus, TeacherAbsence, TeacherAbsenceService } from '../teacher-absence.service';

@Component({
  selector: 'app-admin-teacher-absence',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule,FormsModule],
  templateUrl: './admin-teacher-absence.component.html',
  styleUrls: ['./admin-teacher-absence.component.scss']
})
export class AdminTeacherAbsenceComponent implements OnInit {
  absences: TeacherAbsence[] = [];
  errorMessage: string = '';
  loading: boolean = false;
  selectedStartDate: string = '';
  selectedEndDate: string = '';
  teacherIdFilter: string = '';

  constructor(
    private fb: FormBuilder,
    private absenceService: TeacherAbsenceService,
    private authService: AuthService,
    private router: Router,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    const userRole = this.authService.getUserRole();
    if (userRole !== 'admin') {
      this.router.navigate(['/']);
      return;
    }
    this.loadPendingAbsences();
  }

  loadPendingAbsences(): void {
    this.loading = true;
    this.errorMessage = '';
    const schoolId = this.authService.getSchoolId();

    this.absenceService.getPendingAbsences(schoolId, this.selectedStartDate, this.selectedEndDate, this.teacherIdFilter).subscribe({
      next: (response) => {
        this.absences = response.data || [];
        this.loading = false;
        if (!this.absences.length) {
          this.toastr.info('No pending absence requests found.');
        }
      },
      error: (err) => {
        this.errorMessage = err.message || 'Error loading absence requests';
        this.loading = false;
        this.toastr.error(this.errorMessage);
      }
    });
  }

  updateAbsence(id: string, status: any): void {
    this.loading = true;
    this.absenceService.updateAbsence(id, status).subscribe({
      next: () => {
        this.absences = this.absences.filter(a => a._id !== id);
        this.loading = false;
        this.toastr.success(`Absence request ${status.toLowerCase()}d successfully`);
      },
      error: (err) => {
        this.errorMessage = err.message || 'Error updating absence request';
        this.loading = false;
        this.toastr.error(this.errorMessage);
      }
    });
  }}