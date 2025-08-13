import { HttpInterceptorFn, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { LoadingService } from '../service/loading.service';

export const loadingInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
  const loadingService = inject(LoadingService);
  console.log('Loading interceptor triggered for:', req.url); // Debug log
  loadingService.show();

  return next(req).pipe(
    finalize(() => {
      console.log('Loading interceptor completed for:', req.url); // Debug log
      loadingService.hide();
    })
  );
};