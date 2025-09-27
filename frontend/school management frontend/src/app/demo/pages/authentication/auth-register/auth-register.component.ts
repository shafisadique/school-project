/// <reference types="googlemaps" />

import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from 'src/app/theme/shared/service/auth.service';
import { GoogleMap, MapMarker } from '@angular/google-maps';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-auth-register',
  standalone: true,
  imports: [RouterModule, ReactiveFormsModule, CommonModule, GoogleMap, MapMarker],
  templateUrl: './auth-register.component.html',
  styleUrls: ['./auth-register.component.scss']
})
export class AuthRegisterComponent implements OnInit, OnDestroy {
  step = signal(1);
  formData = signal<any>({});
  isSubmitting = signal(false);
  showPassword = false;
  showConfirmPassword = false;
  addressError: string | null = null;

  schoolForm: FormGroup;
  passwordForm: FormGroup;
  addressForm: FormGroup;

  // Map properties
  center: google.maps.LatLngLiteral = { lat: 28.6139, lng: 77.2090 }; // Default to New Delhi
  zoom = 12;
  markerPosition: google.maps.LatLngLiteral | null = null;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private http: HttpClient,
    private authService: AuthService,
    private toastr: ToastrService
  ) {
    this.schoolForm = this.fb.group({
      schoolName: ['', Validators.required],
      adminName: ['', Validators.required],
      username: ['', [Validators.required, Validators.minLength(4)]],
      email: ['', [Validators.required, Validators.email]],
      mobileNo: ['', [Validators.required, Validators.pattern('^\\+?[1-9]\\d{9,14}$')]]
    });

    this.passwordForm = this.fb.group({
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required]
    }, { validators: this.passwordMatchValidator });

    this.addressForm = this.fb.group({
      street: ['', Validators.required],
      city: ['', Validators.required],
      state: ['', Validators.required],
      country: ['', Validators.required],
      postalCode: ['', Validators.required],
      latitude: [null, Validators.required],
      longitude: [null, Validators.required]
    });
  }

  ngOnInit(): void {}

  passwordMatchValidator(form: FormGroup) {
    const password = form.get('password')?.value;
    const confirmPassword = form.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { mismatch: true };
  }

  nextStep() {
    if (this.step() === 1) {
      this.schoolForm.markAllAsTouched();
      if (this.schoolForm.valid) {
        this.formData.set({ ...this.formData(), ...this.schoolForm.value });
        this.step.set(2);
      }
    } else if (this.step() === 2) {
      this.passwordForm.markAllAsTouched();
      if (this.passwordForm.valid) {
        this.formData.set({ ...this.formData(), ...this.passwordForm.value });
        this.step.set(3);
      }
    } else if (this.step() === 3) {
      this.addressForm.markAllAsTouched();
      if (this.addressForm.valid && !this.isSubmitting()) {
        this.formData.set({ 
          ...this.formData(), 
          address: this.addressForm.value, 
          latitude: this.addressForm.value.latitude, 
          longitude: this.addressForm.value.longitude 
        });
        this.submitForm();
      }
    }
  }

  prevStep() {
    if (this.step() > 1) {
      this.step.set(this.step() - 1);
    }
  }

submitForm() {
  if (this.isSubmitting()) return;
  this.isSubmitting.set(true);

  const { confirmPassword, ...cleanData } = this.formData();
  
  // Restructure data to match backend expectations
  const finalData = {
    schoolName: cleanData.schoolName,
    adminName: cleanData.adminName,
    username: cleanData.username,
    email: cleanData.email,
    password: cleanData.password,
    mobileNo: cleanData.mobileNo,
    // Address object WITHOUT lat/lng
    address: {
      street: cleanData.address?.street || '',
      city: cleanData.address?.city || '',
      state: cleanData.address?.state || '',
      country: cleanData.address?.country || '',
      postalCode: cleanData.address?.postalCode || ''
    },
    // Latitude and longitude as TOP-LEVEL fields (what backend expects)
    latitude: cleanData.address?.latitude || cleanData.latitude,
    longitude: cleanData.address?.longitude || cleanData.longitude,
    activeAcademicYear: 'someAcademicYearId',
    createdBy: 'currentUserId'
  };

  // Log the final payload for debugging
  console.log('Sending to backend:', finalData);

  this.authService.registerSchool(finalData).subscribe({
    next: (res: any) => {
      this.toastr.success('Registration Successful! Redirecting...', 'Success');
      setTimeout(() => {
        this.router.navigate(['/auth/login']);
        this.isSubmitting.set(false);
      }, 2000);
    },
    error: (err) => {
      this.toastr.error(err.error?.message || 'Registration Failed', 'Error');
      console.error('Registration Failed', err);
      this.isSubmitting.set(false);
    }
  });
}

  get f() { return this.schoolForm.controls; }
  get p() { return this.passwordForm.controls; }
  get a() { return this.addressForm.controls; }

  // Handle map click to get lat/lng
  onMapClick(event: google.maps.MapMouseEvent): void {
    if (!event.latLng) {
      this.addressError = 'Invalid click position.';
      return;
    }

    const lat = event.latLng.lat();
    const lng = event.latLng.lng();

    // Update form
    this.addressForm.patchValue({
      latitude: lat,
      longitude: lng
    });

    // Update marker position
    this.markerPosition = { lat, lng };

    // Optional: Reverse geocode to get address details
    this.reverseGeocode(lat, lng);

    this.addressError = null;
    this.toastr.success(`Location set: ${lat.toFixed(6)}, ${lng.toFixed(6)}`, 'Success');
  }

  // Reverse geocode to fill address fields (optional)
  private reverseGeocode(lat: number, lng: number): void {
    if (!window.google || !window.google.maps) return;

    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === 'OK' && results[0]) {
        const address = results[0];
        this.addressForm.patchValue({
          street: address.formatted_address || '',
          city: address.address_components?.find(comp => comp.types.includes('locality'))?.long_name || '',
          state: address.address_components?.find(comp => comp.types.includes('administrative_area_level_1'))?.long_name || '',
          country: address.address_components?.find(comp => comp.types.includes('country'))?.long_name || '',
          postalCode: address.address_components?.find(comp => comp.types.includes('postal_code'))?.long_name || ''
        });
      }
    });
  }

  ngOnDestroy(): void {}
}