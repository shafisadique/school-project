// import { CommonModule } from '@angular/common';
// import { Component, OnDestroy, OnInit } from '@angular/core';
// import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
// import { ClassSubjectService } from '../class-subject.service';
// import { AcademicYearService } from '../../academic-year/academic-year.service';
// import { ToastrService } from 'ngx-toastr';
// import { Subject, takeUntil } from 'rxjs';

// @Component({
//   selector: 'app-combined-class-subject-management',
//   standalone: true,
//   imports: [CommonModule, FormsModule, ReactiveFormsModule],
//   templateUrl: './combined-class-subject-management.component.html',
//   styleUrls: ['./combined-class-subject-management.component.scss']
// })
// export class CombinedClassSubjectManagementComponent implements OnInit,OnDestroy {
// classList: any[] = [];
//   subjects: any[] = [];
//   teachers: any[] = [];
//   assignments: any[] = [];
//   academicYears: any[] = [];
//   assignForm!: FormGroup;
//   attendanceTeacherForm!: FormGroup;
//   schoolId: string = '';
//   selectedAcademicYearId: string = '';
//   loading: boolean = false;
//   isEditing: boolean = false; // New: Flag for edit mode
//   editingAssignment: any = null; // New: Store the assignment being edited

//   private destroy$ = new Subject<void>();

//   constructor(
//     private classSubjectService: ClassSubjectService,
//     private fb: FormBuilder,
//     private academicYearsService: AcademicYearService,
//     private toastr: ToastrService
//   ) {}

//  ngOnInit() {
//     this.schoolId = localStorage.getItem('schoolId') || '';
//     if (!this.schoolId) {
//       this.toastr.error('No school ID found in localStorage!', 'Error');
//       return;
//     }

//     this.selectedAcademicYearId = localStorage.getItem('activeAcademicYearId') || '';
//     this.loadClasses();
//     this.loadSubjects();
//     this.loadTeachers();
//     this.loadAcademicYears();

//     this.assignForm = this.fb.group({
//       classId: ['', Validators.required],
//       subjectId: ['', Validators.required],
//       teacherId: ['', Validators.required],
//       academicYearId: [this.selectedAcademicYearId || '', Validators.required],
//     });

//     this.attendanceTeacherForm = this.fb.group({
//       classId: ['', Validators.required],
//       attendanceTeacher: [''],
//       substituteAttendanceTeachers: [[]],
//     });

//     this.assignForm.get('academicYearId')?.valueChanges
//       .pipe(takeUntil(this.destroy$))
//       .subscribe(value => {
//         this.selectedAcademicYearId = value;
//         if (value) {
//           this.loadAssignments();
//           localStorage.setItem('activeAcademicYearId', value);
//         } else {
//           this.assignments = [];
//         }
//       });

//     if (this.selectedAcademicYearId) {
//       this.assignForm.patchValue({ academicYearId: this.selectedAcademicYearId });
//       this.loadAssignments();
//     }
//   }
//   ngOnDestroy() {
//     this.destroy$.next();
//     this.destroy$.complete();
//   }

//   loadClasses() {
//     this.loading = true;
//     this.classSubjectService.getClassesBySchool(this.schoolId).subscribe({
//       next: (classes) => {
//         this.classList = classes;
//         this.loading = false;
//       },
//       error: (err) => {
//         this.toastr.error(err.error?.message || 'Error fetching classes', 'Error');
//         this.loading = false;
//       }
//     });
//   }

//   loadSubjects() {
//     this.loading = true;
//     this.classSubjectService.getSubjects(this.schoolId).subscribe({
//       next: (subjects) => {
//         this.subjects = subjects;
//         this.loading = false;
//       },
//       error: (err) => {
//         this.toastr.error(err.error?.message || 'Error fetching subjects', 'Error');
//         this.loading = false;
//       }
//     });
//   }

//   loadTeachers() {
//     this.loading = true;
//     this.classSubjectService.getTeachers(this.schoolId).subscribe({
//       next: (teachers) => {
//         this.teachers = teachers;
//         this.loading = false;
//       },
//       error: (err) => {
//         this.toastr.error(err.error?.message || 'Error fetching teachers', 'Error');
//         this.loading = false;
//       }
//     });
//   }

//   submitAssignment() {
//     if (this.assignForm.invalid) {
//       this.toastr.error('Please fill all required fields', 'Error');
//       return;
//     }

//     this.loading = true;
//     const formData = this.assignForm.value;

//     if (this.isEditing && this.editingAssignment) {
//       // Update mode
//       this.classSubjectService.updateAssignment(formData).subscribe({
//         next: (res) => {
//           this.toastr.success('Assignment updated successfully', 'Success');
//           this.resetForm();
//           this.loadAssignments();
//         },
//         error: (err) => {
//           this.toastr.error(err.error?.message || 'Failed to update assignment', 'Error');
//           this.loading = false;
//         }
//       });
//     } else {
//       // Add mode (existing assignSubject)
//       this.classSubjectService.assignSubjectToClass(formData.classId, formData.subjectId, formData.teacherId, formData.academicYearId).subscribe({
//         next: (res) => {
//           this.toastr.success('Subject assigned successfully', 'Success');
//           this.resetForm();
//           this.loadAssignments();
//         },
//         error: (err) => {
//           this.toastr.error(err.error?.message || 'Failed to assign subject', 'Error');
//           this.loading = false;
//         }
//       });
//     }
//   }

//   editAssignment(assignment: any) {
//     this.isEditing = true;
//     this.editingAssignment = assignment;
//     this.assignForm.patchValue({
//       classId: assignment.classId,
//       subjectId: assignment.subjectId,
//       teacherId: assignment.teacherId,
//       academicYearId: this.selectedAcademicYearId,
//     });
//   }

//   // New: Cancel edit
//   cancelEdit() {
//     this.resetForm();
//   }

//   // New: Reset form to add mode
//   private resetForm() {
//     this.isEditing = false;
//     this.editingAssignment = null;
//     this.assignForm.reset({
//       academicYearId: this.selectedAcademicYearId,
//     });
//     this.loading = false;
//   }

//   loadAcademicYears() {
//     this.loading = true;
//     this.academicYearsService.getAllAcademicYears(this.schoolId).subscribe({
//       next: (academicYears) => {
//         this.academicYears = academicYears;
//         // Validate and set selectedAcademicYearId
//         if (this.selectedAcademicYearId && academicYears.some(year => year._id === this.selectedAcademicYearId)) {
//           this.assignForm.patchValue({ academicYearId: this.selectedAcademicYearId });
//           console.log('Using localStorage academicYearId:', this.selectedAcademicYearId);
//         } else {
//           const activeYear = academicYears.find(year => year.isActive);
//           if (activeYear) {
//             this.selectedAcademicYearId = activeYear._id;
//             this.assignForm.patchValue({ academicYearId: activeYear._id });
//             localStorage.setItem('activeAcademicYearId', activeYear._id);
//             console.log('Using active academicYearId:', activeYear._id);
//           } else {
//             this.toastr.warning('No active academic year found', 'Warning');
//           }
//         }
//         this.loading = false;
//       },
//       error: (err) => {
//         this.toastr.error(err.error?.message || 'Error fetching academic years', 'Error');
//         this.loading = false;
//       }
//     });
//   }

//   loadAssignments() {
//     if (!this.selectedAcademicYearId) {
//       this.toastr.warning('No academic year selected for fetching assignments', 'Warning');
//       this.assignments = [];
//       return;
//     }
//     this.loading = true;
//     console.log('Loading assignments for schoolId:', this.schoolId, 'academicYearId:', this.selectedAcademicYearId);
//     this.classSubjectService.getCombinedAssignments(this.schoolId, this.selectedAcademicYearId).subscribe({
//       next: (data) => {
//         this.assignments = data;
//         console.log('Assignments loaded:', data); // Debug response
//         this.loading = false;
//       },
//       error: (err) => {
//         this.toastr.error(err.error?.message || 'Error fetching assignments', 'Error');
//         console.log('Error fetching assignments:', err); // Debug error
//         this.loading = false;
//       }
//     });
//   }

//   loadClassDetails() {
//     const classId = this.attendanceTeacherForm.get('classId')?.value;
//     if (classId) {
//       const selectedClass = this.classList.find(cls => cls._id === classId);
//       if (selectedClass) {
//         this.attendanceTeacherForm.patchValue({
//           attendanceTeacher: selectedClass.attendanceTeacher?._id || '',
//           substituteAttendanceTeachers: selectedClass.substituteAttendanceTeachers?.map(t => t._id) || [],
//         });
//       }
//     }
//   }

//   assignSubject() {
//     if (this.assignForm.invalid) {
//       this.toastr.error('Please fill all required fields', 'Error');
//       return;
//     }

//     this.loading = true;
//     const { classId, subjectId, teacherId, academicYearId } = this.assignForm.value;

//     this.classSubjectService.assignSubjectToClass(classId, subjectId, teacherId, academicYearId).subscribe({
//       next: (res) => {
//         this.toastr.success('Subject assigned successfully', 'Success');
//         this.loadAssignments();
//         this.loading = false;
//       },
//       error: (err) => {
//         this.toastr.error(err.error?.message || 'Failed to assign subject', 'Error');
//         this.loading = false;
//       }
//     });
//   }

//   updateAttendanceTeachers() {
//     if (this.attendanceTeacherForm.invalid) {
//       this.toastr.error('Please select a class', 'Error');
//       return;
//     }

//     this.loading = true;
//     const { classId, attendanceTeacher, substituteAttendanceTeachers } = this.attendanceTeacherForm.value;

//     this.classSubjectService.updateAttendanceTeachers(classId, attendanceTeacher, substituteAttendanceTeachers).subscribe({
//       next: (res) => {
//         this.toastr.success('Attendance teachers updated successfully', 'Success');
//         this.loadClasses();
//         this.loadAssignments();
//         this.loading = false;
//       },
//       error: (err) => {
//         this.toastr.error(err.error?.message || 'Failed to update attendance teachers', 'Error');
//         this.loading = false;
//       }
//     });
//   }

//   getAttendanceTeacher(attendanceTeacher: any): string {
//     if (!attendanceTeacher) {
//       return 'Not assigned';
//     }
//     return `${attendanceTeacher.name} `;
//   }

//   getSubstituteTeachers(substituteTeachers: any[]): string {
//     if (!substituteTeachers || substituteTeachers.length === 0) {
//       return 'None';
//     }
//     return substituteTeachers.map(teacher => `${teacher.name}`).join(', ');
//   }
// }

import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ClassSubjectService } from '../class-subject.service';
import { AcademicYearService } from '../../academic-year/academic-year.service';
import { ToastrService } from 'ngx-toastr';
import { Subject, takeUntil } from 'rxjs';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-combined-class-subject-management',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './combined-class-subject-management.component.html',
  styleUrls: ['./combined-class-subject-management.component.scss']
})
export class CombinedClassSubjectManagementComponent implements OnInit, OnDestroy {
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
  isEditing: boolean = false;
  editingAssignmentId: string | null = null;
  originalSubjectId: string | null = null;

  private destroy$ = new Subject<void>();

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

    this.selectedAcademicYearId = localStorage.getItem('activeAcademicYearId') || '';
    this.loadData();

    this.assignForm = this.fb.group({
      classId: ['', Validators.required],
      subjectId: ['', Validators.required],
      teacherId: ['', Validators.required],
      academicYearId: [this.selectedAcademicYearId || '', Validators.required],
    });

    this.attendanceTeacherForm = this.fb.group({
      classId: ['', Validators.required],
      attendanceTeacher: [''],
      substituteAttendanceTeachers: [[]],
    });

    this.assignForm.get('academicYearId')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(value => {
        this.selectedAcademicYearId = value;
        if (value) {
          this.loadAssignments();
          localStorage.setItem('activeAcademicYearId', value);
        } else {
          this.assignments = [];
        }
      });

    if (this.selectedAcademicYearId) {
      this.assignForm.patchValue({ academicYearId: this.selectedAcademicYearId });
      this.loadAssignments();
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadData() {
    this.loadClasses();
    this.loadSubjects();
    this.loadTeachers();
    this.loadAcademicYears();
  }

  loadClasses() {
    this.loading = true;
    this.classSubjectService.getClassesBySchool(this.schoolId).subscribe({
      next: (classes) => { this.classList = classes; this.loading = false; },
      error: (err) => { this.toastr.error(err.error?.message || 'Error fetching classes', 'Error'); this.loading = false; }
    });
  }

  loadSubjects() {
    this.loading = true;
    this.classSubjectService.getSubjects(this.schoolId).subscribe({
      next: (subjects) => { this.subjects = subjects; this.loading = false; },
      error: (err) => { this.toastr.error(err.error?.message || 'Error fetching subjects', 'Error'); this.loading = false; }
    });
  }

  loadTeachers() {
    this.loading = true;
    this.classSubjectService.getTeachers(this.schoolId).subscribe({
      next: (teachers) => { this.teachers = teachers; this.loading = false; },
      error: (err) => { this.toastr.error(err.error?.message || 'Error fetching teachers', 'Error'); this.loading = false; }
    });
  }

  loadAcademicYears() {
    this.loading = true;
    this.academicYearsService.getAllAcademicYears(this.schoolId).subscribe({
      next: (academicYears) => {
        this.academicYears = academicYears;
        if (this.selectedAcademicYearId && academicYears.some(year => year._id === this.selectedAcademicYearId)) {
          this.assignForm.patchValue({ academicYearId: this.selectedAcademicYearId });
        } else {
          const activeYear = academicYears.find(year => year.isActive);
          if (activeYear) {
            this.selectedAcademicYearId = activeYear._id;
            this.assignForm.patchValue({ academicYearId: activeYear._id });
            localStorage.setItem('activeAcademicYearId', activeYear._id);
          } else {
            this.toastr.warning('No active academic year found', 'Warning');
          }
        }
        this.loading = false;
      },
      error: (err) => { this.toastr.error(err.error?.message || 'Error fetching academic years', 'Error'); this.loading = false; }
    });
  }

  loadAssignments() {
    if (!this.selectedAcademicYearId) {
      this.toastr.warning('No academic year selected', 'Warning');
      this.assignments = [];
      return;
    }
    this.loading = true;
    this.classSubjectService.getCombinedAssignments(this.schoolId, this.selectedAcademicYearId).subscribe({
      next: (data) => { 
        this.assignments = data; 
        this.loading = false;
      },
      error: (err) => { this.toastr.error(err.error?.message || 'Error fetching assignments', 'Error'); this.loading = false; }
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

  submitAssignment() {
    if (this.assignForm.invalid) {
      this.toastr.error('Please fill all required fields', 'Error');
      return;
    }

    this.loading = true;
    const formData = this.assignForm.value;

    if (this.isEditing) {
      if (formData.subjectId !== this.originalSubjectId) {
        // Subject change: Delete old and create new
        this.classSubjectService.deleteAssignment({
          classId: formData.classId,
          subjectId: this.originalSubjectId,
          academicYearId: formData.academicYearId
        }).subscribe({
          next: () => {
            this.classSubjectService.assignSubjectToClass(formData.classId, formData.subjectId, formData.teacherId, formData.academicYearId).subscribe({
              next: () => {
                this.toastr.success('Assignment updated (subject changed)', 'Success');
                this.resetForm();
                this.loadAssignments();
              },
              error: (err) => { this.toastr.error(err.error?.message || 'Failed to update', 'Error'); this.loading = false; }
            });
          },
          error: (err) => { this.toastr.error(err.error?.message || 'Failed to delete old assignment', 'Error'); this.loading = false; }
        });
      } else {
        // Only teacher change
        this.classSubjectService.updateAssignment(formData).subscribe({
          next: () => {
            this.toastr.success('Assignment updated successfully', 'Success');
            this.resetForm();
            this.loadAssignments();
          },
          error: (err) => {
            this.toastr.error(err.error?.message || 'Failed to update assignment', 'Error');
            this.loading = false;
          }
        });
      }
    } else {
      // Check for duplicates client-side (optional, backend enforces)
      const existing = this.assignments.find(a => a.classId === formData.classId && a.subjectId === formData.subjectId && a.academicYearId === formData.academicYearId);
      if (existing) {
        this.toastr.error('This subject is already assigned to this class for this year. Edit the existing one.', 'Duplicate Detected');
        this.loading = false;
        return;
      }
      this.classSubjectService.assignSubjectToClass(formData.classId, formData.subjectId, formData.teacherId, formData.academicYearId).subscribe({
        next: () => {
          this.toastr.success('Subject assigned successfully', 'Success');
          this.resetForm();
          this.loadAssignments();
        },
        error: (err) => {
          this.toastr.error(err.error?.message || 'Failed to assign subject', 'Error');
          this.loading = false;
        }
      });
    }
  }

  editAssignment(assignment: any) {
    this.isEditing = true;
    this.editingAssignmentId = assignment._id;
    this.originalSubjectId = assignment.subjectId;
    this.assignForm.patchValue({
      classId: assignment.classId,
      subjectId: assignment.subjectId,
      teacherId: assignment.teacherId,
      academicYearId: this.selectedAcademicYearId,
    });
  }

  deleteAssignment(assignment: any) {
    if (confirm('Are you sure you want to delete this assignment?')) {
      this.classSubjectService.deleteAssignment({
        classId: assignment.classId,
        subjectId: assignment.subjectId,
        academicYearId: this.selectedAcademicYearId
      }).subscribe({
        next: () => {
          this.toastr.success('Assignment deleted successfully', 'Success');
          this.loadAssignments();
        },
        error: (err) => {
          this.toastr.error(err.error?.message || 'Failed to delete assignment', 'Error');
        }
      });
    }
  }

  cancelEdit() {
    this.resetForm();
  }

  resetForm() {
    this.isEditing = false;
    this.editingAssignmentId = null;
    this.originalSubjectId = null;
    this.assignForm.reset({
      academicYearId: this.selectedAcademicYearId,
    });
    this.loading = false;
  }

  updateAttendanceTeachers() {
    if (this.attendanceTeacherForm.invalid) {
      this.toastr.error('Please select a class', 'Error');
      return;
    }

    this.loading = true;
    const { classId, attendanceTeacher, substituteAttendanceTeachers } = this.attendanceTeacherForm.value;

    this.classSubjectService.updateAttendanceTeachers(classId, attendanceTeacher, substituteAttendanceTeachers).subscribe({
      next: () => {
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
    return attendanceTeacher ? `${attendanceTeacher.name}` : 'Not assigned';
  }

  getSubstituteTeachers(substituteTeachers: any[]): string {
    return substituteTeachers && substituteTeachers.length ? substituteTeachers.map(t => t.name).join(', ') : 'None';
  }
}