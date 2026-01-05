// src/app/modules/student/student-update/student-update.component.ts

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
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { CardComponent } from 'src/app/theme/shared/components/card/card.component';

@Component({
  selector: 'app-student-update',
  templateUrl: './student-update.component.html',
  styleUrls: ['./student-update.component.scss'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, CardComponent],
})
export class StudentUpdateComponent implements OnInit, OnDestroy {
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
  studentId: string | null = null;

  // APAAR Status Options (same as create)
  apaarStatusOptions = [
    { value: 'not_generated', label: 'Not Generated Yet' },
    { value: 'pending', label: 'Pending Generation' },
    { value: 'consent_pending', label: 'Consent Form Pending' },
    { value: 'refused', label: 'Parent Refused Consent' },
    { value: 'mismatch_error', label: 'Aadhaar Mismatch / Error' },
    { value: 'generated', label: 'Generated (Has APAAR ID)' },
  ];

  private destroy$ = new Subject<void>();
  private schoolId = localStorage.getItem('schoolId')!;

  constructor(
    private fb: FormBuilder,
    private classSvc: ClassSubjectService,
    private routeSvc: RouteService,
    private studentSvc: StudentService,
    private route: ActivatedRoute,
    private router: Router,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.studentId = this.route.snapshot.paramMap.get('id');
    if (!this.studentId) {
      this.toastr.error('Invalid student ID');
      this.router.navigate(['/student/student-details']);
      return;
    }

    this.initForm();
    this.loadClasses();
    this.loadRoutes();
    this.watchTransport();
    this.watchParents();
    this.watchApaarId(); // Auto-update status
    this.loadStudent();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initForm(): void {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      email: [''],
      phone: ['', [Validators.pattern(/^\d{10}$/)]],
      dateOfBirth: ['', Validators.required],
      gender: ['', Validators.required],
      classId: ['', Validators.required],
      section: ['', Validators.required],
      status: [true],
      address: ['', [Validators.required, Validators.maxLength(200)]],
      city: ['', [Validators.required, Validators.maxLength(100)]],
      state: ['', [Validators.required, Validators.maxLength(100)]],
      country: ['India', [Validators.required, Validators.maxLength(100)]],
      usesTransport: [false],
      routeId: [''],
      usesHostel: [false],
      fatherName: [''],
      fatherPhone: [''],
      motherName: [''],
      motherPhone: [''],
      // === APAAR FIELDS ===
      apaarId: ['', [Validators.pattern(/^\d{12}$/)]],
      apaarStatus: ['not_generated', Validators.required],
      apaarNotes: [''],
    });
  }

  get f() { return this.form.controls; }

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

  private watchParents(): void {
    const watchParent = (nameCtrl: string, phoneCtrl: string) => {
      this.form.get(nameCtrl)?.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(name => {
        const phone = this.form.get(phoneCtrl)?.value;
        if (name && !phone) {
          this.form.get(phoneCtrl)?.setErrors({ requiredIfName: true });
        } else {
          const errors = this.form.get(phoneCtrl)?.errors;
          if (errors && errors['requiredIfName']) {
            delete errors['requiredIfName'];
            this.form.get(phoneCtrl)?.setErrors(Object.keys(errors).length ? errors : null);
          }
        }
        this.form.get(phoneCtrl)?.updateValueAndValidity({ emitEvent: false });
      });
    };
    watchParent('fatherName', 'fatherPhone');
    watchParent('motherName', 'motherPhone');
  }

  // Auto-set status when valid APAAR ID entered
  private watchApaarId(): void {
    this.form.get('apaarId')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((id: string) => {
        if (id && /^\d{12}$/.test(id.trim())) {
          this.form.get('apaarStatus')?.setValue('generated');
        }
      });
  }

  private loadClasses(): void {
    this.classSvc.getClassesBySchool(this.schoolId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => this.classList = res.data || res || [],
        error: () => {
          this.toastr.error('Failed to load classes');
          this.classList = [];
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

  private loadStudent(): void {
    this.studentSvc.getStudentById(this.studentId!)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (student: any) => {
          this.form.patchValue({
            name: student.name,
            email: student.email || '',
            phone: student.phone || '',
            dateOfBirth: new Date(student.dateOfBirth).toISOString().split('T')[0],
            gender: student.gender,
            classId: student.classId?._id || student.classId,
            section: student.section?.[0] || '',
            status: student.status,
            address: student.address || '',
            city: student.city || '',
            state: student.state || '',
            country: student.country || 'India',
            usesTransport: student.feePreferences?.usesTransport || false,
            usesHostel: student.feePreferences?.usesHostel || false,
            fatherName: student.parents?.fatherName || '',
            fatherPhone: student.parents?.fatherPhone || '',
            motherName: student.parents?.motherName || '',
            motherPhone: student.parents?.motherPhone || '',
            // === APAAR DATA ===
            apaarId: student.apaarId || '',
            apaarStatus: student.apaarStatus || 'not_generated',
            apaarNotes: student.apaarNotes || '',
          });

          if (student.routeId) {
            this.form.patchValue({ routeId: student.routeId?._id || student.routeId });
          }

          // Profile image preview
          if (student.profileImage) {
            if (student.profileImage.startsWith('http')) {
              this.imagePreview = student.profileImage;
            } else {
              const proxyUrl = `https://edglobe.vercel.app`;
              this.imagePreview = `${proxyUrl}/api/proxy-image/${encodeURIComponent(student.profileImage)}`;
            }
          }
        },
        error: () => {
          this.toastr.error('Failed to load student details');
          this.router.navigate(['/student/student-details']);
        }
      });
  }

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

  onSubmit(): void {
    this.submitted = true;
    this.serverError = '';

    const val = this.form.value;
    if (!val.fatherName && !val.motherName) {
      this.serverError = 'At least one parent name is required';
      return;
    }

    if (this.form.invalid) return;

    this.loading = true;
    const updateData = this.buildUpdateData(val);

    this.studentSvc.updateStudent(this.studentId!, updateData)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          if (this.selectedFile) {
            const fd = new FormData();
            fd.append('profileImage', this.selectedFile!);
            this.studentSvc.uploadStudentPhoto(this.studentId!, fd)
              .subscribe({
                next: () => this.completeSuccess(),
                error: () => {
                  this.toastr.warning('Student updated, but photo upload failed');
                  this.completeSuccess();
                }
              });
          } else {
            this.completeSuccess();
          }
        },
        error: (err: any) => {
          this.loading = false;
          this.serverError = this.parseError(err);
          this.toastr.error(err.error?.message || 'Failed to update student');
        }
      });
  }

  private completeSuccess(): void {
    this.toastr.success('Student updated successfully');
    this.router.navigate(['/student/student-details']);
  }

  private buildUpdateData(val: any): any {
    const data: any = {};

    // Basic fields
    ['name', 'email', 'phone', 'dateOfBirth', 'address', 'city', 'state', 'country',
     'classId', 'section', 'gender', 'status', 'usesTransport', 'usesHostel'].forEach(key => {
      if (val[key] !== null && val[key] !== undefined && val[key] !== '') {
        if (key === 'phone' && val[key] && !/^\d{10}$/.test(val[key])) return;
        data[key] = typeof val[key] === 'string' ? val[key].trim() : val[key];
      }
    });

    data.section = [val.section];

    if (val.usesTransport && val.routeId) {
      data.routeId = val.routeId;
    } else if (!val.usesTransport) {
      data.routeId = null;
    }

    // Parents
    const parents: any = {};
    ['fatherName', 'fatherPhone', 'motherName', 'motherPhone'].forEach(key => {
      const v = val[key]?.trim();
      if (v) parents[key] = v;
    });
    if (Object.keys(parents).length) data.parents = parents;

    // === APAAR FIELDS ===
    if (val.apaarId?.trim()) data.apaarId = val.apaarId.trim();
    data.apaarStatus = val.apaarStatus;
    if (val.apaarNotes?.trim()) data.apaarNotes = val.apaarNotes.trim();

    return data;
  }

  private parseError(err: any): string {
    const msg = err.error?.message || '';
    if (msg.includes('parent')) return 'Parent details incomplete';
    if (msg.includes('phone')) return 'Phone number invalid';
    if (msg.includes('route')) return 'Route required for transport';
    if (msg.includes('APAAR')) return 'Invalid APAAR ID (must be 12 digits)';
    return msg || 'Server error';
  }
}