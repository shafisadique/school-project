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
  baseUrl = environment.apiUrl; // Use the backend URL from environment
  private _isLoggedIn$ = new BehaviorSubject<boolean>(this.hasToken());

  constructor(private http: HttpClient, private toastr: ToastrService,private router:Router) { }

  login(username: string, password: string): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/api/auth/login`, { username, password }).pipe(
      map((response: any) => {
        console.log(response);
        if (response && response.token) {
          this.toastr.success('Login Success', response.msg);
          this._isLoggedIn$.next(true);
          localStorage.setItem('token', response.token); // Store token in session storage
          localStorage.setItem('role', response.role);
          localStorage.setItem('schoolId', response.schoolId);
          localStorage.setItem('userId',response.userId)
        }
        return response;
      })
    );
  }


  get isLoggedIn$(): Observable<boolean> {
    return this._isLoggedIn$.asObservable();
  }

  private hasToken(): boolean {
    return !!localStorage.getItem('token');
  }
  logOut(): void {
    localStorage.removeItem('token'); // Remove token on logout
    this._isLoggedIn$.next(false); // Update login status
    this.toastr.success('Logout Success', 'You have been logged out.');
    this.router.navigate(['/auth/login']); // Redirect to login page
  }

  setUser(user: any) {
    localStorage.setItem('user', JSON.stringify(user));
  }

  getUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  }

  // ✅ Get schoolId from user data
  getSchoolId(): string | null {
    return localStorage.getItem('schoolId');
  }


  getUserToken(): string | null {
    return localStorage.getItem('token');
  }

  registerSchool(formData:any):Observable<any>{
    const url = `${this.baseUrl}/api/auth/register-school`;
    return this.http.post(url,formData)
  }
}
