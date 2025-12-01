import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from 'src/app/theme/shared/service/auth.service';
import { TeacherService } from '../teacher.service';
import { FormsModule } from '@angular/forms';
import { HolidayService } from '../../holidays/holiday.service';
import { SchoolService } from '../../school/school.service';
import { ToastrService } from 'ngx-toastr';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-teacher-attendance',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './teacher-attendance.component.html',
  styleUrls: ['./teacher-attendance.component.scss']
})
export class TeacherAttendanceComponent implements OnInit {
  selectedDate: string = new Date().toISOString().split('T')[0];
  selectedStatus: string = 'Present';
  leaveType: string | null = null;
  remarks: string = '';
  errorMessage: string = '';
  successMessage: string = '';
  isHoliday: boolean = false;
  weeklyHolidayDay: string = 'Sunday'; // Default, will be fetched
  maxDate: string = new Date().toISOString().split('T')[0]; // Prevent future dates
  minDate: string = new Date().toISOString().split('T')[0]; // Restrict to today or past
  statuses = ['Present', 'Absent', 'On Leave', 'Holiday'];
  leaveTypes = ['Casual', 'Sick', 'Unpaid', null];
  currentLocation: { lat: number; lng: number } | null = null;
  isSubmitting = false;

  constructor(
    private holidayService: HolidayService,
    private teacherService: TeacherService,
    private authService: AuthService,
    private schoolService: SchoolService,
    private http: HttpClient,
    private router: Router,
    private toastr: ToastrService
  ) {}

  ngOnInit() {
    const userRole = this.authService.getUserRole();
    if (userRole !== 'teacher') {
      this.router.navigate(['/']);
    }
    this.loadWeeklyHolidayDay();
    this.checkHoliday();
  }
  getStatusIcon(status: string): string {
  switch (status) {
    case 'Present': return 'fas fa-user-check';
    case 'Absent': return 'fas fa-user-times';
    case 'On Leave': return 'fas fa-umbrella-beach';
    case 'Holiday': return 'fas fa-calendar-times';
    default: return 'fas fa-question-circle';
  }
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
          this.toastr.error(this.errorMessage);
        }
      });
    } else {
      this.errorMessage = 'School ID not found';
      this.toastr.error(this.errorMessage);
    }
  }

  checkHoliday(): void {
    const schoolId = this.authService.getSchoolId();
    this.holidayService.getHolidays(schoolId, this.selectedDate).subscribe(
      (response: any) => {
        this.isHoliday = response.isHoliday;
        if (this.isHoliday && this.selectedStatus !== 'Holiday') {
          this.selectedStatus = 'Holiday';
          this.errorMessage = 'This is a holiday. Please select "Holiday" status or choose a different date.';
          this.toastr.warning(this.errorMessage);
        } else {
          this.errorMessage = '';
        }
      },
      (error) => {
        this.errorMessage = error.message || 'Error checking holiday status';
        this.toastr.error(this.errorMessage);
      }
    );
  }

  checkHolidayAndWeekly(): void {
    const schoolId = this.authService.getSchoolId();
    const attendanceDate = new Date(this.selectedDate);
    const attendanceDay = attendanceDate.toLocaleDateString('en-US', { weekday: 'long' });

    this.holidayService.getHolidays(schoolId, this.selectedDate).subscribe(
      (response: any) => {
        this.isHoliday = response.isHoliday;
        if (this.isHoliday && this.selectedStatus !== 'Holiday') {
          this.selectedStatus = 'Holiday';
          this.errorMessage = 'This is a holiday. Please select "Holiday" status or choose a different date.';
          this.toastr.warning(this.errorMessage);
        } else if (attendanceDay === this.weeklyHolidayDay && this.selectedStatus !== 'Holiday') {
          this.selectedStatus = 'Holiday';
          this.errorMessage = `This is a weekly holiday (${this.weeklyHolidayDay}). Please select "Holiday" status or choose a different date.`;
          this.toastr.warning(this.errorMessage);
        } else {
          this.errorMessage = '';
        }
      },
      (error) => {
        this.errorMessage = error.message || 'Error checking holiday status';
        this.toastr.error(this.errorMessage);
      }
    );
  }

  onDateChange(): void {
    this.checkHolidayAndWeekly();
  }

  // New method to get current location using Geolocation API
  // private getCurrentLocation(): Promise<{ lat: number; lng: number }> {
  //   return new Promise((resolve, reject) => {
  //     if (!navigator.geolocation) {
  //       reject('Geolocation is not supported by your browser.');
  //     } else {
  //       navigator.geolocation.getCurrentPosition(
  //         (position) => {
  //           resolve({
  //             lat: position.coords.latitude,
  //             lng: position.coords.longitude
  //           });
  //         },
  //         (error) => {
  //           let msg = 'Unable to retrieve your location.';
  //           switch (error.code) {
  //             case error.PERMISSION_DENIED:
  //               msg = 'Location permission denied. Please enable location access in your browser settings.';
  //               break;
  //             case error.POSITION_UNAVAILABLE:
  //               msg = 'Location information is unavailable.';
  //               break;
  //             case error.TIMEOUT:
  //               msg = 'The request to get location timed out.';
  //               break;
  //           }
  //           reject(msg);
  //         }
  //       );
  //     }
  //   });
  // }

private getCurrentLocation(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    // STEP 1: ALWAYS TRY TO GET CURRENT LOGIN SCHOOL'S LOCATION FIRST (MOST IMPORTANT)
    this.schoolService.getMySchool().subscribe({
      next: (school: any) => {
        if (school && school.latitude && school.longitude) {
          console.log('Using CURRENT SCHOOL location (multi-school safe):', school.name, school.latitude, school.longitude);
          return resolve({ lat: school.latitude, lng: school.longitude });
        } else {
          console.warn('School has no lat/lng saved → falling back to GPS');
          this.tryGpsWithSchoolFallback(resolve, reject);
        }
      },
      error: (err) => {
        console.warn('Failed to load school → trying GPS', err);
        this.tryGpsWithSchoolFallback(resolve, reject);
      }
    });
  });
}

// Helper: Try GPS only if school location not available
private tryGpsWithSchoolFallback(
  resolve: (value: { lat: number; lng: number }) => void,
  reject: (reason?: any) => void
) {
  if (!navigator.geolocation) {
    return reject('Geolocation not supported and school location missing');
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const accuracy = position.coords.accuracy;
      if (accuracy <= 100) {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
      } else {
        reject('Poor GPS accuracy. Please ensure school location is set in admin panel.');
      }
    },
    (error) => {
      reject('Location access denied or failed. School location must be configured.');
    },
    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 300000
    }
  );
}

// Helper: Get school location from backend (for multiple schools)
private useSchoolLocation(resolve: (value: { lat: number; lng: number }) => void) {
  this.schoolService.getMySchool().subscribe({
    next: (school: any) => {
      resolve({
        lat: school.latitude,
        lng: school.longitude
      });
    },
    error: () => {
      // Final fallback: your Katihar school
      resolve({ lat: 25.534482, lng: 87.577649 });
    }
  });
}
  async onSubmit(): Promise<void> {
    const activeAcademicYearId = this.authService.getActiveAcademicYearId();
    if (!activeAcademicYearId) {
      this.errorMessage = 'No active academic year found. Please contact administrator.';
      this.toastr.error(this.errorMessage);
      return;
    }
    if ((this.isHoliday || this.isWeeklyHoliday()) && this.selectedStatus !== 'Holiday') {
      this.errorMessage = 'Cannot mark attendance as Present/Absent/On Leave on a holiday or weekly holiday.';
      this.toastr.error(this.errorMessage);
      return;
    }

    try {
      // Get current location before submitting
      const location = await this.getCurrentLocation();
      console.log(location)
      const payload = {
        teacherId: this.authService.getUserId(),
        schoolId: this.authService.getSchoolId(),
        academicYearId: activeAcademicYearId,
        date: this.selectedDate,
        status: this.selectedStatus,
        leaveType: this.selectedStatus === 'On Leave' ? this.leaveType : null,
        remarks: this.remarks || undefined,
        lat: location.lat,
        lng: location.lng
      };

      this.teacherService.markAttendance(payload).subscribe(
        (response: any) => {
          this.successMessage = 'Attendance marked successfully';
          this.toastr.success(this.successMessage);
          this.errorMessage = '';
          setTimeout(() => (this.successMessage = ''), 3000);
        },
        (error: HttpErrorResponse) => {
          this.handleServerError(error);
          this.errorMessage = ''; // Clear errorMessage if handled by toastr
          this.successMessage = '';
        }
      );
    } catch (locationError) {
      this.errorMessage = locationError as string;
      this.toastr.error(this.errorMessage);
    }
  }

  isWeeklyHoliday(): boolean {
    const attendanceDate = new Date(this.selectedDate);
    const attendanceDay = attendanceDate.toLocaleDateString('en-US', { weekday: 'long' });
    return attendanceDay === this.weeklyHolidayDay;
  }

  private handleServerError(error: HttpErrorResponse): void {
    let errorMessage = 'An unexpected error occurred.';

    // Handle the backend response structure
    if (error.error && typeof error.error === 'object' && !error.error.success) {
      errorMessage = error.error.message || error.error.error || 'An error occurred.';
    } else if (error.error && typeof error.error === 'string') {
      errorMessage = error.error; // Handle plain string error
    } else if (error.message) {
      errorMessage = error.message; // Fallback for network errors
    }

    this.toastr.error(errorMessage, 'Error', { closeButton: true, progressBar: true });
  }
}