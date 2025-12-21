import {  HttpInterceptorFn} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const toastr = inject(ToastrService);

  const token = authService.getUserToken();

  // Skip adding token for login
  if (req.url.includes('/login') || req.url.includes('/register')) {
    return next(req);
  }

  // Add token + GOD headers
  let headers: any = {};

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Always send these two (your nuclear lock)
  const masterKey = localStorage.getItem('__GOD_MASTER_KEY');
  const deviceFp = localStorage.getItem('__GOD_DEVICE_FP');
  if (masterKey) headers['X-Master-Key'] = masterKey;
  if (deviceFp) headers['X-Device-Fp'] = deviceFp;

  const authReq = req.clone({ setHeaders: headers });

  return next(authReq).pipe(
    catchError((error: any) => {
      if (error.status === 401) {
        toastr.error('Session expired or invalid');
        authService.logOut();
        router.navigate(['/signin']);
      }
      return throwError(() => error);
    })
  );
};