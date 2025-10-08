// src/app/student-progress-report/student-progress-report.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ToastrService } from 'ngx-toastr'; // Ensure ngx-toastr is installed and configured
import { Router } from '@angular/router';
import { ClassSubjectService } from '../../class-subject-management/class-subject.service';
import { StudentService } from '../student.service';

interface Student {
  _id: string;
  name: string;
  parentId: string; // Assuming fetched or populated
}

interface Assignment {
  classId: { _id: string; name: string };
  subjectId: { _id: string; name: string };
  // Other fields as per your Assignment interface
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
  selectedStudent: Student | null = null;
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
    private studentService: StudentService // Fixed typo from studenProgressService
  ) {
    this.reportForm = this.fb.group({
      classId: ['', Validators.required],
      studentId: ['', Validators.required],
      message: ['', Validators.required],
      grades: [''],
      attendance: [''],
      comments: ['']
    });
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
    const date = new Date().toISOString().split('T')[0]; // Current date for assignments
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
    this.reportForm.get('studentId')?.setValue(''); // Reset student selection
    this.selectedStudent = null; // Reset selected student
  }

  loadStudents() {
    if (!this.selectedClassId) {
      this.students = [];
      this.reportForm.get('studentId')?.setValue('');
      this.selectedStudent = null;
      return;
    }
    this.loading = true;
    this.classSubjectService.getStudentsByClass(this.selectedClassId, this.selectedAcademicYearId).subscribe({
      next: (response: any) => {
        this.students = Array.isArray(response) ? response : response?.students || response?.data || [];
        if (this.students.length === 0) {
          this.toastr.warning('No students found in this class.', 'Warning');
        } else {
          // Pre-populate studentId if only one student (optional)
          if (this.students.length === 1) {
            this.reportForm.get('studentId')?.setValue(this.students[0]._id);
            this.onStudentChange({ target: { value: this.students[0]._id } } as any);
          }
        }
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.toastr.error('Failed to load students: ' + err.message, 'Error');
      }
    });
  }

  onStudentChange(event: Event): void {
    const studentId = (event.target as HTMLSelectElement).value;
    this.reportForm.get('studentId')?.setValue(studentId);
    this.loading = true; // Show loading while fetching student details
    this.studentService.getStudentById(studentId).subscribe({
      next: (res: any) => {
        console.log('Student details response:', res); // Debug: Check the API response
        this.selectedStudent = {
          _id: res._id,
          name: res.name,
          parentId: res.parentId || (res.parent ? res.parent._id : null) // Handle populated parent or null
        };
        console.log('Selected student:', this.selectedStudent); // Debug: Verify parentId
        this.loading = false;
        if (!this.selectedStudent.parentId) {
          this.toastr.warning('No parent associated with this student.', 'Warning');
        }
      },
      error: (err) => {
        this.loading = false;
        this.toastr.error('Failed to load student details: ' + err.message, 'Error');
        this.selectedStudent = null; // Reset on error
      }
    });
  }

  onSubmit(): void {
    console.log('Form value:', this.reportForm.value); // Debug: Check form data
    console.log('Selected student:', this.selectedStudent); // Debug: Check if set
    if (this.reportForm.invalid) {
      this.toastr.error('Please fill all required fields.', 'Error');
      return;
    }
    if (!this.selectedStudent || !this.selectedStudent.parentId) {
      this.toastr.error('Please select a student with a parent.', 'Error');
      return;
    }

    this.loading = true;
    const formData = this.reportForm.value;
    const payload = {
      studentId: formData.studentId,
      message: formData.message,
      data: {
        grades: formData.grades,
        attendance: formData.attendance,
        comments: formData.comments
      },
      parentId: this.selectedStudent.parentId
    };

    this.studentService.studentProgressReport(payload).subscribe({
      next: () => {
        this.toastr.success('Progress report sent successfully!', 'Success');
        this.reportForm.reset();
        this.selectedStudent = null;
        this.students = [];
        this.loading = false;
      },
      error: (err) => {
        this.toastr.error('Failed to send report: ' + (err.error?.error || err.message), 'Error');
        this.loading = false;
      }
    });
  }
}