const mongoose = require('mongoose');
const Route = require('../../models/route');
const Student = require('../../models/student');
const APIError = require('../../utils/apiError');

// Create a Route (POST /api/routes)
const createRoute = async (req, res, next) => {
  try {
    const { schoolId, name, pickupPoints, distance, feeAmount, frequency } = req.body;
    if (!schoolId || !name || !pickupPoints || !distance || !feeAmount || !frequency) {
      throw new APIError('Missing required fields: schoolId, name, pickupPoints, distance, feeAmount, and frequency are required.', 400);
    }
    if (!mongoose.Types.ObjectId.isValid(schoolId)) {
      throw new APIError('Invalid school ID format', 400);
    }
    if (req.user.schoolId.toString() !== schoolId) {
      throw new APIError('You are not authorized to create routes for this school', 403);
    }

    // Use req.user.id instead of req.user._id to match authMiddleware
    const createdBy = req.user.id;
    if (!createdBy || !mongoose.Types.ObjectId.isValid(createdBy)) {
      throw new APIError('Authentication error: User ID is missing or invalid. req.user.id:', createdBy, 401);
    }

    const route = new Route({
      schoolId,
      name,
      pickupPoints,
      distance,
      feeAmount,
      frequency,
      createdBy // Use req.user.id
    });
    await route.save();
    res.status(201).json({ message: 'Route created successfully', data: route });
  } catch (error) {
    console.error('Error in createRoute:', error); // Debug: Log the full error
    next(error);
  }
};

// Get All Routes for a School (GET /api/routes)
const getRoutes = async (req, res, next) => {
  try {
    const routes = await Route.find({ schoolId: req.user.schoolId });
    res.status(200).json({ message: 'Routes retrieved successfully', data: routes });
  } catch (error) {
    next(error);
  }
};

// Get a Single Route (GET /api/routes/:id)
const getRoute = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new APIError('Invalid route ID format', 400);
    }
    const route = await Route.findOne({ _id: id, schoolId: req.user.schoolId });
    if (!route) {
      throw new APIError('Route not found or you do not have access', 404);
    }
    res.status(200).json({ message: 'Route retrieved successfully', data: route });
  } catch (error) {
    next(error);
  }
};

// Update a Route (PUT /api/routes/:id)
const updateRoute = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, pickupPoints, distance, feeAmount, frequency, status } = req.body;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new APIError('Invalid route ID format', 400);
    }
    const route = await Route.findOneAndUpdate(
      { _id: id, schoolId: req.user.schoolId },
      { name, pickupPoints, distance, feeAmount, frequency, status },
      { new: true, runValidators: true }
    );
    if (!route) {
      throw new APIError('Route not found or you do not have access', 404);
    }
    res.status(200).json({ message: 'Route updated successfully', data: route });
  } catch (error) {
    next(error);
  }
};

// Delete a Route (DELETE /api/routes/:id)
const deleteRoute = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new APIError('Invalid route ID format', 400);
    }
    const students = await Student.find({ routeId: id, schoolId: req.user.schoolId });
    if (students.length > 0) {
      throw new APIError('Cannot delete route: Students are assigned to it', 400);
    }
    const route = await Route.findOneAndDelete({ _id: id, schoolId: req.user.schoolId });
    if (!route) {
      throw new APIError('Route not found or you do not have access', 404);
    }
    res.status(200).json({ message: 'Route deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// Assign Route to Student (POST /api/routes/assign/:studentId)
const assignRoute = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const { routeId } = req.body;
    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      throw new APIError('Invalid student ID format', 400);
    }
    const student = await Student.findOne({ _id: studentId, schoolId: req.user.schoolId });
    if (!student) {
      throw new APIError('Student not found or you do not have access', 404);
    }
    if (routeId) {
      if (!mongoose.Types.ObjectId.isValid(routeId)) {
        throw new APIError('Invalid route ID format', 400);
      }
      const route = await Route.findOne({ _id: routeId, schoolId: req.user.schoolId });
      if (!route) {
        throw new APIError('Route not found or you do not have access', 404);
      }
    }
    student.routeId = routeId || null;
    await student.save();
    res.status(200).json({ message: 'Route assigned to student successfully', data: student });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createRoute,
  getRoutes,
  getRoute,
  updateRoute,
  deleteRoute,
  assignRoute
};