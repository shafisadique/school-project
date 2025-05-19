const validateSchoolAccess = (model) => async (req, res, next) => {
    const record = await model.findOne({ _id: req.params.id, schoolId: req.user.schoolId });
    if (!record) return res.status(403).json({ error: 'Access denied' });
    next();
  };

  module.exports = validateSchoolAccess