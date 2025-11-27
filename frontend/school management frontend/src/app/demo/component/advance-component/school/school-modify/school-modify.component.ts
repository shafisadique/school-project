import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { GoogleMap, MapMarker } from '@angular/google-maps';
import { ToastrService } from 'ngx-toastr';
import { SchoolService } from '../school.service';
import { Subject, takeUntil } from 'rxjs';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-school-modify',
  templateUrl: './school-modify.component.html',
  styleUrls: ['./school-modify.component.scss'],
  standalone: true,
  imports: [GoogleMap, MapMarker,CommonModule,ReactiveFormsModule]
})
export class SchoolModifyComponent implements OnInit, OnDestroy {
  schoolForm!: FormGroup;
  schoolId: string | null = null;
  academicYear: string[] = ['2024-2025', '2025-2026', '2026-2027'];

  selectedFile: File | null = null;
  logoPreview: string = '/assets/edglobe.jpeg';
  logoError = '';
  isUploadingLogo = false;
  isSubmitting = false;

  center: google.maps.LatLngLiteral = { lat: 20.5937, lng: 78.9629 };
  zoom = 5;
  markerPosition: google.maps.LatLngLiteral | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private schoolService: SchoolService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.schoolId = localStorage.getItem('schoolId');
    if (this.schoolId) {
      this.loadSchool();
    } else {
      this.fetchSchoolByUser();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initForm(): void {
    this.schoolForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      street: ['', Validators.required],
      city: ['', Validators.required],
      state: [''],
      postalCode: [''],
      contact: ['', [Validators.required, Validators.pattern(/^[\+]?[0-9]{10,15}$/)]],
      academicYear: ['', Validators.required],
      latitude: [null, Validators.required],
      longitude: [null, Validators.required],
      openingTime: [''],
      closingTime: [''],
      lunchBreak: ['']
    });
  }

  private loadSchool(): void {
    this.schoolService.getSchoolById(this.schoolId!)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => this.patchForm(data),
        error: () => this.toastr.error('Failed to load school data')
      });
  }

  private fetchSchoolByUser(): void {
    this.schoolService.getMySchool()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          if (data?._id) {
            this.schoolId = data._id;
            localStorage.setItem('schoolId', this.schoolId);
            this.patchForm(data);
          }
        },
        error: () => this.toastr.error('Failed to load school')
      });
  }

  private patchForm(data: any): void {
    const logoKey = data.logo;
    this.logoPreview = logoKey ? this.getImageUrl(logoKey) : '/assets/edglobe.jpeg';

    this.schoolForm.patchValue({
      name: data.name || '',
      street: data.address?.street || '',
      city: data.address?.city || '',
      state: data.address?.state || '',
      postalCode: data.address?.postalCode || '',
      contact: data.mobileNo || data.contact || '',
      academicYear: data.academicYear || data.activeAcademicYear?.year || '',
      latitude: data.latitude || null,
      longitude: data.longitude || null,
      openingTime: data.schoolTiming?.openingTime || '09:00',
      closingTime: data.schoolTiming?.closingTime || '16:00',
      lunchBreak: data.schoolTiming?.lunchBreak || '12:30 - 13:10'
    });

    if (data.latitude && data.longitude) {
      this.center = { lat: data.latitude, lng: data.longitude };
      this.zoom = 16;
      this.markerPosition = { lat: data.latitude, lng: data.longitude };
    }
  }

  getImageUrl(imageKey: string): string {
    if (!imageKey) return '/assets/edglobe.jpeg';
    if (imageKey.startsWith('http')) return imageKey;
    return `https://edglobe.vercel.app/api/proxy-image/${encodeURIComponent(imageKey)}`;
  }

  getSchoolInitials(): string {
    const name = this.schoolForm.get('name')?.value || 'School';
    return name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  }

  onLogoError(event: any): void {
    event.target.src = '/assets/edglobe.jpeg';
  }

  onFileSelected(event: any): void {
    const file: File = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.logoError = 'Only image files allowed';
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      this.logoError = 'Max 2MB allowed';
      return;
    }

    this.selectedFile = file;
    this.logoError = '';

    const reader = new FileReader();
    reader.onload = () => this.logoPreview = reader.result as string;
    reader.readAsDataURL(file);
  }

  uploadLogo(): void {
    if (!this.selectedFile || !this.schoolId) return;

    this.isUploadingLogo = true;
    this.schoolService.uploadLogo(this.schoolId, this.selectedFile)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          this.logoPreview = this.getImageUrl(res.logoKey);
          this.selectedFile = null;
          this.toastr.success('Logo uploaded successfully!');
          this.isUploadingLogo = false;
        },
        error: () => {
          this.toastr.error('Failed to upload logo');
          this.isUploadingLogo = false;
        }
      });
  }

  onMapClick(event: google.maps.MapMouseEvent): void {
    if (!event.latLng) return;
    const lat = event.latLng.lat();
    const lng = event.latLng.lng();

    this.schoolForm.patchValue({ latitude: lat, longitude: lng });
    this.markerPosition = { lat, lng };
    this.center = { lat, lng };
    this.zoom = 16;
    this.toastr.success('Location updated!');
  }

  areCoordinatesValid(): boolean {
    return !!this.schoolForm.get('latitude')?.value && !!this.schoolForm.get('longitude')?.value;
  }

  getCoordinatesStatus(): string {
    const lat = this.schoolForm.get('latitude')?.value;
    const lng = this.schoolForm.get('longitude')?.value;
    return lat && lng ? `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}` : 'No location selected';
  }

  updateSchool(): void {
    if (this.schoolForm.invalid || !this.areCoordinatesValid()) return;

    this.isSubmitting = true;
    const data = {
      schoolName: this.schoolForm.value.name,
      address: {
        street: this.schoolForm.value.street,
        city: this.schoolForm.value.city,
        state: this.schoolForm.value.state,
        postalCode: this.schoolForm.value.postalCode
      },
      mobileNo: this.schoolForm.value.contact,
      academicYear: this.schoolForm.value.academicYear,
      latitude: this.schoolForm.value.latitude,
      longitude: this.schoolForm.value.longitude,
      openingTime: this.schoolForm.value.openingTime,
      closingTime: this.schoolForm.value.closingTime,
      lunchBreak: this.schoolForm.value.lunchBreak
    };

    this.schoolService.updateSchool(this.schoolId!, data)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toastr.success('School updated successfully');
          this.isSubmitting = false;
        },
        error: () => {
          this.toastr.error('Failed to update school');
          this.isSubmitting = false;
        }
      });
  }
}