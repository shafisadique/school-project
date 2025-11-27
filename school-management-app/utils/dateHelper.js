// utils/dateHelper.js
const getISTDateString = (date = new Date()) => {
  return date.toLocaleDateString('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
};

const getTodayIST = () => getISTDateString();

module.exports = { getISTDateString, getTodayIST };