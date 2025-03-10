import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ClassSubjectService } from '../class-subject.service';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-class-subject',
  imports: [CommonModule,FormsModule,ReactiveFormsModule],
  templateUrl: './class-subject.component.html',
  styleUrl: './class-subject.component.scss'
})
export class ClassSubjectComponent implements OnInit{
  classForm!: FormGroup;
  subjectForm!: FormGroup;
  classes: any[] = [];
  subjects: any[] = [];

  schoolId!: string;

  // Predefined class list
  classList: string[] = [
    'Pre-Nursery', 'Nursery', 'KG', 'class 1', 'class 2', 'class 3',
    'class 4', 'class 5', 'class 6', 'class 7', 'class 8',
    'class 9', 'class 10'
  ];
  classSubjects:any[]=['English','Hindi','Mathematics','Environmental Science','General Knowledge','Arts','Science','Social Science','Music']

  constructor(
    private fb: FormBuilder,
    private classSubjectService: ClassSubjectService
  ) {}

  ngOnInit(): void {
    // ✅ Get School ID from Local Storage
    this.schoolId = localStorage.getItem('schoolId') || '';

    if (!this.schoolId) {
      console.error('No school ID found in localStorage!');
      return;
    }

    this.loadClasses();
    this.loadSubjects();

    // Initialize Forms
    this.classForm = this.fb.group({
      name: ['', Validators.required],
      sections: ['', Validators.required],
      schoolId: [this.schoolId] // Include school ID
    });

    this.subjectForm = this.fb.group({
      name: ['', Validators.required],
      schoolId: [this.schoolId] // Include school ID
    });
  }

  // ✅ Load Classes for the Current School
  loadClasses() {
    this.classSubjectService.getClasses(this.schoolId).subscribe(response => {
      this.classes = response;
    });
  }

  // ✅ Load Subjects for the Current School
  loadSubjects() {
    this.classSubjectService.getSubjects(this.schoolId).subscribe(response => {
      this.subjects = response;
    });
  }

  // ✅ Add Class
  addClass() {
    if (this.classForm.valid) {
      const classData = {
        name: this.classForm.value.name,
        sections: this.classForm.value.sections.split(',').map((s: string) => s.trim()),
        schoolId: this.schoolId
      };

      this.classSubjectService.createClass(classData).subscribe(() => {
        this.loadClasses(); // Refresh list
        this.classForm.reset({ schoolId: this.schoolId }); // Preserve schoolId
      });
    }
  }

  // ✅ Add Subject
  addSubject() {
    if (this.subjectForm.valid) {
      const subjectData = {
        name: this.subjectForm.value.name,
        schoolId: this.schoolId
      };

      this.classSubjectService.createSubject(subjectData).subscribe(() => {
        this.loadSubjects(); // Refresh list
        this.subjectForm.reset({ schoolId: this.schoolId }); // Preserve schoolId
      });
    }
  }

}
