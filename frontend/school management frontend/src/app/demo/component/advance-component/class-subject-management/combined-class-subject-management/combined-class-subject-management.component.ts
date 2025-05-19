import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ClassSubjectService } from '../class-subject.service';
import { AcademicYearService } from '../../academic-year/academic-year.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-combined-class-subject-management',
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './combined-class-subject-management.component.html',
  styleUrls: ['./combined-class-subject-management.component.scss']
})
export class CombinedClassSubjectManagementComponent implements OnInit {
  classList: any[] = [];
  subjects: any[] = [];
  teachers: any[] = [];
  assignments: any[] = [];
  academicYears: any[] = [];
  assignForm!: FormGroup;
  attendanceTeacherForm!: FormGroup;
  schoolId: string = '';
  selectedAcademicYearId: string = '';
  loading: boolean = false;

  constructor(
    private classSubjectService: ClassSubjectService,
    private fb: FormBuilder,
    private academicYearsService: AcademicYearService,
    private toastr: ToastrService
  ) {}

  ngOnInit() {
    this.schoolId = localStorage.getItem('schoolId') || '';

    if (!this.schoolId) {
      this.toastr.error('No school ID found in localStorage!', 'Error');
      return;
    }

    this.loadClasses();
    this.loadSubjects();
    this.loadTeachers();
    this.loadAcademicYears();

    this.assignForm = this.fb.group({
      classId: ['', Validators.required],
      subjectId: ['', Validators.required],
      teacherId: ['', Validators.required],
      academicYearId: ['', Validators.required],
    });

    this.attendanceTeacherForm = this.fb.group({
      classId: ['', Validators.required],
      attendanceTeacher: [''],
      substituteAttendanceTeachers: [[]],
    });

    this.assignForm.get('academicYearId')?.valueChanges.subscribe(value => {
      this.selectedAcademicYearId = value;
      if (value) {
        this.loadAssignments();
      } else {
        this.assignments = [];
      }
    });
  }

  loadClasses() {
    this.loading = true;
    this.classSubjectService.getClassesBySchool(this.schoolId).subscribe({
      next: (classes) => {
        this.classList = classes;
        this.loading = false;
      },
      error: (err) => {
        this.toastr.error(err.error?.message || 'Error fetching classes', 'Error');
        this.loading = false;
      }
    });
  }

  loadSubjects() {
    this.loading = true;
    this.classSubjectService.getSubjects(this.schoolId).subscribe({
      next: (subjects) => {
        this.subjects = subjects;
        this.loading = false;
      },
      error: (err) => {
        this.toastr.error(err.error?.message || 'Error fetching subjects', 'Error');
        this.loading = false;
      }
    });
  }

  loadTeachers() {
    this.loading = true;
    this.classSubjectService.getTeachers(this.schoolId).subscribe({
      next: (teachers) => {
        this.teachers = teachers;
        this.loading = false;
      },
      error: (err) => {
        this.toastr.error(err.error?.message || 'Error fetching teachers', 'Error');
        this.loading = false;
      }
    });
  }

  loadAcademicYears() {
    this.loading = true;
    this.academicYearsService.getAllAcademicYears(this.schoolId).subscribe({
      next: (academicYears) => {
        this.academicYears = academicYears;
        const activeYear = academicYears.find(year => year.isActive);
        if (activeYear) {
          this.assignForm.patchValue({ academicYearId: activeYear._id });
        }
        this.loading = false;
      },
      error: (err) => {
        this.toastr.error(err.error?.message || 'Error fetching academic years', 'Error');
        this.loading = false;
      }
    });
  }

  loadAssignments() {
    if (!this.selectedAcademicYearId) {
      this.toastr.warning('No academic year selected for fetching assignments', 'Warning');
      this.assignments = [];
      return;
    }
    this.loading = true;
    this.classSubjectService.getCombinedAssignments(this.schoolId, this.selectedAcademicYearId).subscribe({
      next: (data) => {
        this.assignments = data;
        this.loading = false;
      },
      error: (err) => {
        this.toastr.error(err.error?.message || 'Error fetching assignments', 'Error');
        this.loading = false;
      }
    });
  }

  loadClassDetails() {
    const classId = this.attendanceTeacherForm.get('classId')?.value;
    if (classId) {
      const selectedClass = this.classList.find(cls => cls._id === classId);
      if (selectedClass) {
        this.attendanceTeacherForm.patchValue({
          attendanceTeacher: selectedClass.attendanceTeacher?._id || '',
          substituteAttendanceTeachers: selectedClass.substituteAttendanceTeachers?.map(t => t._id) || [],
        });
      }
    }
  }

  assignSubject() {
    if (this.assignForm.invalid) {
      this.toastr.error('Please fill all required fields', 'Error');
      return;
    }

    this.loading = true;
    const { classId, subjectId, teacherId, academicYearId } = this.assignForm.value;

    this.classSubjectService.assignSubjectToClass(classId, subjectId, teacherId, academicYearId).subscribe({
      next: (res) => {
        this.toastr.success('Subject assigned successfully', 'Success');
        this.loadAssignments();
        this.loading = false;
      },
      error: (err) => {
        this.toastr.error(err.error?.message || 'Failed to assign subject', 'Error');
        this.loading = false;
      }
    });
  }

  updateAttendanceTeachers() {
    if (this.attendanceTeacherForm.invalid) {
      this.toastr.error('Please select a class', 'Error');
      return;
    }

    this.loading = true;
    const { classId, attendanceTeacher, substituteAttendanceTeachers } = this.attendanceTeacherForm.value;

    this.classSubjectService.updateAttendanceTeachers(classId, attendanceTeacher, substituteAttendanceTeachers).subscribe({
      next: (res) => {
        this.toastr.success('Attendance teachers updated successfully', 'Success');
        this.loadClasses();
        this.loadAssignments();
        this.loading = false;
      },
      error: (err) => {
        this.toastr.error(err.error?.message || 'Failed to update attendance teachers', 'Error');
        this.loading = false;
      }
    });
  }

  getAttendanceTeacher(attendanceTeacher: any): string {
    if (!attendanceTeacher) {
      return 'Not assigned';
    }
    return `${attendanceTeacher.name} (ID: ${attendanceTeacher._id})`;
  }

  getSubstituteTeachers(substituteTeachers: any[]): string {
    if (!substituteTeachers || substituteTeachers.length === 0) {
      return 'None';
    }
    return substituteTeachers.map(teacher => `${teacher.name} (ID: ${teacher._id})`).join(', ');
  }
}