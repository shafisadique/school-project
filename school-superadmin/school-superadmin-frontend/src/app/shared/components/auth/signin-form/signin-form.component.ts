import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { LabelComponent } from '../../form/label/label.component';
import { InputFieldComponent } from '../../form/input/input-field.component';
import { Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../services/auth.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-signin-form',
  imports: [
    CommonModule,
    LabelComponent,
    InputFieldComponent,
    RouterModule,
    ReactiveFormsModule,
    FormsModule,
  ],
  templateUrl: './signin-form.component.html',
  styles: ``
})
export class SigninFormComponent {
  serverErrors: any = {};
  public loginForm: FormGroup;
  showPassword = false;
  public forgotPasswordForm: FormGroup;
  validationError = false;
  isLoading = false;
  isDisable = false;
  showForgotPassword = false;

  constructor(
    private fb: FormBuilder,
    public router: Router,
    private authService: AuthService,
    private toastrService: ToastrService
  ) {
    this.loginForm = this.fb.group({
      email: ['', Validators.required],  // email only (no email validation for superadmin)
      password: ['', Validators.required],
    });

    this.forgotPasswordForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
    });
  }

  toggleForgotPassword() {
    this.showForgotPassword = !this.showForgotPassword;
    this.serverErrors = {};
    this.forgotPasswordForm.reset();
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  loaderBtn: any;

  onLoggedin(e: Event) {
    e.preventDefault();
    this.isLoading = true;
    this.isDisable = true;

    const { email, password } = this.loginForm.value;
    this.authService.login(email, password).subscribe({
      next: (response) => {
        const role = this.authService.getUserRole();
        if (role === 'superadmin') {
          this.router.navigate(['/auth/register']);
        } else {
          // Fallback for non-superadmin (though superadmin-only app)
          this.router.navigate(['/']);
        }
        this.toastrService.success('Login Success', 'Welcome!');
        this.isLoading = false;
        this.isDisable = false;
      },
      error: (errorResponse) => {
        // Extract message correctly: backend sends { error: "msg" } or { message: "msg" }
        const errorMessage = errorResponse.error?.error || errorResponse.error?.message || 'Login Failed';
        if (errorResponse.status === 400) {
          this.toastrService.error(errorMessage, 'Invalid Credentials');
        } else if (errorResponse.status === 0) {
          this.toastrService.error('Network Error', 'Connection Failed');
        } else if (errorResponse.status === 500) {
          this.toastrService.error('Server Error', 'Please try again later');
        } else {
          this.toastrService.error(errorMessage, 'Login Failed');
        }

        this.serverErrors = { message: errorMessage };
        this.isLoading = false;
        this.isDisable = false;
      }
    });
  }

  onForgotPassword() {
    if (this.forgotPasswordForm.invalid) {
      this.forgotPasswordForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.isDisable = true;

    const { email } = this.forgotPasswordForm.value;
    this.authService.forgotPassword(email.trim()).subscribe({
      next: (res: any) => {
        this.toastrService.success('Password reset link sent to your email', 'Success');
        this.isLoading = false;
        this.isDisable = false;
        this.toggleForgotPassword();
      },
      error: (errorResponse) => {
        // Extract message correctly
        const errorMessage = errorResponse.error?.error || errorResponse.error?.message || 'Failed to send reset link';

        if (errorResponse.status === 404) {
          this.toastrService.error('Email not found in our records', 'Error');
          this.serverErrors = { email: 'Email not found in our records' };
        } else if (errorResponse.status === 400) {
          this.toastrService.error(errorMessage, 'Invalid Input');
          this.serverErrors = { email: errorMessage };
        } else if (errorResponse.status === 429) {
          this.toastrService.error('Too many requests, please try again later', 'Rate Limit Exceeded');
          this.serverErrors = { email: 'Too many requests, please try again later' };
        } else if (errorResponse.status === 0) {
          this.toastrService.error('Network Error', 'Connection Failed');
          this.serverErrors = { email: 'Network error, please check your connection' };
        } else {
          this.toastrService.error('An unexpected error occurred', 'Error');
          this.serverErrors = { email: 'An unexpected error occurred' };
        }

        this.isLoading = false;
        this.isDisable = false;
      }
    });
  }
}