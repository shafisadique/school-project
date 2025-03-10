import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideToastr } from 'ngx-toastr';
import {  provideHttpClient, withInterceptors } from '@angular/common/http';
import {routes} from './app-routing.module'
import { tokenInterceptor } from './theme/shared/interceptor/token.interceptor';

// import { tokenInterceptor } from './theme/shared/interceptor/token.interceptor';
// import { errorIntercepter } from './theme/shared/interceptor/error.interceptor';


export const appConfig: ApplicationConfig = {
  providers: [
    provideAnimations(),
    provideToastr({
      timeOut: 3000,  // ✅ Show for 3 seconds
      positionClass: 'toast-top-right',  // ✅ Move Toastr to the top-right
      preventDuplicates: true,
      progressBar: true,
      closeButton: true
    }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([tokenInterceptor])) // ✅ Apply Token Interceptor
  ]
};
