import {HttpInterceptorFn} from '@angular/common/http'
import { inject } from '@angular/core';
import {catchError,throwError} from 'rxjs';
import { Router } from '@angular/router';
import { AuthService } from '../service/auth.service';

export const errorIntercepter:HttpInterceptorFn = (req,next) =>{
  const auth = inject(AuthService);
  const router = inject(Router);
  return next(req).pipe(catchError((error:any)=>{
    if([401,403].includes(error.status)){
      router.navigate(['/auth/login']);
      auth.logOut();
    }
    return throwError(() => error)
  }))
}
