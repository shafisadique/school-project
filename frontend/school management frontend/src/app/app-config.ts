import { ApplicationConfig, APP_INITIALIZER } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideToastr } from 'ngx-toastr';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app-routing.module';
import { tokenInterceptor } from './theme/shared/interceptor/token.interceptor';
import { RazorpayService } from './theme/shared/service/razorpay.service';
import { loadingInterceptor } from './theme/shared/interceptor/loading.interceptor';
import { authInterceptor } from './theme/shared/interceptor/auth.interceptor';

// Factory function to initialize Razorpay
const initializeRazorpay = (razorpayService: RazorpayService) => () =>
  razorpayService.loadRazorpayScript().catch(err => console.error('Razorpay SDK failed to load:', err));

export const appConfig: ApplicationConfig = {
  providers: [
    provideAnimations(),
    provideToastr({
      timeOut: 3000,
      positionClass: 'toast-top-right',
      preventDuplicates: true,
      progressBar: true,
      closeButton: true
    }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([tokenInterceptor,loadingInterceptor,authInterceptor])),
    {
      provide: APP_INITIALIZER,
      useFactory: initializeRazorpay,
      deps: [RazorpayService],
      multi: true
    }
  ]
};