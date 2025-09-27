/// <reference types="googlemaps" />

import { Component, OnInit, AfterViewChecked, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormControl, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SchoolService } from '../school.service';
import { FormsModule } from '@angular/forms';
import { environment } from 'src/environments/environment';
import { GoogleMap, MapMarker } from '@angular/google-maps';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-school-modify',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, GoogleMap, MapMarker],
  templateUrl: './school-modify.component.html',
  styleUrl: './school-modify.component.scss'
})
export class SchoolModifyComponent implements OnInit, AfterViewChecked {
  @ViewChild(GoogleMap) map!: GoogleMap;
  
  schoolForm!: FormGroup;
  schoolId: string | null = null;
  academicYear: string[] = ['2024-2025', '2025-2026'];
  selectedFile: File | null = null;
  backendUrl = 'http://localhost:5000';
  
  // Map properties - SAME AS REGISTRATION
  center: google.maps.LatLngLiteral = { lat: 28.6139, lng: 77.2090 }; // Default to New Delhi
  zoom = 12;
  markerPosition: google.maps.LatLngLiteral | null = null;
  
  // Address error handling - SAME AS REGISTRATION
  addressError: string | null = null;
  isSubmitting = false;

  constructor(
    private fb: FormBuilder, 
    private schoolService: SchoolService,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.schoolId = localStorage.getItem('schoolId');
    if (!this.schoolId) {
      console.error('No schoolId found in localStorage');
      this.fetchSchoolByUser();
    } else {
      this.fetchSchool();
    }
  }

  ngAfterViewChecked() {
    console.log('Current logo value:', this.schoolForm.get('logo')?.value);
  }

  initForm() {
    this.schoolForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      street: ['', [Validators.required, Validators.minLength(5)]],
      city: ['', [Validators.required, Validators.minLength(2)]],
      contact: ['', [
        Validators.required,
        Validators.pattern(/^\+?[1-9]\d{9,14}$/)
      ]],
      academicYear: ['', Validators.required],
      logo: [''],
      // Coordinates - SAME AS REGISTRATION
      latitude: [null, Validators.required],
      longitude: [null, Validators.required],
      // Address fields for reverse geocoding - SAME AS REGISTRATION
      state: [''],
      country: [''],
      postalCode: ['']
    });
  }

  // SAME AS REGISTRATION - Handle map click to get lat/lng
  onMapClick(event: google.maps.MapMouseEvent): void {
    if (!event.latLng) {
      this.addressError = 'Invalid click position.';
      return;
    }

    const lat = event.latLng.lat();
    const lng = event.latLng.lng();

    // Update form - SAME AS REGISTRATION
    this.schoolForm.patchValue({
      latitude: lat,
      longitude: lng
    });

    // Update marker position - SAME AS REGISTRATION
    this.markerPosition = { lat, lng };

    // Optional: Reverse geocode to get address details - SAME AS REGISTRATION
    this.reverseGeocode(lat, lng);

    this.addressError = null;
    this.toastr.success(`Location set: ${lat.toFixed(6)}, ${lng.toFixed(6)}`, 'Success');
  }

  // SAME AS REGISTRATION - Reverse geocode to fill address fields
  private reverseGeocode(lat: number, lng: number): void {
    if (!window.google || !window.google.maps) return;

    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === 'OK' && results[0]) {
        const address = results[0];
        this.schoolForm.patchValue({
          street: address.formatted_address || '',
          city: address.address_components?.find(comp => comp.types.includes('locality'))?.long_name || '',
          state: address.address_components?.find(comp => comp.types.includes('administrative_area_level_1'))?.long_name || '',
          country: address.address_components?.find(comp => comp.types.includes('country'))?.long_name || '',
          postalCode: address.address_components?.find(comp => comp.types.includes('postal_code'))?.long_name || ''
        });
      }
    });
  }

  fetchSchool() {
    if (!this.schoolId) {
      console.error('School ID is required');
      return;
    }
    this.schoolService.getSchoolById(this.schoolId).subscribe({
      next: (data) => {
        console.log('Fetched school data with coordinates:', data);
        this.patchFormValues(data);
        
        // Update map center if coordinates exist - SAME LOGIC AS REGISTRATION
        if (data.latitude && data.longitude) {
          this.center = { lat: data.latitude, lng: data.longitude };
          this.zoom = 15;
          this.markerPosition = { lat: data.latitude, lng: data.longitude };
        }
      },
      error: (err) => {
        console.error('Error fetching school by ID:', err);
        this.toastr.error('Failed to load school data');
      }
    });
  }

  fetchSchoolByUser() {
    this.schoolService.getMySchool().subscribe({
      next: (data) => {
        console.log('Fetched school data by user with coordinates:', data);
        if (data && data._id) {
          this.schoolId = data._id;
          localStorage.setItem('schoolId', this.schoolId);
          this.patchFormValues(data);
          
          // Update map center if coordinates exist - SAME LOGIC AS REGISTRATION
          if (data.latitude && data.longitude) {
            this.center = { lat: data.latitude, lng: data.longitude };
            this.zoom = 15;
            this.markerPosition = { lat: data.latitude, lng: data.longitude };
          }
        }
      },
      error: (err) => {
        console.error('Error fetching school by user:', err);
        this.toastr.error('Failed to load school data');
      }
    });
  }

  patchFormValues(data: any) {
    let logoUrl = data.logo || '';
    if (logoUrl && !logoUrl.startsWith('http')) {
      logoUrl = `${environment.apiUrl}${logoUrl.startsWith('/') ? '' : '/'}${logoUrl}`;
    }

    this.schoolForm.patchValue({
      name: data.name || '',
      street: data.address?.street || '',
      city: data.address?.city || '',
      contact: data.contact || data.mobileNo || '',
      academicYear: data.academicYear || (data.activeAcademicYear?.year || this.academicYear[0]),
      logo: logoUrl || '',
      // Coordinates - SAME AS REGISTRATION
      latitude: data.latitude || null,
      longitude: data.longitude || null,
      // Address fields from reverse geocoding
      state: data.address?.state || '',
      country: data.address?.country || '',
      postalCode: data.address?.postalCode || ''
    }, { emitEvent: false });
  }

  updateSchool() {
    if (this.schoolForm.invalid) {
      console.warn('Form is invalid:', this.schoolForm.errors);
      this.schoolForm.markAllAsTouched();
      // Scroll to first invalid field
      const firstInvalid = document.querySelector('.ng-invalid');
      if (firstInvalid) {
        firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    if (this.isSubmitting) return;
    this.isSubmitting = true;

    const schoolData = {
      schoolName: this.schoolForm.value.name,
      address: {
        street: this.schoolForm.value.street,
        city: this.schoolForm.value.city,
        state: this.schoolForm.value.state,
        country: this.schoolForm.value.country,
        postalCode: this.schoolForm.value.postalCode
      },
      mobileNo: this.schoolForm.value.contact,
      academicYear: this.schoolForm.value.academicYear,
      // Coordinates - SAME STRUCTURE AS REGISTRATION
      latitude: this.schoolForm.value.latitude,
      longitude: this.schoolForm.value.longitude,
      radius: 100 // Default radius, or add a field if needed
    };

    console.log('Updating school with coordinates:', schoolData);

    this.schoolService.updateSchool(this.schoolId!, schoolData).subscribe({
      next: (response) => {
        this.toastr.success('School updated successfully!');
        this.isSubmitting = false;
        // Refresh data
        this.fetchSchool();
      },
      error: (err) => {
        console.error('Error updating school:', err);
        this.toastr.error(err.error?.message || 'Failed to update school');
        this.isSubmitting = false;
      }
    });
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        this.toastr.error('Please select a valid image file');
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        this.toastr.error('File size must be less than 2MB');
        return;
      }
      this.selectedFile = file;
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.schoolForm.get('logo')?.setValue(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  }

  uploadLogo() {
    if (!this.selectedFile || !this.schoolId) {
      this.toastr.error(this.selectedFile ? 'School ID not found' : 'Please select an image first!');
      return;
    }

    this.schoolService.uploadLogo(this.schoolId, this.selectedFile).subscribe({
      next: (response) => {
        console.log('Upload response:', response);
        this.toastr.success('Logo uploaded successfully!');
        this.schoolForm.get('logo')?.setValue(response.logoUrl);
        this.selectedFile = null;
        // Reset file input
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
        this.fetchSchool();
      },
      error: (err) => {
        console.error('Error uploading logo:', err);
        this.toastr.error('Failed to upload logo. Please try again.');
      }
    });
  }

  // Get form controls - SAME AS REGISTRATION
  get f() { return this.schoolForm.controls; }

  // Check if coordinates are valid - ADAPTED FROM REGISTRATION
  areCoordinatesValid(): boolean {
    const latControl = this.schoolForm.get('latitude');
    const lngControl = this.schoolForm.get('longitude');
    
    return !!(latControl?.valid && lngControl?.valid && 
      latControl?.value && lngControl?.value);
  }

  getCoordinatesStatus(): string {
    const lat = this.schoolForm.get('latitude')?.value;
    const lng = this.schoolForm.get('longitude')?.value;
    
    if (!lat || !lng) {
      return 'No location set. Please click on the map to select your school location.';
    }
    return `Location set: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  }
}