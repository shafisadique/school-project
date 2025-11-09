import { APP_INITIALIZER, ApplicationConfig, importProvidersFrom, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';

import { routes } from './app.routes';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { RazorpayService } from './shared/services/razorpay.services';
import { provideToastr } from 'ngx-toastr';
import { tokenInterceptor } from './shared/interceptor/token.interceptor';
import { loadingInterceptor } from './shared/interceptor/loading.interceptor';
import { authInterceptor } from './shared/interceptor/auth.interceptor';
import { environment } from '../environments/environments';
import { GoogleMapsModule } from '@angular/google-maps';

// const initializeRazorpay = (razorpayService: RazorpayService) => () =>
//   razorpayService.loadRazorpayScript().catch(err => console.error('Razorpay SDK failed to load:', err));

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
    importProvidersFrom(GoogleMapsModule),
    {
      provide: 'GOOGLE_MAPS_API_KEY',
      useValue: environment.googleMapsApiKey
    },
    // {
    //   provide: APP_INITIALIZER,
    //   useFactory: initializeRazorpay,
    //   deps: [RazorpayService],
    //   multi: true
    // }
  ]
};
