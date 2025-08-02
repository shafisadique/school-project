const express = require('express');
const router = express.Router();
const holidayController = require('../controllers/school/holidayController');

// Routes for holiday management
router.post('/add', holidayController.addHoliday);
router.get('/list/:schoolId', holidayController.getHolidays);
router.put('/update/:id', holidayController.updateHoliday);
router.delete('/delete/:id', holidayController.deleteHoliday);
router.get('/check/:schoolId', holidayController.checkHoliday);
module.exports = router;