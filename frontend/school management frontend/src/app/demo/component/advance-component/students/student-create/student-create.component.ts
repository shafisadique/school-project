// src/app/modules/student/student-create/student-create.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { Subject, takeUntil } from 'rxjs';
import { StudentService } from '../student.service';
import { ClassSubjectService } from '../../class-subject-management/class-subject.service';
import { RouteService } from '../../../route/route.service';
import { CommonModule } from '@angular/common';
import { CardComponent } from 'src/app/theme/shared/components/card/card.component';

@Component({
  selector: 'app-student-create',
  templateUrl: './student-create.component.html',
  styleUrls: ['./student-create.component.scss'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, CardComponent],
})
export class StudentCreateComponent implements OnInit, OnDestroy {
  form!: FormGroup;
  submitted = false;
  loading = false;
  classList: any[] = [];
  sectionList = ['A', 'B', 'C', 'D', 'E'];
  routes: any[] = [];
  selectedFile: File | null = null;
  imagePreview: string | null = null;
  fileError = '';
  serverError = '';

  private destroy$ = new Subject<void>();
  private schoolId = localStorage.getItem('schoolId')!;

  constructor(
    private fb: FormBuilder,
    private classSvc: ClassSubjectService,
    private routeSvc: RouteService,
    private studentSvc: StudentService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.loadClasses();
    this.loadRoutes();
    this.watchTransport();
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
      dateOfBirth: ['', Validators.required],
      gender: ['', Validators.required],
      classId: ['', Validators.required],
      section: ['', Validators.required],
      address: ['', [Validators.required, Validators.maxLength(200)]],
      city: ['', [Validators.required, Validators.maxLength(100)]],
      state: ['', [Validators.required, Validators.maxLength(100)]],
      country: ['', [Validators.required, Validators.maxLength(100)]],
      usesTransport: [false],
      routeId: [''],
      usesHostel: [false],
      fatherName: [''],
      fatherPhone: [''],
      motherName: [''],
      motherPhone: [''],
    });
  }

  get f() { return this.form.controls; }

  // --- Dynamic Validation ---
  private watchTransport(): void {
    this.form.get('usesTransport')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(val => {
        const routeCtrl = this.form.get('routeId');
        if (val) routeCtrl?.setValidators(Validators.required);
        else routeCtrl?.clearValidators();
        routeCtrl?.updateValueAndValidity();
      });
  }

  // --- Data Load ---
  private loadClasses(): void {
    this.classSvc.getClassesBySchool(this.schoolId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          this.classList = res.data || res || [];  // Handle both {data: []} and direct array
          console.log('Classes loaded:', this.classList);  // Debug log
        },
        error: (err) => {
          console.error('Classes error:', err);
          this.toastr.error('Failed to load classes. Please refresh.');
          this.classList = [];  // Fallback
        }
      });
  }

  private loadRoutes(): void {
    this.routeSvc.getRoutes()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => this.routes = res.data || [],
        error: () => this.toastr.error('Failed to load routes')
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
    this.fileError = !this.selectedFile ? 'Profile picture required' : '';

    if (this.form.invalid || !this.selectedFile) return;

    this.loading = true;
    const fd = this.buildFormData();

    this.studentSvc.createStudent(fd)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toastr.success('Student added successfully');
          this.resetForm();
        },
        error: (err: any) => {
          this.serverError = this.parseError(err);
          const errorMsg = err.error?.message || 'Failed to add student';
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
        fd.append(k, v);
      }
    });

    // Section as array
    fd.append('section[]', val.section);

    // Parents
    const parents: any = {};
    ['fatherName', 'fatherPhone', 'motherName', 'motherPhone'].forEach(k => {
      const v = val[k]?.trim();
      if (v) parents[k] = v;
    });
    if (Object.keys(parents).length) fd.append('parents', JSON.stringify(parents));

    fd.append('profileImage', this.selectedFile!);
    return fd;
  }

  private parseError(err: any): string {
    const msg = err.error?.message || 'Server error';
    if (msg.includes('parent')) return 'At least one parent name required';
    if (msg.includes('phone')) return 'Parent phone required if name given';
    if (msg.includes('route')) return 'Route required for transport';
    return msg;
  }

  private resetForm(): void {
    this.form.reset({
      usesTransport: false,
      usesHostel: false,
      email: '',
      phone: '',
      fatherName: '',
      fatherPhone: '',
      motherName: '',
      motherPhone: ''
    });
    this.selectedFile = null;
    this.imagePreview = null;
    this.submitted = false;
    this.loading = false;
  }
}