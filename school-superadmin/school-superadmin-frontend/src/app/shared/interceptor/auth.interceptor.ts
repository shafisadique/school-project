import {
  HttpRequest,
  HttpHandlerFn,
  HttpEvent,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from '../services/auth.service';

export function authInterceptor(
  req: HttpRequest<any>,
  next: HttpHandlerFn
): Observable<HttpEvent<any>> {
  const authService = inject(AuthService);
  const router = inject(Router);
  const toastr = inject(ToastrService);

  const token = authService.getUserToken();

  // ⛔ Skip token for login/register requests
  if (req.url.includes('/login') || req.url.includes('/register')) {
    return next(req).pipe(
      catchError((error: HttpErrorResponse) => {
        // Show backend login/register errors only
        let message = 'An error occurred';
        if (error.error?.message) {
          message = error.error.message;
        }
        toastr.error(message);
        return throwError(() => error);
      })
    );
  }

  // ✅ Attach token for all other APIs
  let authReq = req;
  if (token) {
    authReq = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` }
    });
  }

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      let message = 'An error occurred';

      if (error.status === 401) {
        if (error.error?.message?.includes('Session expired')) {
          message = 'Your session has expired. Please log in again.';
          authService.logOut();
          router.navigate(['/auth/login']);
        } else if (error.error?.message?.includes('Invalid token')) {
          message = 'Invalid session. Please log in again.';
          authService.logOut();
          router.navigate(['/login']);
        }
      } else if (error.error?.message) {
        message = error.error.message;
      }

      toastr.error(message);
      return throwError(() => error);
    })
  );
}
