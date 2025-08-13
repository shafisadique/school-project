import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ToastrService } from 'ngx-toastr';
import { Router } from '@angular/router';
import { AttendanceService } from './attendance.service';
import { ClassSubjectService } from '../advance-component/class-subject-management/class-subject.service';
import { NgbModal, NgbModalModule } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-attendance',
  imports: [ReactiveFormsModule, CommonModule, NgbModalModule],
  templateUrl: './attendance.component.html',
  styleUrls: ['./attendance.component.scss'],
  standalone: true
})
export class AttendanceComponent implements OnInit {
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
    const teacherId = localStorage.getItem('teacherId') || '';
    this.validateSession();
    this.initForms();
    this.loadTeacherAssignments();
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

    this.attendanceForm.get('classId')?.valueChanges.subscribe(classId => {
      this.selectedClassId = classId;
      this.loadStudents();
      this.loadAttendanceHistory();
      this.updateCanMarkAttendance();
    });

    this.attendanceForm.get('date')?.valueChanges.subscribe(() => {
      this.loadTeacherAssignments();
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

  loadTeacherAssignments() {
    const teacherId = localStorage.getItem('teacherId') || '';
    if (!this.selectedAcademicYearId || !teacherId) {
      this.toastr.error('Teacher ID or academic year not found. Please log in again.', 'Error');
      this.router.navigate(['/login']);
      return;
    }
    this.loading = true;
    const date = this.attendanceForm.get('date')?.value || new Date().toISOString().split('T')[0];
    this.classSubjectService.getAssignmentsByTeacher(teacherId, this.selectedAcademicYearId, date).subscribe({
      next: (data) => {
        this.assignments = data;
        this.loading = false;
        if (this.assignments.length === 0) {
          this.toastr.warning('No assignments found for this academic year. Please contact the admin.', 'Warning');
        }
        this.updateCanMarkAttendance();
      },
      error: (err) => {
        this.loading = false;
        this.handleError(err);
      }
    });
  }

  updateCanMarkAttendance() {
    const selectedClassId = this.attendanceForm.get('classId')?.value;
    if (!selectedClassId) {
      this.canMarkAttendance = false;
      return;
    }
    const assignment = this.assignments.find(a => a.classId._id === selectedClassId);
    this.canMarkAttendance = assignment ? assignment.canMarkAttendance : false;
    if (!this.canMarkAttendance) {
      this.toastr.warning('You are not authorized to mark attendance for this class.', 'Warning');
    }
  }

  loadStudents() {
    if (!this.selectedClassId) {
      this.students = [];
      return;
    }
    this.loading = true;
    this.attendanceService.getStudentsByClass(this.selectedClassId).subscribe({
      next: (response: any) => {
        this.students = Array.isArray(response) ? response : response?.students || response?.data || [];
        console.log('Loaded students:', this.students); // Debug
        if (this.students.length === 0) {
          this.toastr.warning('No students found in this class.', 'Warning');
        }
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

  loadAttendanceHistory() {
    if (!this.selectedClassId || !this.selectedAcademicYearId) {
      this.attendanceHistory = [];
      return;
    }
    this.loading = true;
    this.attendanceService.getAttendanceHistory(this.selectedClassId, this.selectedAcademicYearId).subscribe({
      next: (history) => {
        this.attendanceHistory = Array.isArray(history) ? history : [];
        console.log('Attendance history:', this.attendanceHistory); // Debug
        this.loading = false;
        if (this.attendanceHistory.length === 0) {
          this.toastr.info('No attendance records found for this class and academic year.', 'Info');
        }
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
    const records = form.get('attendanceRecords')?.value || [];
    const updatedRecords = records.map((record: any) =>
      record.studentId === studentId ? { ...record, status } : record
    );
    form.patchValue({ attendanceRecords: updatedRecords });
  }

  onSubmit() {
    if (this.attendanceForm.invalid) {
      this.toastr.error('Please fill all required fields correctly.', 'Error');
      return;
    }

    if (!this.canMarkAttendance) {
      this.toastr.error('You are not authorized to mark attendance for this class.', 'Error');
      return;
    }

    this.loading = true;
    const attendanceData = {
      classId: this.attendanceForm.value.classId,
      subjectId: this.attendanceForm.value.subjectId,
      academicYearId: this.selectedAcademicYearId,
      date: this.attendanceForm.value.date,
      students: this.attendanceForm.value.attendanceRecords
    };

    this.attendanceService.markAttendance(attendanceData).subscribe({
      next: (response) => {
        this.toastr.success(response.message || 'Attendance marked successfully', 'Success');
        this.loadAttendanceHistory();
        this.attendanceForm.reset({ classId: '', subjectId: '', date: '' });
        this.students = [];
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.handleError(err);
      }
    });
  }

  isToday(date: string): boolean {
    const recordDate = new Date(date);
    const today = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const todayIST = new Date(today.getTime() + istOffset);
    return recordDate.getFullYear() === todayIST.getFullYear() &&
           recordDate.getMonth() === todayIST.getMonth() &&
           recordDate.getDate() === todayIST.getDate();
  }

  openEditModal(content: any, attendance: any) {
    this.selectedAttendance = attendance;
    this.editForm.patchValue({
      attendanceRecords: attendance.students.map((s: any) => ({
        studentId: s.studentId._id || s.studentId,
        status: s.status,
        remarks: s.remarks || ''
      }))
    });
    this.modalService.open(content, { ariaLabelledBy: 'modal-title', size: 'lg' });
  }

  onEditSubmit(modal: any) {
    if (this.editForm.invalid) {
      this.toastr.error('Please fill all required fields correctly.', 'Error');
      return;
    }

    this.loading = true;
    const editData = {
      attendanceId: this.selectedAttendance._id,
      academicYearId: this.selectedAcademicYearId,
      students: this.editForm.value.attendanceRecords
    };

    this.attendanceService.editAttendance(editData).subscribe({
      next: (response) => {
        this.toastr.success(response.message || 'Attendance updated successfully', 'Success');
        this.loadAttendanceHistory();
        this.modalService.dismissAll();
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.handleError(err);
      }
    });
  }

  handleError(err: any) {
    console.error('Error details:', err);
    let errorMessage = err.error?.message || 'An unexpected error occurred. Please try again.';
    if (err.status === 400 || err.status === 403 || err.status === 404) {
      errorMessage = err.error?.message || errorMessage;
    } else if (err.status === 401) {
      errorMessage = 'Session expired. Please log in again.';
      this.router.navigate(['/login']);
    } else if (err.status >= 500) {
      errorMessage = err.error?.message || 'Server error. Please contact support.';
    }
    this.toastr.error(errorMessage, 'Error');
  }

  getClasses() {
    const classes = [...new Map(this.assignments.map(a => [a.classId._id, { _id: a.classId._id, name: a.classId.name }])).values()];
    return classes;
  }

  getSubjects() {
    const subjects = [...new Map(this.assignments
      .filter(a => a.classId._id === this.selectedClassId)
      .map(a => [a.subjectId._id, { _id: a.subjectId._id, name: a.subjectId.name }])).values()];
    return subjects;
  }

  goToDashboard() {
    this.router.navigate(['/dashboard/default']);
  }

  goToMonthlyAttendance() {
    if (!this.selectedClassId || !this.attendanceForm.value.subjectId) {
      this.toastr.error('Please select a class and subject first.', 'Error');
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