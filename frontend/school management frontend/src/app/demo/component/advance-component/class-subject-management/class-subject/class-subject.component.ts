import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ClassSubjectService } from '../class-subject.service';
import { CommonModule } from '@angular/common';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-class-subject',
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './class-subject.component.html',
  styleUrls: ['./class-subject.component.scss']
})
export class ClassSubjectComponent implements OnInit {
  classForm!: FormGroup;
  subjectForm!: FormGroup;
  classes: any[] = [];
  subjects: any[] = [];
  teachers: any[] = [];
  schoolId!: string;
  loading: boolean = false;

  classList: string[] = [
    'Pre-Nursery (or Playgroup)', 'Nursery', 'Lower Kindergarten (LKG)', 'Upper Kindergarten (UKG)', 'Class I', 'Class II',
    'Class III', 'Class IV', 'Class V', 'Class VI', 'Class VII', 'Class VIII', 'Class IX', 'Class X'
  ];
  classSubjects: string[] = ['English', 'Hindi', 'Mathematics', 'Environmental Science','Urdu', 'General Knowledge', 'Arts', 'Science', 'Social Science', 'Music'];

  constructor(
    private fb: FormBuilder,
    private classSubjectService: ClassSubjectService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.schoolId = localStorage.getItem('schoolId') || '';

    if (!this.schoolId) {
      this.toastr.error('No school ID found in localStorage!', 'Error');
      return;
    }

    this.loadClasses();
    this.loadSubjects();
    this.loadTeachers();

    this.classForm = this.fb.group({
      name: ['', Validators.required],
      sections: ['', Validators.required],
      schoolId: [this.schoolId],
    });

    this.subjectForm = this.fb.group({
      name: ['', Validators.required],
      schoolId: [this.schoolId]
    });
  }

  loadClasses() {
    this.loading = true;
    this.classSubjectService.getClassesBySchool(this.schoolId).subscribe({
      next: (response) => {
        this.classes = response;
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
      next: (response) => {
        this.subjects = response;
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
      next: (response) => {
        this.teachers = response;
        this.loading = false;
      },
      error: (err) => {
        this.toastr.error(err.error?.message || 'Error fetching teachers', 'Error');
        this.loading = false;
      }
    });
  }

  addClass() {
    if (this.classForm.invalid) {
      this.toastr.error('Please fill all required fields', 'Error');
      return;
    }

    this.loading = true;
    const classData = {
      name: this.classForm.value.name,
      sections: this.classForm.value.sections.split(',').map((s: string) => s.trim()),
      schoolId: this.schoolId,
    };

    this.classSubjectService.createClass(classData).subscribe({
      next: () => {
        this.toastr.success('Class added successfully', 'Success');
        this.loadClasses();
        this.classForm.reset({ schoolId: this.schoolId });
        this.loading = false;
      },
      error: (err) => {
        this.toastr.error(err.error?.message || 'Error adding class', 'Error');
        this.loading = false;
      }
    });
  }

  addSubject() {
    if (this.subjectForm.invalid) {
      this.toastr.error('Please fill all required fields', 'Error');
      return;
    }

    this.loading = true;
    const subjectData = {
      name: this.subjectForm.value.name,
      schoolId: this.schoolId
    };

    this.classSubjectService.createSubject(subjectData).subscribe({
      next: () => {
        this.toastr.success('Subject added successfully', 'Success');
        this.loadSubjects();
        this.subjectForm.reset({ schoolId: this.schoolId });
        this.loading = false;
      },
      error: (err) => {
        this.toastr.error(err.error?.message || 'Error adding subject', 'Error');
        this.loading = false;
      }
    });
  }

  getAttendanceTeacher(teacher: any): string {
    if (!teacher) {
      return 'Not assigned';
    }
    return `${teacher.name} (ID: ${teacher._id})`;
  }

  getSubstituteTeachers(substituteTeachers: any[]): string {
    if (!substituteTeachers || substituteTeachers.length === 0) {
      return 'None';
    }
    return substituteTeachers.map(teacher => `${teacher.name} (ID: ${teacher._id})`).join(', ');
  }
}