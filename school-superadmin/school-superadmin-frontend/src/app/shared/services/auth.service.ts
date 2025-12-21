// src/app/services/auth.service.ts
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { BehaviorSubject, catchError, map, Observable, throwError } from 'rxjs';
import { AuthResponse, UserResponse } from '../models/auth.models';
import { environment } from '../../../environments/environments';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private toastr = inject(ToastrService);
  private router = inject(Router);

  private baseUrl = environment.apiUrl;
  private isLoggedIn = new BehaviorSubject<boolean>(this.hasToken());

  // 1 HOUR SESSION TIMER
  private sessionTimeout: any;

  constructor() {
    this.updateAuthState();
    this.startSessionTimer(); // Start timer on app load
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/api/auth/login`, { email, password }).pipe(
      map((response) => {
        if (response && response.token) {
          this.toastr.success('Welcome back, Owner!', 'Login Success');

          // STORE NORMAL DATA
          localStorage.setItem('token', response.token);
          localStorage.setItem('role', response.user.role);
          localStorage.setItem('userId', response.user.id || response.user.id);
          localStorage.setItem('user', JSON.stringify(response.user));

          // CRITICAL: SAVE GOD PROOFS
          localStorage.setItem('__GOD_MASTER_KEY', environment.masterKey);
          localStorage.setItem('__GOD_DEVICE_FP', environment.deviceFp);

          this.resetSessionTimer();
          this.isLoggedIn.next(true);
          this.router.navigate(['/dashboard']);
        }
        return response;
      }),
      catchError(this.handleError)
    );
  }

  // MUST CALL THIS ON EVERY USER ACTIVITY
  resetSessionTimer() {
    if (this.sessionTimeout) clearTimeout(this.sessionTimeout);

    this.sessionTimeout = setTimeout(() => {
      this.toastr.warning('Session expired after 1 hour', 'Logging out...');
      this.forceLogout();
    }, 60 * 60 * 1000); // Exactly 60 minutes
  }

  private startSessionTimer() {
    if (this.hasToken()) {
      this.resetSessionTimer();
    }
  }

  private forceLogout() {
    localStorage.clear();
    sessionStorage.clear();
    this.isLoggedIn.next(false);
    this.router.navigate(['/signin']);
    this.toastr.info('You have been logged out');
  }

  logOut(): void {
    this.forceLogout();
  }

  // GETTERS
  getUserRole(): string | null {
    return localStorage.getItem('role');
  }

  getUserId(): string | null {
    return localStorage.getItem('userId');
  }

  getUserToken(): string | null {
    return localStorage.getItem('token');
  }

  get isLoggedIn$() {
    return this.isLoggedIn.asObservable();
  }

  // OWNER VERIFICATION (Used by SuperAdminOwnerGuard)
  isRealOwner(): boolean {
    const savedMaster = localStorage.getItem('__GOD_MASTER_KEY');
    const savedFp = localStorage.getItem('__GOD_DEVICE_FP');

    return (
      savedMaster === environment.masterKey &&
      savedFp === environment.deviceFp
    );
  }

  private hasToken(): boolean {
    return !!localStorage.getItem('token');
  }

  private storeAuthData(response: AuthResponse): void {
    localStorage.setItem('token', response.token);
    localStorage.setItem('role', response.user.role);
    localStorage.setItem('userId', response.user.id || response.user.id);
    localStorage.setItem('user', JSON.stringify(response.user));
    localStorage.setItem('__GOD_MASTER_KEY', environment.masterKey);
    localStorage.setItem('__GOD_DEVICE_FP', environment.deviceFp);
  }

  private updateAuthState(): void {
    this.isLoggedIn.next(this.hasToken());
  }

  private handleError = (error: HttpErrorResponse) => {
    let msg = 'Something went wrong';
    if (error.error?.message) msg = error.error.message;
    else if (error.status === 401) msg = 'Invalid credentials';

    this.toastr.error(msg);
    return throwError(() => new Error(msg));
  };

  registerSchool(formData: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/auth/register-school`, formData).pipe(catchError(this.handleError));
  }
changePassword(data: { currentPassword: string; newPassword: string }): Observable<any> {
    return this.http.patch(`${this.baseUrl}/api/user/change-password`, data).pipe(
      map(() => {
        this.toastr.success('Password changed successfully');
        return true;
      }),
      catchError(this.handleError)
    );
  }

  forgotPassword(email: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/auth/user/forgot-password`, { email }).pipe(
      map(() => {
        this.toastr.success('Password reset link sent to your email');
        return true;
      }),
      catchError(this.handleError)
    );
  }

  resetPassword(token: string, newPassword: string): Observable<any> {
  return this.http.post(`${this.baseUrl}/api/auth/reset-password`, {
    token,
    newPassword
  });
}

  getProfile(): Observable<UserResponse> {
    const userId = this.getUserId();
    if (!userId) {
      throw new Error('User ID not found');
    }
    return this.http.get<UserResponse>(`${this.baseUrl}/api/users/${userId}`).pipe(
      map((response) => {
        this.toastr.success('Profile retrieved successfully');
        return response;
      }),
      catchError(this.handleError)
    );
  }

  updateProfile(data: { name: string; email: string; additionalInfo?: any }): Observable<UserResponse> {
    const userId = this.getUserId();
    if (!userId) {
      throw new Error('User ID not found');
    }
    return this.http.put<UserResponse>(`${this.baseUrl}/api/users/${userId}`, data).pipe(
      map((response) => {
        this.toastr.success('Profile updated successfully');
        return response;
      }),
      catchError(this.handleError)
    );
  }


  setUser(user: AuthResponse): void {
    localStorage.setItem('user', JSON.stringify(user));
    this.storeAuthData(user);
  }

  getUser(): AuthResponse | null {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  }


}