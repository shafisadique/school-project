import packageInfo from '../../package.json';

export const environment = {
  appVersion: packageInfo.version,
  production: true,
  apiUrl: 'https://edglobe.vercel.app',
  razorpayKey: 'rzp_live_xxxxxxxxxxxx',
  razorpayKeyId:'',
  googleMapsApiKey:'AIzaSyDKsK100m1obqgkQJILOEafWm2mReD0whA',
  testMode: false,
  imageUrl:'https://edglobe.vercel.app'

};
