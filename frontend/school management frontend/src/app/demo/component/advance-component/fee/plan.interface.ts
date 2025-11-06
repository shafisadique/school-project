export interface SubscriptionPlan {
  name: string;
  price: number;
  originalPrice: number;
  duration: number; // in days
  smsMonthlyLimit: number;
  whatsappMonthlyLimit: number;
  features: string[];
  savings: number;
  recommended: boolean;
  value: string;
  discount: number;
}
