import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from 'src/app/theme/shared/service/auth.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-auth-login',
  standalone: true,
  imports: [RouterModule, CommonModule, FormsModule, ReactiveFormsModule],
  providers: [],
  templateUrl: './auth-login.component.html',
  styleUrl: './auth-login.component.scss'
})
export class AuthLoginComponent {
  serverErrors: any = {};
  public loginForm: FormGroup;
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
      username: ['', [Validators.required, Validators.email]],
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

  onLoggedin(e: Event) {
    e.preventDefault();
    this.isLoading = true;
    this.isDisable = true;

    const { username, password } = this.loginForm.value;
    this.authService.login(username, password).subscribe({
      next: (res: any) => {
        console.log(res.message)
        const role = this.authService.getUserRole();
        if (role === 'superadmin') {
          this.router.navigate(['/auth/register']);
        } else if (role === 'admin') {
          this.router.navigate(['/']);
        } else {
          this.router.navigate(['/']);
        }
        this.toastrService.success('Login Success', 'Welcome!');
        this.isLoading = false;
        this.isDisable = false;
      },
      error: (errorResponse) => {
        console.log('Backend Error Response:', JSON.stringify(errorResponse, null, 2));
        const errorMessage = errorResponse.error?.message || 'Login Failed';

        if (errorResponse.status === 403 && errorMessage === 'You are not part of the school') {
          this.toastrService.error(errorMessage, 'Teacher Access Denied');
        } else if (errorResponse.status === 401) {
          this.toastrService.error(errorMessage, 'Authentication Failed');
        } else if (errorResponse.status === 400) {
          this.toastrService.error(errorMessage, 'Invalid Input');
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
        this.toggleForgotPassword(); // Return to login after success
      },
      error: (errorResponse) => {
        console.error('Forgot Password Error:', JSON.stringify(errorResponse, null, 2));
        const errorMessage = errorResponse.error?.message || 'Failed to send reset link';

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