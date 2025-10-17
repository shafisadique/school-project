import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AuthService } from 'src/app/theme/shared/service/auth.service';
import { AssignmentService } from '../assignment.service';
import { ClassSubjectService } from '../../class-subject-management/class-subject.service';
import { StudentService } from '../../students/student.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-assignment-create',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './assignment-create.component.html',
  styleUrl: './assignment-create.component.scss'
})
export class AssignmentCreateComponent {
  assignmentForm: FormGroup;
  fileList: File[] = [];
  classes: { _id: string; name: string }[] = [];
  students: any[] = [];
  selectedClassId: string | null = null;
  isLoading = false;
  selectedSubjects: { _id: string; name: string }[] = [];
  today: string = new Date().toISOString().split('T')[0]; // Set min date to today

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  private subscriptions: Subscription = new Subscription();
  assignments: any[] = []; // Store assignments data

  constructor(
    private fb: FormBuilder,
    private toasterService: ToastrService,
    private authService: AuthService,
    private assignmentService: AssignmentService,
    private classSubjectService: ClassSubjectService,
    private studentService: StudentService
  ) {
    this.assignmentForm = this.fb.group({
      title: ['', [Validators.required, Validators.maxLength(100)]],
      description: ['', [Validators.required, Validators.maxLength(500)]],
      dueDate: [null, [Validators.required]],
      classId: [null, [Validators.required]],
      subjectId: [null, [Validators.required]],
      assignedTo: [[]]
    });
  }

  ngOnInit(): void {
    const schoolId = this.authService.getSchoolId();
    const academicYearId = this.authService.getActiveAcademicYearId();
    const teacherId = localStorage.getItem('teacherId');

    console.log('Init - schoolId:', schoolId, 'academicYearId:', academicYearId, 'teacherId:', teacherId); // Debug initial values
    if (!schoolId || !academicYearId || !teacherId) {
      this.toasterService.error('Missing school, year, or teacher info. Check your login!');
      return;
    }
    this.loadClassesAndSubjects(teacherId, academicYearId);
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadClassesAndSubjects(teacherId: string, academicYearId: string): void {
    this.isLoading = true;
    this.subscriptions.add(
      this.classSubjectService.getAssignmentsByTeacher(teacherId, academicYearId).subscribe({
        next: (data: any[]) => {
          console.log('Assignments response:', data); // Debug the full response
          this.assignments = Array.isArray(data) ? data : []; // Ensure data is an array
          this.classes = this.extractUniqueClasses(this.assignments);
          this.selectedSubjects = this.extractUniqueSubjects(this.assignments); // Initial subjects
          console.log('Extracted classes:', this.classes); // Debug extracted classes
          console.log('Extracted subjects:', this.selectedSubjects); // Debug extracted subjects
          this.isLoading = false;
          if (this.classes.length === 0) {
            this.toasterService.warning('No classes assigned to you. Check your assignments.');
          }
          if (this.selectedSubjects.length === 0) {
            this.toasterService.warning('No subjects assigned to you. Check your assignments.');
          }
        },
        error: (err) => {
          this.toasterService.error('Failed to load your classes or subjects. Try again! Error:', err.message);
          console.error('Error details:', err);
          this.isLoading = false;
        }
      })
    );
  }

  extractUniqueClasses(data: any[]): { _id: string; name: string }[] {
    const uniqueClasses = new Map<string, { _id: string; name: string }>();
    data.forEach((a) => {
      console.log('Processing class item:', a.classId); // Debug each item
      if (a.classId && a.classId._id && a.classId.name && !uniqueClasses.has(a.classId._id)) {
        uniqueClasses.set(a.classId._id, { _id: a.classId._id, name: a.classId.name });
      } else {
        console.warn('Invalid class data:', a); // Warn if data is malformed
      }
    });
    return Array.from(uniqueClasses.values());
  }

  extractUniqueSubjects(data: any[]): { _id: string; name: string }[] {
    const uniqueSubjects = new Map<string, { _id: string; name: string }>();
    data.forEach((a) => {
      console.log('Processing subject item:', a.subjectId); // Debug each item
      if (a.subjectId && a.subjectId._id && a.subjectId.name && !uniqueSubjects.has(a.subjectId._id)) {
        uniqueSubjects.set(a.subjectId._id, { _id: a.subjectId._id, name: a.subjectId.name });
      } else {
        console.warn('Invalid subject data:', a); // Warn if data is malformed
      }
    });
    return Array.from(uniqueSubjects.values());
  }

  onClassChange(): void {
    const classId = this.assignmentForm.get('classId')?.value;
    if (classId) {
      this.selectedClassId = classId;
      const academicYearId = this.authService.getActiveAcademicYearId();
      if (academicYearId) {
        this.loadStudents(classId, academicYearId);
        this.updateSubjectsForSelectedClass();
      } else {
        this.toasterService.error('Academic year not found.');
      }
    } else {
      this.students = [];
      this.assignmentForm.get('assignedTo')?.setValue([]);
      this.selectedSubjects = [];
      this.assignmentForm.get('subjectId')?.setValue(null);
    }
  }

  updateSubjectsForSelectedClass(): void {
    const classId = this.assignmentForm.get('classId')?.value;
    if (classId && this.assignments) {
      this.selectedSubjects = [...new Map(this.assignments
        .filter((a: any) => a.classId._id === classId)
        .map((a: any) => [a.subjectId._id, { _id: a.subjectId._id, name: a.subjectId.name }])).values()];
      console.log('Filtered subjects for class', classId, ':', this.selectedSubjects); // Debug filtered subjects
      this.assignmentForm.get('subjectId')?.setValue(this.selectedSubjects.length > 0 ? this.selectedSubjects[0]._id : null);
    }
  }

  loadStudents(classId: string, academicYearId: string): void {
    this.subscriptions.add(
      this.studentService.getStudentsByClass(classId, academicYearId).subscribe({
        next: (data) => {
          this.students = data.students || [];
          if (this.students.length === 0) {
            this.toasterService.warning('No students in this class.');
          }
        },
        error: (err) => {
          this.toasterService.error('Failed to load students. Try again!');
          console.error('Error:', err);
        }
      })
    );
  }

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.fileList = Array.from(input.files);
    }
    this.fileInput.nativeElement.value = '';
  }

  removeFile(index: number): void {
    this.fileList.splice(index, 1);
  }

  handleUpload(): void {
    if (this.assignmentForm.invalid) {
      this.toasterService.warning('Please fill all required fields correctly!');
      return;
    }

    this.isLoading = true;
    const formValue = this.assignmentForm.value;
    const files = this.fileList;
    const teacherId = localStorage.getItem('teacherId') || '';

    let dueDate = new Date(formValue.dueDate);
    if (isNaN(dueDate.getTime())) {
      this.toasterService.error('Invalid due date. Please select a valid date.');
      this.isLoading = false;
      return;
    }

    this.subscriptions.add(
      this.assignmentService.createAssignment({
        title: formValue.title,
        description: formValue.description,
        dueDate: dueDate.toISOString(),
        classId: formValue.classId,
        subjectId: formValue.subjectId,
        assignedTo: formValue.assignedTo
      }, files, teacherId).subscribe({
        next: (response) => {
          this.toasterService.success('Assignment created! 🎉');
          this.resetForm();
        },
        error: (err) => {
          this.toasterService.error('Oops! Couldn’t create assignment. ' + (err.error?.message || ''));
          console.error('Error creating assignment:', err);
        }
      }).add(() => {
        this.isLoading = false;
      })
    );
  }

  private resetForm(): void {
    this.assignmentForm.reset({
      title: '',
      description: '',
      dueDate: null,
      classId: null,
      subjectId: null,
      assignedTo: []
    });
    this.fileList = [];
    this.students = [];
    this.selectedClassId = null;
    this.selectedSubjects = [];
  }
}