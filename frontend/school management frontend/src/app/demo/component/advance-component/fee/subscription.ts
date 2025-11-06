export interface MessageDetails {
  sms: {
    monthlyLimit: number;
    usedThisMonth: number;
    remaining: number;
  };
  whatsapp: {
    monthlyLimit: number;
    usedThisMonth: number;
    remaining: number;
  };
}

export interface SubscriptionDetails {
  planType: string;
  name: string;
  expiresAt: string; // or Date if you plan to convert it
  daysRemaining: number;
  isTrial: boolean;
  isInGracePeriod: boolean;
  gracePeriodEnds: string; // or Date
  subscriptionStatus: 'active' | 'expired' | 'pending' | 'grace_period';
  paymentMethod: string | null;
  features: string[];
  autoRenew: boolean;
  testMode: boolean;
  messageDetails: MessageDetails;
}
