import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule, DatePipe } from '@angular/common';
import { ToastrService } from 'ngx-toastr';
import { TeacherAbsence, TeacherAbsenceService, AbsenceStatus } from '../teacher-absence.service';
import { AuthService } from 'src/app/theme/shared/service/auth.service';
import { TeacherService } from '../teacher.service';
import { SchoolService } from '../../school/school.service';
import { trigger, transition, style, animate } from '@angular/animations';

@Component({
  selector: 'app-teacher-apply-leave',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  providers: [DatePipe],
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
  templateUrl: './teacher-apply-leave.component.html',
  styleUrls: ['./teacher-apply-leave.component.scss']
})
export class TeacherApplyLeaveComponent implements OnInit {
  absenceForm: FormGroup;
  loading = false;
  error: string | null = null;
  leaveBalance: number | null = null;
  userTeacherId: string | null = null;
  weeklyHolidayDay: string = 'Sunday';
  schoolId: string | null = null;

  constructor(
    private fb: FormBuilder,
    private teacherAbsenceService: TeacherAbsenceService,
    private teacherService: TeacherService,
    private authService: AuthService,
    private schoolService: SchoolService,
    private toastr: ToastrService,
    private datePipe: DatePipe
  ) {
    this.absenceForm = this.fb.group({
      date: ['', Validators.required],
      reason: ['', [Validators.required, Validators.minLength(5)]],
    });
  }

  ngOnInit(): void {
    this.userTeacherId = this.authService.getTeacherId();
    this.schoolId = this.authService.getSchoolId();
    if (!this.userTeacherId || !this.schoolId) {
      this.error = 'Teacher ID or School ID not found';
      this.toastr.error(this.error);
      return;
    }
    this.loadLeaveBalance();
    this.loadWeeklyHolidayDay();
  }

  loadLeaveBalance(): void {
    this.teacherService.getTeacherById(this.userTeacherId!).subscribe({
      next: (teacher) => {
        this.leaveBalance = teacher.data.leaveBalance || 0;
      },
      error: (err) => {
        this.error = 'Failed to load leave balance';
        this.toastr.error(this.error);
        console.error(err);
      }
    });
  }

  loadWeeklyHolidayDay(): void {
    if (this.schoolId) {
      this.schoolService.loadWeeklyHolidayDay(this.schoolId).subscribe({
        next: (weeklyHolidayDay) => {
          this.weeklyHolidayDay = weeklyHolidayDay;
        },
        error: (err) => {
          this.error = err.message || 'Error loading weekly holiday day';
          this.toastr.error(this.error);
        }
      });
    }
  }

  openConfirmModal(): void {
    if (this.absenceForm.invalid) {
      this.absenceForm.markAllAsTouched();
      this.toastr.error('Please fill out all required fields correctly');
      return;
    }

    const absenceDate = new Date(this.absenceForm.value.date);
    const absenceDay = absenceDate.toLocaleDateString('en-US', { weekday: 'long' });
    if (absenceDay === this.weeklyHolidayDay) {
      this.toastr.error(`Cannot apply for leave on ${this.weeklyHolidayDay} as it is a weekly holiday`);
      return;
    }

    const modal = new (window as any).bootstrap.Modal(document.getElementById('confirmLeaveModal'));
    modal.show();
  }

  submitLeave(): void {
    if (!this.schoolId || !this.userTeacherId) {
      this.toastr.error('School ID or Teacher ID not found');
      return;
    }

    const absenceDate = new Date(this.absenceForm.value.date);
    const dateStr = this.datePipe.transform(absenceDate, 'yyyy-MM-dd')!;
    
    this.teacherAbsenceService.checkHoliday(this.schoolId, dateStr).subscribe({
      next: (holidays) => {
        if (holidays.length > 0) {
          this.toastr.error('Cannot apply for leave on a holiday');
          return;
        }
        this.loading = true;
        const absenceData: TeacherAbsence = {
          teacherId: this.userTeacherId!,
          schoolId: this.schoolId,
          date: absenceDate,
          reason: this.absenceForm.value.reason,
          substituteTeacherId: null,
          status: 'Pending' as AbsenceStatus,
          isTeacherApplied: true
        };
        this.teacherAbsenceService.addAbsence(absenceData).subscribe({
          next: () => {
            this.toastr.success('Leave applied successfully');
            this.absenceForm.reset();
            this.loading = false;
            const modal = (window as any).bootstrap.Modal.getInstance(document.getElementById('confirmLeaveModal'));
            modal.hide();
          },
          error: (err) => {
            this.error = err.error?.message || 'Failed to apply for leave';
            this.toastr.error(this.error);
            this.loading = false;
            console.error(err);
          }
        });
      },
      error: (err) => {
        this.toastr.error('Failed to check holiday status');
        console.error(err);
      }
    });
  }
}