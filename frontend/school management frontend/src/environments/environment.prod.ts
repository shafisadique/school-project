import packageInfo from '../../package.json';

export const environment = {
  appVersion: packageInfo.version,
  production: true,
  apiUrl: 'https://school-management-production-da4c.up.railway.app',
  razorpayKey: 'rzp_live_xxxxxxxxxxxx'
};
