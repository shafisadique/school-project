// teacher-apply-leave/teacher-apply-leave.component.ts
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule, DatePipe } from '@angular/common';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ToastrService } from 'ngx-toastr';
import { TeacherAbsence, TeacherAbsenceService, AbsenceStatus } from '../teacher-absence.service';
import { AuthService } from 'src/app/theme/shared/service/auth.service';
import { TeacherService } from '../teacher.service';
import { HttpClient } from '@angular/common/http';
import { SchoolService } from '../../school/school.service';

@Component({
  selector: 'app-teacher-apply-leave',
  standalone: true,
  imports: [CommonModule,FormsModule,ReactiveFormsModule],
  providers: [DatePipe],
  templateUrl: './teacher-apply-leave.component.html',
  styleUrls: ['./teacher-apply-leave.component.scss']
})
export class TeacherApplyLeaveComponent implements OnInit {
 absenceForm: FormGroup;
  loading = false;
  error: string | null = null;
  leaveBalance: number | null = null;
  userTeacherId: string | null = null;
  weeklyHolidayDay: string = 'Sunday'; // Default, will be fetched

  constructor(
    private fb: FormBuilder,
    private teacherAbsenceService: TeacherAbsenceService,
    private teacherService: TeacherService,
    private authService: AuthService,
    private modalService: NgbModal,
    private schoolService:SchoolService,
    private toastr: ToastrService,
    private datePipe: DatePipe,
    private http: HttpClient
  ) {
    this.absenceForm = this.fb.group({
      date: ['', Validators.required],
      reason: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.userTeacherId = this.authService.getUserId(); // Assuming getUserId returns teacherId
    if (!this.userTeacherId) {
      this.error = 'Teacher ID not found';
      this.toastr.error(this.error);
      return;
    }
    this.loadLeaveBalance();
    this.loadWeeklyHolidayDay();
  }

  loadLeaveBalance(): void {
    this.teacherService.getTeacherById(this.userTeacherId!).subscribe({
      next: (teacher) => {
        this.leaveBalance = teacher.leaveBalance || 0;
      },
      error: (err) => {
        this.error = 'Failed to load leave balance';
        this.toastr.error(this.error);
        console.error(err);
      }
    });
  }

loadWeeklyHolidayDay(): void {
    const schoolId = this.authService.getSchoolId();
    if (schoolId) {
      this.schoolService.loadWeeklyHolidayDay(schoolId).subscribe({
        next: (weeklyHolidayDay) => {
          this.weeklyHolidayDay = weeklyHolidayDay;
        },
        error: (err) => {
          this.error = err.message || 'Error loading weekly holiday day';
          this.toastr.error(this.error);
        }
      });
    } else {
      this.error = 'School ID not found';
      this.toastr.error(this.error);
    }
  }

  onSubmit(): void {
    if (this.absenceForm.invalid) {
      this.absenceForm.markAllAsTouched();
      return;
    }

    const absenceDate = new Date(this.absenceForm.value.date);
    const absenceDay = absenceDate.toLocaleDateString('en-US', { weekday: 'long' });
    if (absenceDay === this.weeklyHolidayDay) {
      this.toastr.error(`Cannot apply for leave on ${this.weeklyHolidayDay} as it is a weekly holiday`);
      return;
    }

    const schoolId = this.authService.getSchoolId();
    if (!schoolId) {
      this.toastr.error('School ID not found');
      return;
    }

    const dateStr = this.datePipe.transform(absenceDate, 'yyyy-MM-dd')!;
    this.teacherAbsenceService.checkHoliday(schoolId, dateStr).subscribe({
      next: (holidays) => {
        if (holidays.length > 0) {
          this.toastr.error('Cannot apply for leave on a holiday');
          return;
        }
        this.loading = true;
        const absenceData: TeacherAbsence = {
          teacherId: this.userTeacherId!,
          schoolId,
          date: this.absenceForm.value.date,
          reason: this.absenceForm.value.reason,
          substituteTeacherId: null,
          status: 'Pending' as AbsenceStatus
        };
        this.teacherAbsenceService.addAbsence(absenceData).subscribe({
          next: () => {
            this.toastr.success('Leave applied successfully');
            this.absenceForm.reset();
            this.loading = false;
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