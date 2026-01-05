// src/app/modules/teacher/teacher-update/teacher-update.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { Subject, takeUntil } from 'rxjs';
import { HttpEvent, HttpEventType } from '@angular/common/http';
import { TeacherService } from '../teacher.service';
import { CommonModule } from '@angular/common';
import { CardComponent } from 'src/app/theme/shared/components/card/card.component';
import { NgSelectModule } from '@ng-select/ng-select';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-teacher-update',
  templateUrl: './teacher-update.component.html',
  styleUrls: ['./teacher-update.component.scss'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, CardComponent, NgSelectModule],
})
export class TeacherUpdateComponent implements OnInit, OnDestroy {
  form!: FormGroup;
  submitted = false;
  loading = false;
  uploadProgress = 0;
  subjectsList: string[] = [
    'English', 'Hindi', 'Mathematics', 'Environmental Science', 'General Knowledge',
    'Arts', 'Science', 'Social Science', 'Music'
  ];
  selectedFile: File | null = null;
  imagePreview: string | null = null;
  fileError = '';
  serverError = '';
  teacherId: string | null = null;

  private destroy$ = new Subject<void>();
  private schoolId = localStorage.getItem('schoolId')!;

  constructor(
    private fb: FormBuilder,
    private teacherSvc: TeacherService,
    private route: ActivatedRoute,
    private router: Router,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.teacherId = this.route.snapshot.paramMap.get('teacherId');
    if (!this.teacherId) {
      this.toastr.error('Invalid teacher ID');
      this.router.navigate(['/teacher/teacher-details']);
      return;
    }

    this.initForm();
    this.loadTeacher();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // --- Form ---
  private initForm(): void {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      email: [''],
      phone: ['', [Validators.pattern(/^\d{10}$/)]],
      gender: ['', Validators.required],
      qualification: [''],
      joiningDate: [''],
      dateOfBirth: [''],
      address: [''],
      bloodGroup: [''],
      emergencyContactName: [''],
      emergencyContactPhone: ['', Validators.pattern(/^\d{10}$/)],
      status: [true],
      designation: ['', Validators.required],
      subjects: [[], [Validators.required, Validators.minLength(1)]],
      leaveBalance: [0, [Validators.min(0)]],

    });
  }

  get f() { return this.form.controls; }

  // --- Data Load ---
  private loadTeacher(): void {
    this.teacherSvc.getTeacherById(this.teacherId!)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          const teacher = response.data;
          this.form.patchValue({
            name: teacher.name,
            email: teacher.email || '',
            phone: teacher.phone || '',
            gender: teacher.gender,
            designation: teacher.designation || '',
            qualification: teacher.qualification || '',
            joiningDate: teacher.joiningDate ? teacher.joiningDate.split('T')[0] : '',
            dateOfBirth: teacher.dateOfBirth ? teacher.dateOfBirth.split('T')[0] : '',
            experienceYears: teacher.experienceYears || null,
            address: teacher.address || '',
            bloodGroup: teacher.bloodGroup || '',
            emergencyContactName: teacher.emergencyContactName || '',
            emergencyContactPhone: teacher.emergencyContactPhone || '',
            status: teacher.status,
            leaveBalance: teacher.leaveBalance || 0,
          });

          // Handle subjects: Filter existing names from hardcoded list
          const selectedSubjects: string[] = [];
          if (teacher.subjects && teacher.subjects.length > 0) {
            teacher.subjects.forEach((subName: string) => {
              if (this.subjectsList.includes(subName)) {
                selectedSubjects.push(subName);
              }
            });
          }
          this.form.patchValue({ subjects: selectedSubjects });

          // Set image preview (prefer enriched URL)
          if (teacher.profileImageUrl) {
            this.imagePreview = teacher.profileImageUrl;
          } else if (teacher.profileImage) {
            if (teacher.profileImage.startsWith('http')) {
              this.imagePreview = teacher.profileImage;
            } else {
              const proxyUrl = `http://localhost:5675`;
              this.imagePreview = `${proxyUrl}/api/proxy-image/${encodeURIComponent(teacher.profileImage)}`;
            }
          }
        },
        error: (err) => {
          this.serverError = this.parseError(err);
          this.toastr.error('Failed to load teacher details');
          this.router.navigate(['/teacher/teacher-details']);
        }
      });
  }

  // --- File ---
  onFileSelect(event: any): void {
    const file: File = event.target.files[0];
    if (!file) return;

    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
      this.fileError = 'Only PNG/JPG/JPEG allowed';
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      this.fileError = 'Max 2 MB';
      return;
    }

    this.selectedFile = file;
    this.fileError = '';
    const reader = new FileReader();
    reader.onload = () => this.imagePreview = reader.result as string;
    reader.readAsDataURL(file);
  }

  // --- Submit ---
  onSubmit(): void {
    this.submitted = true;
    this.serverError = '';

    if (this.form.invalid) return;

    this.loading = true;
    this.uploadProgress = 0;
    const updateData = this.buildUpdateData(this.form.value);
    const formData = new FormData();

    // FIXED: Like create, append subjects as JSON string
    for (const [key, value] of Object.entries(updateData)) {
      if (key === 'subjects') {
        if (Array.isArray(value) && value.length > 0) {
          formData.append(key, JSON.stringify(value)); // e.g., '["English"]'
        }
      } else if (value !== null && value !== undefined && value !== '') {
        formData.append(key, value.toString());
      }
    }

    this.teacherSvc.updateTeacher(this.teacherId!, formData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (event: HttpEvent<any>) => {
          switch (event.type) {
            case HttpEventType.UploadProgress:
              this.uploadProgress = Math.round(100 * event.loaded / (event.total || 1));
              break;
            case HttpEventType.Response:
              console.log('Update response:', event.body);
              this.handleUpdateSuccess(event.body);
              break;
          }
        },
        error: (err: any) => {
          this.loading = false;
          this.uploadProgress = 0;
          this.serverError = this.parseError(err);
          const errorMsg = err.error?.message || 'Failed to update teacher';
          this.toastr.error(errorMsg, 'Error');
          console.error('Full error:', err);
        }
      });
  }

  private handleUpdateSuccess(response: any): void {
    this.loading = false;
    this.uploadProgress = 0;
    if (this.selectedFile) {
      const fd = new FormData();
      fd.append('profileImage', this.selectedFile!);
      this.teacherSvc.uploadTeacherPhoto(this.teacherId!, fd)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.toastr.success('Teacher updated successfully (with photo)');
            this.router.navigate(['/teacher/teacher-details']);
          },
          error: (err) => {
            this.toastr.warning('Teacher updated, but failed to upload profile picture');
            this.router.navigate(['/teacher/teacher-details']);
          }
        });
    } else {
      this.toastr.success('Teacher updated successfully');
      this.router.navigate(['/teacher/teacher-details']);
    }
  }

  private buildUpdateData(val: any): any {
    const data: any = {};

    // Basic fields
    ['name', 'email', 'phone', 'gender', 'status', 'designation'].forEach(key => {
      if (val[key] !== null && val[key] !== undefined && val[key] !== '') {
        if (key === 'phone' && !/^\d{10}$/.test(val[key])) return;
        data[key] = val[key].trim ? val[key].trim() : val[key];
      }
    });

    // Subjects (direct names from hardcoded list, no mapping needed)
    const selectedSubjects: string[] = [];
    if (val.subjects && val.subjects.length > 0) {
      val.subjects.forEach((subName: string) => {
        if (this.subjectsList.includes(subName)) {
          selectedSubjects.push(subName);
        }
      });
      data.subjects = selectedSubjects;
    }

    return data;
  }

  private parseError(err: any): string {
    const msg = err.error?.message || 'Server error';
    return msg;
  }
}