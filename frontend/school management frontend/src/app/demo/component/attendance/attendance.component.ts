import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ToastrService } from 'ngx-toastr';
import { Router } from '@angular/router';
import { AttendanceService } from './attendance.service';
import { ClassSubjectService } from '../advance-component/class-subject-management/class-subject.service';

@Component({
  selector: 'app-attendance',
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './attendance.component.html',
  styleUrls: ['./attendance.component.scss'],
  standalone: true
})
export class AttendanceComponent implements OnInit {
  attendanceForm!: FormGroup;
  assignments: any[] = [];
  students: any[] = [];
  attendanceHistory: any[] = [];
  classList:any[]=[]
  selectedAcademicYearId: string = '';
  selectedSchoolId: string = '';
  selectedClassId: string = '';
  loading: boolean = false;
  canMarkAttendance: boolean = false;

  constructor(
    private fb: FormBuilder,
    private attendanceService: AttendanceService,
    private classSubjectService: ClassSubjectService,
    private toastr: ToastrService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.selectedSchoolId = localStorage.getItem('schoolId') || '';
    this.selectedAcademicYearId = localStorage.getItem('activeAcademicYearId') || '';
    const teacherId = localStorage.getItem('teacherId') || '';
    this.validateSession();
    this.initForm();
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

  initForm() {
    this.attendanceForm = this.fb.group({
      classId: ['', Validators.required],
      subjectId: ['', Validators.required],
      date: ['', [Validators.required, this.dateNotInFutureValidator.bind(this)]],
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

  dateNotInFutureValidator(control: any) {
    const selectedDate = new Date(control.value);
    const today = new Date();
    selectedDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    return selectedDate > today ? { futureDate: true } : null;
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
        console.log('Loaded assignments:', this.assignments); // Debug log
        this.loading = false;
        if (this.assignments.length === 0) {
          this.toastr.warning('No assignments found for this academic year. Please contact the admin.', 'Warning');
        }
        this.updateCanMarkAttendance();
      },
      error: (err) => {
        this.loading = false;
        this.toastr.error(err.error?.message || 'Error fetching assignments', 'Error');
        if (err.status === 401) {
          this.router.navigate(['/login']);
        }
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
    console.log('Selected class:', selectedClassId, 'Assignment:', assignment, 'Can mark:', this.canMarkAttendance); // Debug log
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
      console.log('Students API Response:', response); // Debug log
      
      // Handle both array and paginated response formats
      this.students = Array.isArray(response) ? response : response?.students || response?.data || [];
      
      console.log('Processed Students:', this.students); // Debug log
      
      if (this.students.length === 0) {
        this.toastr.warning('No students found in this class.', 'Warning');
      }

      // Initialize attendance records
      this.attendanceForm.patchValue({
        attendanceRecords: this.students.map(s => ({ 
          studentId: s._id, 
          status: 'Present' 
        }))
      });
      
      this.loading = false;
    },
    error: (err) => {
      this.loading = false;
      console.error('Error loading students:', err);
      this.toastr.error(err.error?.message || 'Error fetching students', 'Error');
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
      console.log('Attendance History Response:', history); // Debug log
      this.attendanceHistory = Array.isArray(history) ? history : [];
      this.loading = false;
      if (this.attendanceHistory.length === 0) {
        this.toastr.info('No attendance records found for this class and academic year.', 'Info');
      }
    },
    error: (err) => {
      this.loading = false;
      console.error('Error fetching attendance history:', err); // Detailed error log
      this.toastr.error(err.error?.message || 'Error fetching attendance history', 'Error');
      if (err.status === 401) {
        this.router.navigate(['/login']);
      }
    }
  });
}

 getAttendanceStatus(studentId: string): string {
  const records = this.attendanceForm.get('attendanceRecords')?.value || [];
  const record = records.find((r: any) => r.studentId === studentId);
  return record?.status || 'Present'; // Default to Present
}

updateAttendanceStatus(studentId: string, event: Event) {
  const target = event.target as HTMLSelectElement;
  const status = target.value;
  
  const records = this.attendanceForm.get('attendanceRecords')?.value || [];
  const updatedRecords = records.map((record: any) => 
    record.studentId === studentId ? { ...record, status } : record
  );
  
  this.attendanceForm.patchValue({ attendanceRecords: updatedRecords });
}

  onSubmit() {
    console.log('Form value:', this.attendanceForm.value);
    console.log('Form valid:', this.attendanceForm.valid);
    console.log('Form errors:', this.attendanceForm.errors);
    console.log('Date control errors:', this.attendanceForm.get('date')?.errors);
    console.log('Can mark attendance:', this.canMarkAttendance);
  
    if (this.attendanceForm.invalid) {
      this.toastr.error('Please fill all required fields', 'Error');
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
      students: this.attendanceForm.value.attendanceRecords // Changed from attendanceRecords to students
    };
    console.log('Submitting attendance data:', attendanceData);
  
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
        this.toastr.error(err.error?.message || 'Error marking attendance', 'Error');
        console.log('Backend error:', err);
        if (err.status === 401) {
          this.router.navigate(['/login']);
        }
      }
    });
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