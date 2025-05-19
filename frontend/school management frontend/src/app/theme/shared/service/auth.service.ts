import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, map, Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { ToastrService } from 'ngx-toastr';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  baseUrl = environment.apiUrl;
  private _isLoggedIn$ = new BehaviorSubject<boolean>(this.hasToken());
  currentSchoolId = localStorage.getItem('schoolId');

  constructor(private http: HttpClient, private toastr: ToastrService, private router: Router) {}

  login(username: string, password: string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/api/auth/login`, { username, password }).pipe(
      map((response: any) => {
        console.log('Login response:', response); // Debug log
        if (response && response.token) {
          this.toastr.success('Login Success', 'Success');
          this._isLoggedIn$.next(true);
          localStorage.setItem('token', response.token);
          localStorage.setItem('role', response.role);
          localStorage.setItem('schoolId', response.schoolId);
          localStorage.setItem('userId', response.userId);
          localStorage.setItem('user', JSON.stringify(response));

          // Store teacherId if the user is a teacher
          if (response.role === 'teacher' && response.teacherId) {
            localStorage.setItem('teacherId', response.teacherId);
          }

          // Store activeAcademicYearId
          if (response.activeAcademicYearId) {
            localStorage.setItem('activeAcademicYearId', response.activeAcademicYearId);
          }
        }
        return response;
      })
    );
  }

  getUserSchoolId() {
    return localStorage.getItem('schoolId');
  }

  get isLoggedIn$(): Observable<boolean> {
    return this._isLoggedIn$.asObservable();
  }

  private hasToken(): boolean {
    return !!localStorage.getItem('token');
  }

  logOut(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('schoolId');
    localStorage.removeItem('userId');
    localStorage.removeItem('user');
    localStorage.removeItem('teacherId');
    localStorage.removeItem('activeAcademicYearId');
    this._isLoggedIn$.next(false);
    this.toastr.success('Logout Success', 'You have been logged out.');
    this.router.navigate(['/auth/login']);
  }

  setUser(user: any) {
    localStorage.setItem('user', JSON.stringify(user));
  }

  getUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  }

  getSchoolId(): string | null {
    return localStorage.getItem('schoolId');
  }

  getUserToken(): string | null {
    return localStorage.getItem('token');
  }

  registerSchool(formData: any): Observable<any> {
    const url = `${this.baseUrl}/api/auth/register-school`;
    return this.http.post(url, formData);
  }
}