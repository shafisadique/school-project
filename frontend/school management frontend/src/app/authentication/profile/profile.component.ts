// src/app/authentication/profile/profile.component.ts
import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { AuthService, UserResponse } from 'src/app/theme/shared/service/auth.service';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { LoadingService } from 'src/app/theme/shared/service/loading.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [RouterModule, ReactiveFormsModule, CommonModule],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private toastr = inject(ToastrService);
  public router = inject(Router);
  public loadingService = inject(LoadingService);

  profileForm: FormGroup = this.fb.group({
    name: ['', {disabled: true }, [Validators.required]],
    username: ['', {disabled: true }],
    email: ['', {disabled: true }, [Validators.required, Validators.email]]
  });

  profileData = signal<UserResponse['data'] | null>(null);
  private destroy$ = new Subject<void>();
  ngOnInit(): void {
    this.loadProfile();
  }

   ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadProfile(): void {
    this.loadingService.show();
    this.authService.getProfile().subscribe({
      next: (res) => {
        this.profileData.set(res.data);
        this.profileForm.patchValue({
          name: res.data.name,
          username: res.data.username,
          email: res.data.email
        });
        this.disableEditing(); // Start with fields disabled
        this.loadingService.hide();
      },
      error: (err) => {
        this.toastr.error(err.error?.message || 'Error loading profile');
        this.loadingService.hide();
      }
    });
  }

  onSubmit(): void {
    if (this.profileForm.valid) {
      this.authService.updateProfile(this.profileForm.value).subscribe({
        next: (res) => {
          this.profileData.set(res.data);
          this.toastr.success('Profile updated successfully');
          this.disableEditing(); // Disable fields after successful update
        },
        error: (err) => this.toastr.error(err.error?.message || 'Error updating profile')
      });
    }
  }

  enableEditing(): void {
    this.profileForm.get('name')?.enable();
    this.profileForm.get('username')?.enable();
    this.profileForm.get('email')?.enable();
  }

  disableEditing(): void {
    this.profileForm.get('name')?.disable();
    this.profileForm.get('username')?.disable();
    this.profileForm.get('email')?.disable();
  }

  get p() { return this.profileForm.controls; }
}