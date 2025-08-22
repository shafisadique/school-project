import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AuthService } from 'src/app/theme/shared/service/auth.service';
import { AssignmentService } from './assignment.service';
import { ClassSubjectService } from '../class-subject-management/class-subject.service';
import { StudentService } from '../students/student.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-assignment-management',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './assignment-management.component.html',
  styleUrls: ['./assignment-management.component.scss']
})
export class AssignmentManagementComponent implements OnInit, OnDestroy {
  assignmentForm: FormGroup;
  fileList: File[] = []; // Tracks selected files
  assignments: any[] = []; // Teacher's assigned data
  classes: any[] = []; // Unique classes from assignments
  students: any[] = [];
  selectedClassId: string | null = null;
  isLoading = false;
  selectedSubjects: { _id: string; name: string }[] = []; // Subjects for selected class

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  private subscriptions: Subscription = new Subscription();

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
      dueDate: [null, [Validators.required]], // Ensure it's nullable initially
      classId: [null, [Validators.required]],
      subjectId: [null, [Validators.required]],
      assignedTo: [[]]
    });
  }

  ngOnInit(): void {
    const schoolId = this.authService.getSchoolId();
    const academicYearId = this.authService.getActiveAcademicYearId();
    const teacherId = localStorage.getItem('teacherId'); // Get teacherId from localStorage
    const role = this.authService.getUserRole();
    console.log('User Info:', { schoolId, academicYearId, teacherId, role }); // Debug

    if (!schoolId || !academicYearId || !teacherId) {
      this.toasterService.error('Missing school, year, or teacher info. Check your login!');
      return;
    }
    this.loadTeacherAssignments(teacherId, academicYearId); // Load teacher's assignments
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  // Load teacher's assignments and extract classes/subjects
  loadTeacherAssignments(teacherId: string, academicYearId: string): void {
    this.isLoading = true;
    this.subscriptions.add(
      this.classSubjectService.getAssignmentsByTeacher(teacherId, academicYearId).subscribe({
        next: (data) => {
          this.assignments = data;
          console.log('Teacher Assignments:', this.assignments); // Debug
          this.classes = [...new Map(this.assignments.map(a => [a.classId._id, { _id: a.classId._id, name: a.classId.name }])).values()];
          console.log('Unique Classes:', this.classes); // Debug
          this.updateSubjects(); // Update subjects for all classes
          this.isLoading = false;
          if (this.classes.length === 0) {
            this.toasterService.warning('No classes assigned to you.');
          }
        },
        error: (err) => {
          this.toasterService.error('Failed to load your assignments. Try again!');
          console.error('Error:', err);
          this.isLoading = false;
        }
      })
    );
  }

  // When a class is selected
  onClassChange(): void {
    const classId = this.assignmentForm.get('classId')?.value;
    if (classId) {
      this.selectedClassId = classId;
      const academicYearId = this.authService.getActiveAcademicYearId();
      console.log('Selected Class:', classId, 'Year:', academicYearId);
      if (academicYearId) {
        this.loadStudents(classId, academicYearId);
        this.updateSubjectsForSelectedClass(); // Update subjects for the selected class
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

  // Update subjects for the selected class
  updateSubjectsForSelectedClass(): void {
    this.selectedSubjects = [...new Map(this.assignments
      .filter(a => a.classId._id === this.selectedClassId)
      .map(a => [a.subjectId._id, { _id: a.subjectId._id, name: a.subjectId.name }])).values()];
    console.log('Subjects for Selected Class:', this.selectedSubjects); // Debug
    this.assignmentForm.get('subjectId')?.setValue(this.selectedSubjects.length > 0 ? this.selectedSubjects[0]._id : null);
  }

  // Update subjects for all classes (new method)
  updateSubjects(): void {
    this.selectedSubjects = [...new Map(this.assignments
      .map(a => [a.subjectId._id, { _id: a.subjectId._id, name: a.subjectId.name }])).values()];
    console.log('All Subjects:', this.selectedSubjects); // Debug
  }

  // Load students for the selected class
  loadStudents(classId: string, academicYearId: string): void {
    this.subscriptions.add(
      this.studentService.getStudentsByClass(classId, academicYearId).subscribe({
        next: (data) => {
          this.students = data.students || [];
          console.log('Students:', this.students);
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
      this.toasterService.warning('Please fill all fields correctly!');
      return;
    }

    this.isLoading = true;
    const formValue = this.assignmentForm.value;
    const files = this.fileList;

    // Convert dueDate to Date object and handle invalid cases
    let dueDate: Date;
    if (formValue.dueDate instanceof Date) {
      dueDate = formValue.dueDate;
    } else if (typeof formValue.dueDate === 'string') {
      dueDate = new Date(formValue.dueDate);
    } else {
      this.toasterService.error('Invalid due date format. Please select a valid date.');
      this.isLoading = false;
      return;
    }

    if (isNaN(dueDate.getTime())) {
      this.toasterService.error('Invalid due date. Please select a valid date.');
      this.isLoading = false;
      return;
    }

    const teacherId = localStorage.getItem('teacherId') || ''; // Get teacherId for query param
    this.subscriptions.add(
      this.assignmentService.createAssignment({
        title: formValue.title,
        description: formValue.description,
        dueDate: dueDate.toISOString(), // Use the validated Date object
        classId: formValue.classId,
        subjectId: formValue.subjectId,
        assignedTo: formValue.assignedTo
      }, files, teacherId).subscribe({
        next: (response) => {
          this.toasterService.success('Assignment created! 🎉');
          this.resetForm();
        },
        error: (err) => {
          this.toasterService.error('Oops! Couldn’t create assignment.');
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