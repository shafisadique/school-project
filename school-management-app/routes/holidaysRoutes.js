const express = require('express');
const router = express.Router();
const holidayController = require('../controllers/school/holidayController');

router.post('/add', holidayController.addHoliday);
router.get('/list/:schoolId', holidayController.getHolidays);
router.delete('/delete/:id', holidayController.deleteHoliday);

module.exports = router;
