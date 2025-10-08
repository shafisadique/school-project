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
  addressError: string | null = null;

  schoolForm: FormGroup;
  addressForm: FormGroup;

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
      mobileNo: ['', [Validators.required, Validators.pattern('^\\+?[1-9]\\d{9,14}$')]],
      preferredChannel: ['sms', Validators.required],
      whatsappOptIn: [false]
    });

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

  nextStep() {
    if (this.step() === 1) {
      this.schoolForm.markAllAsTouched();
      if (this.schoolForm.valid) {
        this.formData.set({ ...this.formData(), ...this.schoolForm.value });
        this.step.set(2);
      }
    } else if (this.step() === 2) {
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

    const finalData = {
      schoolName: this.formData().schoolName,
      adminName: this.formData().adminName,
      username: this.formData().username,
      email: this.formData().email,
      mobileNo: this.formData().mobileNo,
      preferredChannel: this.formData().preferredChannel,
      whatsappOptIn: this.formData().whatsappOptIn,
      address: {
        street: this.formData().address?.street || '',
        city: this.formData().address?.city || '',
        state: this.formData().address?.state || '',
        country: this.formData().address?.country || '',
        postalCode: this.formData().address?.postalCode || ''
      },
      latitude: this.formData().address?.latitude || this.formData().latitude,
      longitude: this.formData().address?.longitude || this.formData().longitude
    };

    console.log('Sending to backend:', finalData);

    this.authService.registerSchool(finalData).subscribe({
      next: (res: any) => {
        this.toastr.success(
          `Welcome to ${res.data.schoolName}! Your school has been registered. Check your email (${finalData.email}) and ${finalData.preferredChannel === 'sms' ? 'SMS' : finalData.preferredChannel === 'whatsapp' ? 'WhatsApp' : 'SMS/WhatsApp'} (${finalData.mobileNo}) for a link to set your password.`,
          'Registration Successful',
          { timeOut: 5000 }
        );
        setTimeout(() => {
          this.router.navigate(['/confirmation'], {
            queryParams: {
              schoolName: finalData.schoolName,
              email: finalData.email,
              mobileNo: finalData.mobileNo,
              preferredChannel: finalData.preferredChannel
            }
          });
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
  get a() { return this.addressForm.controls; }

  onMapClick(event: google.maps.MapMouseEvent): void {
    if (!event.latLng) {
      this.addressError = 'Invalid click position.';
      return;
    }

    const lat = event.latLng.lat();
    const lng = event.latLng.lng();

    this.addressForm.patchValue({
      latitude: lat,
      longitude: lng
    });

    this.markerPosition = { lat, lng };
    this.reverseGeocode(lat, lng);
    this.addressError = null;
    this.toastr.success(`Location set: ${lat.toFixed(6)}, ${lng.toFixed(6)}`, 'Success');
  }

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