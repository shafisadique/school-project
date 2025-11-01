// src/app/theme/shared/service/auth.service.ts
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { BehaviorSubject, Observable, catchError, map, of, throwError } from 'rxjs';
import { environment } from 'src/environments/environment';
import { ToastrService } from 'ngx-toastr';
import { Router } from '@angular/router';
import { AuthResponse, UserResponse } from '../models/auth.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private toastr = inject(ToastrService);
  private router = inject(Router);

  private baseUrl = environment.apiUrl;
  private isLoggedIn = new BehaviorSubject<boolean>(this.hasToken());
  public currentSchoolId = signal<string | null>(localStorage.getItem('schoolId')); // Made public

  constructor() {
    this.updateAuthState();
  }
  getUserEmail(){}

  login(username: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/api/auth/login`, { username, password }).pipe(
      map((response) => {
        if (response && response.token) {
          this.toastr.success('Login Success', 'Success');
          this.isLoggedIn.next(true);
          this.storeAuthData(response);
        }
        return response;
      }),
    );
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

  resetPassword(data: { token: string, newPassword: string, confirmPassword: string }) {
    return this.http.post(`${this.baseUrl}/api/auth/user/reset-password`, data);
  }
  
  getTeacherId(): string | null {
    return localStorage.getItem('teacherId');
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

  getUserSchoolId(): string | null {
    return this.currentSchoolId();
  }

  validateParentForStudent(studentId: string): Observable<boolean> {
    return this.http.get<boolean>(`${this.baseUrl}/api/auth/validate-parent/${studentId}`, {
      params: { userId: this.getUserId() || '' }
    }).pipe(catchError(this.handleError));
  }

  getUserRole(): string | null {
    return localStorage.getItem('role');
  }

  getActiveAcademicYearId(): string | null {
    return localStorage.getItem('activeAcademicYearId');
  }

  getUserId(): string | null {
    return localStorage.getItem('userId');
  }

  get isLoggedIn$(): Observable<boolean> {
    return this.isLoggedIn.asObservable();
  }

  private hasToken(): boolean {
    return !!localStorage.getItem('token');
  }

  logOut(): Observable<void> {
    localStorage.clear();
    this.isLoggedIn.next(false);
    this.currentSchoolId.set(null);
    this.toastr.success('Logout Success', 'You have been logged out.');
    return of(void 0);
  }

  setUser(user: AuthResponse): void {
    localStorage.setItem('user', JSON.stringify(user));
    this.storeAuthData(user);
  }

  getUser(): AuthResponse | null {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  }

  getSchoolId(): string | null {
    return this.currentSchoolId();
  }

  getUserToken(): string | null {
    return localStorage.getItem('token');
  }

  registerSchool(formData: any): Observable<any> {
    return this.http.post(`${this.baseUrl}/api/auth/register-school`, formData).pipe(catchError(this.handleError));
  }

  private storeAuthData(response: AuthResponse): void {
    localStorage.setItem('token', response.token);
    localStorage.setItem('role', response.role);
    localStorage.setItem('schoolId', response.schoolId);
    localStorage.setItem('userId', response.userId);
    if (response.teacherId) localStorage.setItem('teacherId', response.teacherId);
    if (response.activeAcademicYearId) localStorage.setItem('activeAcademicYearId', response.activeAcademicYearId);
    this.currentSchoolId.set(response.schoolId);
    if (response.studentId) localStorage.setItem('studentId', response.studentId);
  }

  private updateAuthState(): void {
    if (this.hasToken()) {
      const user = this.getUser();
      if (user) this.currentSchoolId.set(user.schoolId);
      this.isLoggedIn.next(true);
    }
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    this.toastr.error(error.error?.message || 'An error occurred');
    return throwError(() => new Error(error.message || 'Server error'));
  }
}

export { UserResponse };
