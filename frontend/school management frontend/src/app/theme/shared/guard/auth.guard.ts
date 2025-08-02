import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, RouterStateSnapshot, Router, CanActivateFn } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, map, take } from 'rxjs/operators';
import { AuthService } from '../service/auth.service';
import { ToastrService } from 'ngx-toastr'; // Import Toastr for notifications

// Use CanActivateFn instead of class-based guard for simplicity with inject
export const AuthGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
): Observable<boolean> | boolean => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const toastr = inject(ToastrService); // Inject Toastr for user feedback

  return authService.isLoggedIn$.pipe(
    take(1),
    map(isLoggedIn => {
      if (!isLoggedIn) {
        toastr.error('Please log in to access this page');
        router.navigate(['/auth/login'], { queryParams: { returnUrl: state.url } });
        return false;
      }

      // Get the user's role
      const userRole = authService.getUserRole();
      if (!userRole) {
        toastr.error('User role not found');
        router.navigate(['/dashboard/default']);
        return false;
      }

      // Check if the route has required roles
      const requiredRoles = route.data?.['roles'] as string[] | undefined;
      if (requiredRoles && !requiredRoles.includes(userRole)) {
        toastr.error('You do not have permission to access this page');
        router.navigate(['/dashboard/default']); // Redirect to a safe page for unauthorized access
        return false;
      }

      return true;
    }),
    catchError((error) => {
      console.error('Authorization error:', error);
      toastr.error('An error occurred during authorization');
      router.navigate(['/error']);
      return of(false);
    })
  );
};