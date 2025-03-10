import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ClassSubjectService } from '../class-subject.service';

@Component({
  selector: 'app-combined-class-subject-management',
  imports: [CommonModule,FormsModule,ReactiveFormsModule],
  templateUrl: './combined-class-subject-management.component.html',
  styleUrl: './combined-class-subject-management.component.scss'
})
export class CombinedClassSubjectManagementComponent {
  classList: any[] = [];
  subjects: any[] = [];
  teachers: any[] = [];  // ✅ Add teachers array

  assignForm!: FormGroup;
  schoolId: string = '';  // ✅ Make sure this is dynamic (e.g., from AuthService)

  constructor(private classSubjectService: ClassSubjectService, private fb: FormBuilder) {}

  ngOnInit() {
    this.schoolId = localStorage.getItem('schoolId') || '';

    this.loadClasses();
    this.loadSubjects();
    this.loadTeachers(); // ✅ Fetch teachers

    this.assignForm = this.fb.group({
      classId: ['', Validators.required],
      subjectId: ['', Validators.required],
      teacherId: ['', Validators.required] // ✅ Add teacher field

    });
  }

  // ✅ Fetch classes for a specific school
  loadClasses() {
    this.classSubjectService.getClasses(this.schoolId).subscribe({
      next: (classes) => this.classList = classes,
      error: (err) => console.error('Error fetching classes:', err)
    });
  }

  // ✅ Fetch subjects for a specific school
  loadSubjects() {
    this.classSubjectService.getSubjects(this.schoolId).subscribe({
      next: (subjects) => this.subjects = subjects,
      error: (err) => console.error('Error fetching subjects:', err)
    });
  }

    // ✅ Fetch teachers for a specific school
  loadTeachers() {
    this.classSubjectService.getTeachers(this.schoolId).subscribe({
      next: (teachers) => {
        this.teachers = teachers
      },
      error: (err) => console.error('Error fetching teachers:', err)
    });
  }


  // ✅ Assign subject to class
  assignSubject() {
    if (this.assignForm.invalid) {
      console.error('Form is invalid');
      return;
    }

    const { classId, subjectId, teacherId } = this.assignForm.value; // ✅ Include teacherId

    this.classSubjectService.assignSubjectToClass(classId, subjectId, teacherId).subscribe({
      next: (res) => {
        console.log('✅ Subject assigned successfully:', res);
        alert('Subject assigned successfully!');
      },
      error: (err) => {
        console.error('❌ Error assigning subject:', err);
        alert('Failed to assign subject.');
      }
    });
  }

}
