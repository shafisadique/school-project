// src/app/demo/component/attendance/attendance.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ToastrService } from 'ngx-toastr';
import { Router } from '@angular/router';
import { AttendanceService } from './attendance.service';
import { ClassSubjectService } from '../advance-component/class-subject-management/class-subject.service';
import { NgbModal, NgbModalModule } from '@ng-bootstrap/ng-bootstrap';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-attendance',
  imports: [ReactiveFormsModule, CommonModule, NgbModalModule,FormsModule],
  templateUrl: './attendance.component.html',
  styleUrls: ['./attendance.component.scss'],
  standalone: true
})
export class AttendanceComponent implements OnInit, OnDestroy {
  attendanceForm!: FormGroup;
  editForm!: FormGroup;
  assignments: any[] = [];
  students: any[] = [];
  attendanceHistory: any[] = [];
  classList: any[] = [];
  selectedAcademicYearId: string = '';
  selectedSchoolId: string = '';
  selectedClassId: string = '';
  loading: boolean = false;
  canMarkAttendance: boolean = false;
  selectedAttendance: any = null;
  teacherClasses: any[] = [];
  studentsWithAvatar: any[] = [];

  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private attendanceService: AttendanceService,
    private classSubjectService: ClassSubjectService,
    private toastr: ToastrService,
    private router: Router,
    private modalService: NgbModal
  ) {}

  ngOnInit(): void {
    this.selectedSchoolId = localStorage.getItem('schoolId') || '';
    this.selectedAcademicYearId = localStorage.getItem('activeAcademicYearId') || '';
    this.validateSession();
    this.initForms();
    this.loadTeacherAttendanceClasses();
    if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      () => {}, 
      () => {},
      { timeout: 100 }
    );
  }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  validateSession() {
    if (!this.selectedSchoolId || !this.selectedAcademicYearId) {
      this.toastr.error('School ID or active academic year not found. Please log in again.', 'Error');
      this.router.navigate(['/login']);
      return;
    }
    const token = localStorage.getItem('token');
    if (!token) {
      this.toastr.error('Session expired. Please log in again.', 'Error');
      this.router.navigate(['/login']);
      return;
    }
  }

  initForms() {
    this.attendanceForm = this.fb.group({
      classId: ['', Validators.required],
      subjectId: ['', Validators.required],
      date: ['', [Validators.required, this.todayOnlyValidator.bind(this)]],
      attendanceRecords: [[], Validators.required]
    });

    this.editForm = this.fb.group({
      attendanceRecords: [[], Validators.required]
    });

    this.attendanceForm.get('classId')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(classId => {
        this.selectedClassId = classId;
        this.loadStudents();
        this.loadAttendanceHistory();
        this.updateCanMarkAttendance();
      });

    this.attendanceForm.get('date')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.loadTeacherAttendanceClasses();
      });
  }

  // FIXED: Added missing method
  onClassChange(): void {
    // Already handled via valueChanges above — this is just for template binding
    // No extra logic needed
  }

  loadTeacherAttendanceClasses() {
    this.loading = true;
    this.classSubjectService.getTeacherAttendanceClasses().subscribe({
      next: (classes) => {
        this.teacherClasses = classes;
        this.loading = false;
        if (classes.length === 0) {
          this.toastr.warning('You are not assigned to any class for attendance.', 'No Classes');
        }
      },
      error: (err) => {
        this.loading = false;
        this.handleError(err);
      }
    });
  }

  todayOnlyValidator(control: any) {
    const selectedDate = new Date(control.value);
    const today = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const todayIST = new Date(today.getTime() + istOffset);
    selectedDate.setHours(0, 0, 0, 0);
    todayIST.setHours(0, 0, 0, 0);
    return selectedDate.getTime() === todayIST.getTime() ? null : { notToday: true };
  }

  updateCanMarkAttendance() {
    const classId = this.attendanceForm.get('classId')?.value;
    if (!classId) {
      this.canMarkAttendance = false;
      return;
    }

    const cls = this.teacherClasses.find(c => c._id === classId);
    if (!cls) {
      this.canMarkAttendance = false;
      return;
    }

    const teacherId = this.getTeacherIdFromToken();
    if (!teacherId) {
      this.canMarkAttendance = false;
      return;
    }

    const isAttendanceTeacher = cls.attendanceTeacher?._id === teacherId;
    const isSubstitute = cls.substituteAttendanceTeachers?.some((t: any) => t._id === teacherId);

    this.canMarkAttendance = isAttendanceTeacher || isSubstitute;

    if (!this.canMarkAttendance) {
      this.toastr.warning('You are not authorized to mark attendance for this class.', 'Warning');
    }
  }

  getTeacherIdFromToken(): string | null {
    const token = localStorage.getItem('token');
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.additionalInfo?.teacherId || null;
    } catch {
      return null;
    }
  }

  loadStudents() {
    if (!this.selectedClassId) {
      this.students = [];
      this.studentsWithAvatar = [];
      return;
    }

    this.loading = true;
    this.attendanceService.getStudentsByClass(this.selectedClassId).subscribe({
      next: (response: any) => {
        this.students = Array.isArray(response) ? response : response?.students || response?.data || [];

        // PRE-COMPUTE avatar URL once!
        this.studentsWithAvatar = this.students.map(student => ({
          ...student,
          avatarUrl: this.computeAvatarUrl(student.profileImage),
          initials: this.getInitials(student.name)
        }));

        if (this.students.length === 0) {
          this.toastr.warning('No students composed.', 'Warning');
        }

        // Default all to Present
        this.attendanceForm.patchValue({
          attendanceRecords: this.students.map(s => ({ studentId: s._id, status: 'Present' }))
        });
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.handleError(err);
      }
    });
  }

  // REPLACE your computeAvatarUrl() with this
  private computeAvatarUrl(profileImage: string): string {
    if (profileImage && profileImage.startsWith('http')) return profileImage;
    if (profileImage) return `https://edglobe.vercel.app/api/proxy-image/${encodeURIComponent(profileImage)}`;

    // BEAUTIFUL GRADIENT + INITIALS BACKGROUND (NO FILE NEEDED)
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSJncmFkIiB4MT0iMCUiIHkxPSIwJSIgeDI9IjEwMCUiIHkyPSIxMDAlIj48c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjNGQ5NGUyIi8+PHN0b3Agb2Zmc2V0PSIxMDAlIiBzdG9wLWNvbG9yPSIjNTBjOWMzIi8+PC9saW5lYXJHcmFkaWVudD48L2RlZnM+PHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSJ1cmwoI2dyYWQpIiByeD0iMjAiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1mYW1pbHk9IkFyaWFsLEhlbHZldGljYSxzYW5zLXNlcmlmIiBmb250LXNpemU9IjE0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSIgZmlsbD0iI2ZmZiI+QVQ8L3RleHQ+PC9zdmc+';
  }
  getFallbackSvg(): string {
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjY2NjIiByeD0iMjAiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1zaXplPSIxNiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iIGZpbGw9IiM2NjYiPj88L3RleHQ+PC9zdmc+';
  }
  // PERFECTLY TYPED — NO TS ERRORS, NO 404 SPAM
handleImageError(event: Event, student: any): void {
  const imgElement = event.target as HTMLImageElement;
  if (imgElement) {
    // Use base64 SVG — ZERO network request, ZERO 404
    const fallback = this.getFallbackSvg();
    imgElement.src = fallback;
    student.avatarUrl = fallback; // Prevent Angular from retrying
  }
}


  loadAttendanceHistory() {
    if (!this.selectedClassId || !this.selectedAcademicYearId) {
      this.attendanceHistory = [];
      return;
    }
    this.loading = true;
    this.attendanceService.getAttendanceHistory(this.selectedClassId, this.selectedAcademicYearId).subscribe({
      next: (history) => {
        this.attendanceHistory = Array.isArray(history) ? history : [];
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.handleError(err);
      }
    });
  }

  getAttendanceStatus(studentId: string, form: FormGroup = this.attendanceForm): string {
    const records = form.get('attendanceRecords')?.value || [];
    const record = records.find((r: any) => r.studentId === studentId);
    return record?.status || 'Present';
  }

  updateAttendanceStatus(studentId: string, event: Event, form: FormGroup = this.attendanceForm) {
    const target = event.target as HTMLSelectElement;
    const status = target.value;
    const records = [...(form.get('attendanceRecords')?.value || [])];
    const index = records.findIndex((r: any) => r.studentId === studentId);
    if (index !== -1) {
      records[index].status = status;
    } else {
      records.push({ studentId, status });
    }
    form.patchValue({ attendanceRecords: records });
  }

  // FIXED: Added missing methods
  getImageUrl(imageKey: string): string {
    if (!imageKey) return 'assets/avatar-placeholder.png';
    if (imageKey.startsWith('http')) return imageKey;
    return `https://edglobe.vercel.app/api/proxy-image/${encodeURIComponent(imageKey)}`;
  }

  getInitials(name: string): string {
    if (!name) return '??';
    return name
      .trim()
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  // In component
onImageError(event: any, student: any): void {
  event.target.src = 'assets/images/avatar-placeholder.png';
  student.avatarUrl = event.target.src; // prevent retry
}
  countStatus(record: any, status: string): number {
    if (!record?.students) return 0;
    return record.students.filter((s: any) => s.status === status).length;
  }

  updateEditStatus(index: number, event: Event): void {
    const select = event.target as HTMLSelectElement;
    const newStatus = select.value;
    if (this.selectedAttendance?.students?.[index]) {
      this.selectedAttendance.students[index].status = newStatus;
    }
  }

  // attendance.component.ts → onSubmit() — REPLACE THIS METHOD
async onSubmit() {
  if (this.attendanceForm.invalid || !this.canMarkAttendance || this.students.length === 0) {
    this.toastr.error('Please complete the form correctly.', 'Error');
    return;
  }

  this.loading = true;

  // Step 1: Get current location
  if (!navigator.geolocation) {
    this.toastr.error('Geolocation is not supported by your browser.');
    this.loading = false;
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const payload = {
        classId: this.attendanceForm.value.classId,
        subjectId: this.attendanceForm.value.subjectId,
        academicYearId: this.selectedAcademicYearId,
        date: this.attendanceForm.value.date,
        students: this.attendanceForm.value.attendanceRecords,
        location: {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        }
      };

      this.attendanceService.markAttendance(payload).subscribe({
        next: (response) => {
          this.toastr.success('Attendance marked successfully!', 'Success');
          this.loadAttendanceHistory();
          this.studentsWithAvatar = [];
          this.attendanceForm.reset();
          this.loading = false;
        },
        error: (err) => {
          this.loading = false;
          const msg = err.error?.message || 'Failed to mark attendance';
          this.toastr.error(msg, 'Error');
        }
      });
    },
    (error) => {
      this.loading = false;
      let msg = 'Location access denied';
      if (error.code === 1) msg = 'Please allow location access to mark attendance';
      if (error.code === 2) msg = 'Location unavailable';
      if (error.code === 3) msg = 'Location request timed out';

      this.toastr.error(msg + '. Attendance cannot be marked.', 'Location Required');
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
  );
}

  isToday(date: string): boolean {
    const recordDate = new Date(date);
    const today = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const todayIST = new Date(today.getTime() + istOffset);
    return recordDate.toDateString() === todayIST.toDateString();
  }

  openEditModal(content: any, attendance: any) {
    this.selectedAttendance = JSON.parse(JSON.stringify(attendance)); // Deep clone
    this.editForm.patchValue({
      attendanceRecords: attendance.students.map((s: any) => ({
        studentId: s.studentId._id || s.studentId,
        status: s.status
      }))
    });
    this.modalService.open(content, { size: 'xl', centered: true, scrollable: true });
  }

  onEditSubmit(modal: any) {
    this.loading = true;
    const editData = {
      attendanceId: this.selectedAttendance._id,
      academicYearId: this.selectedAcademicYearId,
      students: this.selectedAttendance.students.map((s: any) => ({
        studentId: s.studentId._id || s.studentId,
        status: s.status
      }))
    };

    this.attendanceService.editAttendance(editData).subscribe({
      next: () => {
        this.toastr.success('Attendance updated successfully', 'Success');
        this.loadAttendanceHistory();
        modal.close();
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.handleError(err);
      }
    });
  }

  handleError(err: any) {
    let msg = err.error?.message || 'An error occurred';
    if (err.status === 401) {
      this.router.navigate(['/login']);
    }
    this.toastr.error(msg, 'Error');
  }

  getClasses() {
    return this.teacherClasses;
  }

  getSubjectNames(subjects: any[]): string {
    if (!subjects || subjects.length === 0) return 'No subjects';
    return subjects.map(s => s.name).join(', ');
  }

  getSubjects() {
    const selectedClassId = this.attendanceForm.get('classId')?.value;
    if (!selectedClassId) return [];
    const cls = this.teacherClasses.find(c => c._id === selectedClassId);
    return cls?.taughtSubjects || [];
  }

  goToMonthlyAttendance() {
    if (!this.selectedClassId || !this.attendanceForm.value.subjectId) {
      this.toastr.error('Please select class and subject first', 'Error');
      return;
    }
    this.router.navigate(['/attendance/monthly'], {
      queryParams: {
        classId: this.selectedClassId,
        subjectId: this.attendanceForm.value.subjectId,
        academicYearId: this.selectedAcademicYearId
      }
    });
  }
}