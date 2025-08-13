import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/theme/shared/service/auth.service';
import { ToastrService } from 'ngx-toastr';
import { AbsenceStatus, TeacherAbsence, TeacherAbsenceService } from '../teacher-absence.service';
import { trigger, transition, style, animate } from '@angular/animations';

@Component({
  selector: 'app-admin-teacher-absence',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  animations: [
    trigger('slideInOut', [
      transition(':enter', [
        style({ transform: 'translateY(-100%)', opacity: 0 }),
        animate('300ms ease-out', style({ transform: 'translateY(0)', opacity: 1 })),
      ]),
      transition(':leave', [
        animate('300ms ease-in', style({ transform: 'translateY(-100%)', opacity: 0 })),
      ]),
    ]),
  ],
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
    private absenceService: TeacherAbsenceService,
    private authService: AuthService,
    private router: Router,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    const userRole = this.authService.getUserRole();
    if (userRole !== 'admin') {
      this.router.navigate(['/']);
      this.toastr.error('Unauthorized access');
      return;
    }
    this.loadPendingAbsences();
  }

  loadPendingAbsences(): void {
    this.loading = true;
    this.errorMessage = '';
    const schoolId = this.authService.getSchoolId();

    this.absenceService.getPendingAutoAbsences(schoolId, this.selectedStartDate, this.selectedEndDate, this.teacherIdFilter).subscribe({
      next: (response) => {
        this.absences = response.data || [];
        console.log('Loaded auto-generated absences:', this.absences); // Debug log
        this.loading = false;
        if (!this.absences.length) {
          this.toastr.info('No pending absences due to forgotten attendance found.');
        }
      },
      error: (err) => {
        this.errorMessage = err.message || 'Error loading auto-generated absences';
        this.loading = false;
        this.toastr.error(this.errorMessage);
      }
    });
  }

  openConfirmModal(absence: TeacherAbsence, action: 'Approved' | 'Rejected'): void {
    const modal = new (window as any).bootstrap.Modal(document.getElementById('confirmActionModal'));
    const modalTitle = document.getElementById('confirmActionModalLabel');
    const modalBody = document.getElementById('confirmActionModalBody');
    const confirmButton = document.getElementById('confirmActionButton');

    if (modalTitle && modalBody && confirmButton) {
      modalTitle.innerText = `${action} Absence Request`;
      const teacherName = typeof absence.teacherId === 'string' ? absence.teacherId : absence.teacherId.name || absence.teacherId._id;
      modalBody.innerHTML = `Are you sure you want to ${action.toLowerCase()} the absence for <strong>${teacherName}</strong> on <strong>${new Date(absence.date).toLocaleDateString()}</strong>? ${action === 'Approved' ? 'This will mark them as Present.' : 'This will confirm their absence and deduct 1 leave day.'}`;
      confirmButton.onclick = () => this.updateAbsence(absence._id, action);
    }
    modal.show();
  }

  updateAbsence(id: string, status: AbsenceStatus): void {
    this.loading = true;
    this.absenceService.updateAbsence(id, { status }).subscribe({
      next: () => {
        this.absences = this.absences.filter(a => a._id !== id);
        this.loading = false;
        const action = status === 'Approved' ? 'approved' : 'rejected';
        this.toastr.success(`Absence request ${action} successfully`);
        const modal = (window as any).bootstrap.Modal.getInstance(document.getElementById('confirmActionModal'));
        modal.hide();
      },
      error: (err) => {
        this.errorMessage = err.message || 'Error updating absence request';
        this.loading = false;
        this.toastr.error(this.errorMessage);
      }
    });
  }
}