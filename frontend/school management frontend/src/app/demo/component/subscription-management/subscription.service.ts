import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { ToastrService } from 'ngx-toastr'; // Optional: for user-friendly errors

export interface SubscriptionPlan {
  name: string;
  price: number;
  duration: number; // in days
  sms: number;
  whatsapp: number;
  priority: number;
  planType: string;
}

export interface SubscriptionDetails {
  planType: string;
  name: string;
  expiresAt: string;
  status: string;
  features: string[];
  // Add more fields as per your backend response
}
export interface ExpiryStatus {  // NEW: Interface for response
  currentPlanName: string;
  planType: string;
  expiresAt: string;
  daysRemaining: number;
  status: string;
  isExpiringSoon: boolean;
  isExpired: boolean;
  isPending: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class SubscriptionService {
  private apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private toastr?: ToastrService // Optional injection
  ) {}
  

  /**
   * Get list of all available subscription plans
   */
  getPlans(): Observable<SubscriptionPlan[]> {
    return this.http.get<{ [key: string]: SubscriptionPlan }>(`${this.apiUrl}/api/subscriptions/plans`).pipe(
      map(response => Object.values(response)), // Convert object to array
      catchError(err => {
        console.error('Failed to load plans:', err);
        this.toastr?.error('Unable to load subscription plans');
        return of([]); // Return empty array on error
      })
    );
  }
  getExpiryStatus(): Observable<ExpiryStatus> {
    return this.http.get<ExpiryStatus>(`${this.apiUrl}/api/subscriptions/expiry-status`, { withCredentials: true }).pipe(
      catchError(err => {
        console.error('Failed to load expiry status:', err);
        this.toastr?.error('Unable to check subscription status');
        // Fallback: Treat as expired to show alert (or set showExpiryAlert=false in component)
        return of({
          currentPlanName: 'Unknown',
          planType: '',
          expiresAt: '',
          daysRemaining: 0,
          status: 'expired',
          isExpiringSoon: false,
          isExpired: true,
          isPending: false
        });
      })
    );
  }
  

  /**
   * Get current subscription details for the authenticated school
   */
  getCurrentSubscription(): Observable<SubscriptionDetails> {
    return this.http.get<SubscriptionDetails>(`${this.apiUrl}/api/subscriptions/current`).pipe(
      catchError(err => {
        console.error('Failed to load current subscription:', err);
        this.toastr?.error('Unable to load your current plan');
        throw err; // Let caller handle if needed
      })
    );
  }

  /**
   * Check if the current subscription has a specific feature
   * @param feature - e.g., 'whatsapp', 'analytics'
   */
  hasFeature(feature: string): Observable<boolean> {
    return this.getCurrentSubscription().pipe(
      map(sub => sub.features?.includes(feature) === true),
      catchError(() => of(false)) // Default to false on error
    );
  }

  /**
   * Update/Upgrade subscription for a specific school (Admin only)
   * @param schoolId - School ID
   * @param planType - e.g., 'premium_monthly'
   * @param expiresAt - Optional custom expiration date (ISO string)
   */
  updateSubscription(schoolId: string, planType: string, expiresAt?: string): Observable<any> {
    const body = { schoolId, planType };
    if (expiresAt) body['expiresAt'] = expiresAt;

    return this.http.post(`${this.apiUrl}/api/auth/subscription/update`, body).pipe(
      catchError(err => {
        console.error('Subscription update failed:', err);
        this.toastr?.error(err.error?.message || 'Failed to update subscription');
        throw err;
      })
    );
  }
    verifyPayment(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/subscriptions/verify-payment`, data, { withCredentials: true });
  }

  /**
   * Get list of all schools (for admin subscription management)
   */
  getSchools(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/api/schools/all`).pipe(
      catchError(err => {
        console.error('Failed to load schools:', err);
        this.toastr?.error('Unable to load school list');
        return of([]);
      })
    );
  }

   upgradeSubscription(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/api/subscriptions/upgrade`, data, { withCredentials: true });
  }
}