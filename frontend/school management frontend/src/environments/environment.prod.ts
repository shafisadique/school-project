import packageInfo from '../../package.json';

export const environment = {
  appVersion: packageInfo.version,
  production: true,
  apiUrl: 'https://school-management-backend-khaki.vercel.app',
  razorpayKey: 'rzp_live_xxxxxxxxxxxx',
  razorpayKeyId:''
};
