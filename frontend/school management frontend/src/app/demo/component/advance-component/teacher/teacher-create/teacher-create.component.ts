// src/app/modules/teacher/teacher-create/teacher-create.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { Subject, takeUntil } from 'rxjs';
import { TeacherService } from '../teacher.service';
import { CommonModule } from '@angular/common';
import { CardComponent } from 'src/app/theme/shared/components/card/card.component';
import { NgSelectModule } from '@ng-select/ng-select';

@Component({
  selector: 'app-teacher-create',
  templateUrl: './teacher-create.component.html',
  styleUrls: ['./teacher-create.component.scss'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, CardComponent, NgSelectModule],
})
export class TeacherCreateComponent implements OnInit, OnDestroy {
  form!: FormGroup;
  submitted = false;
  loading = false;
  subjectsList: string[] = [
    'English', 'Hindi', 'Mathematics', 'Environmental Science', 'General Knowledge',
    'Arts', 'Science', 'Social Science', 'Music'
  ];
  selectedFile: File | null = null;
  imagePreview: string | null = null;
  fileError = '';
  serverError = '';

  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private teacherSvc: TeacherService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.initForm();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // --- Form ---
  private initForm(): void {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
      username: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(50)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      phone: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
      gender: ['', Validators.required],
      designation: ['', [Validators.required, Validators.maxLength(100)]],
      leaveBalance: [10, [Validators.min(0)]],
      subjects: [[], [Validators.required, Validators.minLength(1)]],
    });
  }

  get f() { return this.form.controls; }

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
    this.fileError = !this.selectedFile ? 'Profile picture required' : '';

    if (this.form.invalid || !this.selectedFile) return;

    this.loading = true;
    const fd = this.buildFormData();

    this.teacherSvc.createTeacher(fd)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toastr.success('Teacher added successfully');
          // this.resetForm();
          this.loading = false;
        },
        error: (err: any) => {
          this.serverError = this.parseError(err);
          const errorMsg = err.error?.message || 'Failed to add teacher';
          this.toastr.error(errorMsg, 'Error');
          this.loading = false;
        }
      });
  }

  private buildFormData(): FormData {
    const fd = new FormData();
    const val = this.form.value;

    // Send only non-empty, non-null fields
    Object.keys(val).forEach(k => {
      const v = val[k];
      if (v !== null && v !== undefined && v !== '') {
        // Skip phone if not 10 digits
        if (k === 'phone' && !/^\d{10}$/.test(v)) {
          return; // Don't send invalid phone
        }
        if (k === 'subjects') {
          if (Array.isArray(v) && v.length > 0) {
            fd.append(k, JSON.stringify(v));
          }
          return;
        }
        fd.append(k, v);
      }
    });

    fd.append('profileImage', this.selectedFile!);
    return fd;
  }

  private parseError(err: any): string {
    const msg = err.error?.message || 'Server error';
    return msg;
  }

  private resetForm(): void {
    this.form.reset({
      leaveBalance: 10
    });
    this.selectedFile = null;
    this.imagePreview = null;
    this.submitted = false;
    this.loading = false;
    this.fileError = '';
    this.serverError = '';
  }
}