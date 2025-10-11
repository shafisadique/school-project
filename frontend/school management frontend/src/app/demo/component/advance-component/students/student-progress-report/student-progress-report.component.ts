import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { Router } from '@angular/router';
import { ClassSubjectService } from '../../class-subject-management/class-subject.service';
import { StudentService } from '../student.service';

interface Student {
  _id: string;
  name: string;
  admissionNo: string;
}

interface Assignment {
  classId: { _id: string; name: string };
  subjectId: { _id: string; name: string };
}

@Component({
  selector: 'app-student-progress-report',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './student-progress-report.component.html',
  styleUrls: ['./student-progress-report.component.scss']
})
export class StudentProgressReportComponent implements OnInit {
  reportForm: FormGroup;
  students: Student[] = [];
  loading: boolean = false;
  assignments: Assignment[] = [];
  classList: { _id: string; name: string }[] = [];
  selectedClassId: string = '';
  selectedAcademicYearId: string = localStorage.getItem('activeAcademicYearId') || '';
  selectedSchoolId: string = localStorage.getItem('schoolId') || '';
  teacherId: string = localStorage.getItem('teacherId') || localStorage.getItem('userId') || '';

  constructor(
    private fb: FormBuilder,
    private classSubjectService: ClassSubjectService,
    private toastr: ToastrService,
    private router: Router,
    private studentService: StudentService
  ) {
    this.reportForm = this.fb.group({
      classId: ['', Validators.required],
      studentProgress: this.fb.array([])
    });
  }

  get studentProgress(): FormArray {
    return this.reportForm.get('studentProgress') as FormArray;
  }

  ngOnInit(): void {
    this.validateSession();
    this.loadTeacherAssignments();
  }

  validateSession() {
    if (!this.selectedSchoolId || !this.selectedAcademicYearId || !this.teacherId) {
      this.toastr.error('Session data missing. Please log in again.', 'Error');
      this.router.navigate(['/login']);
      return;
    }
  }

  loadTeacherAssignments() {
    this.loading = true;
    const date = new Date().toISOString().split('T')[0];
    this.classSubjectService.getAssignmentsByTeacher(this.teacherId, this.selectedAcademicYearId, date).subscribe({
      next: (data: any) => {
        this.assignments = data;
        this.classList = [...new Map(this.assignments.map(a => [a.classId._id, { _id: a.classId._id, name: a.classId.name }])).values()];
        this.loading = false;
        if (this.classList.length === 0) {
          this.toastr.warning('No classes assigned to you for this academic year.', 'Warning');
        }
      },
      error: (err) => {
        this.loading = false;
        this.toastr.error('Failed to load assignments: ' + err.message, 'Error');
      }
    });
  }

  onClassChange(event: Event) {
    const classId = (event.target as HTMLSelectElement).value;
    this.selectedClassId = classId;
    this.reportForm.get('classId')?.setValue(classId);
    this.loadStudents();
  }

  loadStudents() {
    if (!this.selectedClassId) {
      this.students = [];
      this.studentProgress.clear();
      return;
    }
    this.loading = true;
    this.studentService.getStudentsByClass(this.selectedClassId, this.selectedAcademicYearId).subscribe({
      next: (response: any) => {
        this.students = Array.isArray(response) ? response : response?.students || response?.data || [];
        this.studentProgress.clear();
        this.students.forEach(student => {
          this.studentProgress.push(this.fb.group({
            studentId: [student._id, Validators.required],
            grades: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9\s,:;]+$/)]],
            comments: ['', [Validators.required, Validators.maxLength(160)]]
          }));
        });
        if (this.students.length === 0) {
          this.toastr.warning('No students found in this class.', 'Warning');
        }
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.toastr.error('Failed to load students: ' + err.message, 'Error');
      }
    });
  }

  onSubmit() {
    if (this.reportForm.invalid) {
      this.toastr.error('Please fill all required fields for all students.', 'Error');
      return;
    }

    this.loading = true;
    const payload = { studentProgress: this.studentProgress.value };
    this.studentService.studentProgressReport(payload).subscribe({
      next: () => {
        this.toastr.success('Progress reports saved successfully!', 'Success');
        this.reportForm.reset();
        this.studentProgress.clear();
        this.students = [];
        this.selectedClassId = '';
        this.loading = false;
      },
      error: (err) => {
        this.toastr.error('Failed to save reports: ' + (err.error?.message || err.message), 'Error');
        this.loading = false;
      }
    });
  }
}