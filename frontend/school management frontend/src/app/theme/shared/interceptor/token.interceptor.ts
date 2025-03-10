import { HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../service/auth.service';

export const tokenInterceptor: HttpInterceptorFn = (req, next) => {
  const authService =inject(AuthService)
  const myToken = authService.getUserToken();
  if(req.url.includes('login')){
    return next(req);
  }

  const token = `Bearer ${myToken}`;
  const cloneReq =req.clone({
    setHeaders :{
      Authorization: token
    }
  })
  return next(cloneReq);
};  
