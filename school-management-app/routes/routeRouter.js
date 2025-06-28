const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { 
  createRoute, 
  getRoutes, 
  getRoute, 
  updateRoute, 
  deleteRoute, 
  assignRoute 
} = require('../controllers/route/routeController');

router.post('/', authMiddleware, createRoute);
router.get('/', authMiddleware, getRoutes);
router.get('/:id', authMiddleware, getRoute);
router.put('/:id', authMiddleware, updateRoute);
router.delete('/:id', authMiddleware, deleteRoute);
router.post('/assign/:studentId', authMiddleware, assignRoute);

module.exports = router;