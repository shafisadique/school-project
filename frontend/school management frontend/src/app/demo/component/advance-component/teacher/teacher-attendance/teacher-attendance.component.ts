// src/app/teacher-attendance/teacher-attendance.component.ts
import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from 'src/app/theme/shared/service/auth.service';
import { TeacherService } from '../teacher.service';
import { FormsModule } from '@angular/forms';
import { HolidayService } from '../../holidays/holiday.service';
import { SchoolService } from '../../school/school.service';

@Component({
  selector: 'app-teacher-attendance',
  imports: [CommonModule,FormsModule],
  templateUrl: './teacher-attendance.component.html',
  styleUrl: './teacher-attendance.component.scss'
})

export class TeacherAttendanceComponent implements OnInit {
selectedDate: string = new Date().toISOString().split('T')[0]; // July 20, 2025
  selectedStatus: string = 'Present';
  leaveType: string | null = null;
  remarks: string = '';
  errorMessage: string = '';
  successMessage: string = '';
  isHoliday: boolean = false;
  weeklyHolidayDay: string = 'Sunday'; // Default, will be fetched
  minDate: string = new Date().toISOString().split('T')[0]; // Restrict to today or past
  
  statuses = ['Present', 'Absent', 'On Leave', 'Holiday'];
  leaveTypes = ['Casual', 'Sick', 'Unpaid', null];

  constructor(
    private holidayService: HolidayService,
    private teacherService: TeacherService,
    private authService: AuthService,
    private schoolService:SchoolService,
    private http: HttpClient,
    private router: Router
  ) {}

  ngOnInit() {
    const userRole = this.authService.getUserRole();
    if (userRole !== 'teacher') {
      this.router.navigate(['/']);
    }
    this.loadWeeklyHolidayDay();
    this.checkHoliday();
  }

    checkHoliday() {
    const schoolId = this.authService.getSchoolId();
    this.holidayService.getHolidays(schoolId, this.selectedDate).subscribe(
      (response: any) => {
        this.isHoliday = response.isHoliday;
        if (this.isHoliday && this.selectedStatus !== 'Holiday') {
          this.selectedStatus = 'Holiday';
          this.errorMessage = 'This is a holiday. Please select "Holiday" status or choose a different date.';
        } else {
          this.errorMessage = '';
        }
      },
      (error) => {
        this.errorMessage = error.message || 'Error checking holiday status';
      }
    );
  }
  
loadWeeklyHolidayDay(): void {
    const schoolId = this.authService.getSchoolId();
    if (schoolId) {
      this.schoolService.loadWeeklyHolidayDay(schoolId).subscribe({
        next: (weeklyHolidayDay) => {
          this.weeklyHolidayDay = weeklyHolidayDay;
          this.checkHolidayAndWeekly();
        },
        error: (err) => {
          this.errorMessage = err.message || 'Error loading weekly holiday day';
        }
      });
    } else {
      this.errorMessage = 'School ID not found';
    }
  }

  checkHolidayAndWeekly() {
    const schoolId = this.authService.getSchoolId();
    const attendanceDate = new Date(this.selectedDate);
    const attendanceDay = attendanceDate.toLocaleDateString('en-US', { weekday: 'long' });

    this.holidayService.getHolidays(schoolId, this.selectedDate).subscribe(
      (response: any) => {
        this.isHoliday = response.isHoliday;
        if (this.isHoliday && this.selectedStatus !== 'Holiday') {
          this.selectedStatus = 'Holiday';
          this.errorMessage = 'This is a holiday. Please select "Holiday" status or choose a different date.';
        } else if (attendanceDay === this.weeklyHolidayDay && this.selectedStatus !== 'Holiday') {
          this.selectedStatus = 'Holiday';
          this.errorMessage = `This is a weekly holiday (${this.weeklyHolidayDay}). Please select "Holiday" status or choose a different date.`;
        } else {
          this.errorMessage = '';
        }
      },
      (error) => {
        this.errorMessage = error.message || 'Error checking holiday status';
      }
    );
  }

  onDateChange() {
    this.checkHolidayAndWeekly();
  }

  onSubmit() {
    const activeAcademicYearId = this.authService.getActiveAcademicYearId();
    if (!activeAcademicYearId) {
      this.errorMessage = 'No active academic year found. Please contact administrator.';
      return;
    }
    if ((this.isHoliday || this.isWeeklyHoliday()) && this.selectedStatus !== 'Holiday') {
      this.errorMessage = 'Cannot mark attendance as Present/Absent/On Leave on a holiday or weekly holiday.';
      return;
    }

    const payload = {
      teacherId: this.authService.getUserId(),
      schoolId: this.authService.getSchoolId(),
      academicYearId: activeAcademicYearId,
      date: this.selectedDate,
      status: this.selectedStatus,
      leaveType: this.selectedStatus === 'On Leave' ? this.leaveType : null,
      remarks: this.remarks || undefined
    };

    this.teacherService.markAttendance(payload).subscribe(
      (response: any) => {
        this.successMessage = 'Attendance marked successfully';
        this.errorMessage = '';
        setTimeout(() => (this.successMessage = ''), 3000);
      },
      (error) => {
        this.errorMessage = error.message || 'Error marking attendance';
        this.successMessage = '';
      }
    );
  }

  isWeeklyHoliday(): boolean {
    const attendanceDate = new Date(this.selectedDate);
    const attendanceDay = attendanceDate.toLocaleDateString('en-US', { weekday: 'long' });
    return attendanceDay === this.weeklyHolidayDay;
  }
}