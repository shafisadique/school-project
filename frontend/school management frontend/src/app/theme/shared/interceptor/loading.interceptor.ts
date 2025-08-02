// src/app/theme/shared/interceptors/loading.interceptor.ts
import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { LoadingService } from '../service/loading.service';

@Injectable()
export class LoadingInterceptor implements HttpInterceptor {
  constructor(private loadingService: LoadingService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Show loading indicator before the request
    this.loadingService.show();

    return next.handle(req).pipe(
      finalize(() => {
        // Hide loading indicator after the request completes (success or error)
        this.loadingService.hide();
      })
    );
  }
}