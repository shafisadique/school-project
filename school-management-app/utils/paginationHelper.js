const APIError = require('./apiError');

const paginate = async (model, query, reqQuery, populate = [], sort = {}) => {
  try {
    // Extract pagination parameters from the request query (default to 25 items per page)
    const { page = 1, limit = 25 } = reqQuery;

    // Parse and validate pagination parameters
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    if (isNaN(pageNum) || pageNum < 1) {
      throw new APIError('Page number must be a positive integer', 400);
    }
    if (isNaN(limitNum) || limitNum < 1) {
      throw new APIError('Limit must be a positive integer', 400);
    }

    // Calculate skip for pagination
    const skip = (pageNum - 1) * limitNum;

    // Fetch paginated data
    const queryBuilder = model.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limitNum);

    // Apply population if provided
    populate.forEach(pop => {
      queryBuilder.populate(pop);
    });

    const data = await queryBuilder.exec();

    // Get total count for pagination
    const total = await model.countDocuments(query);

    // Return paginated response
    return {
      data,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum)
    };
  } catch (error) {
    throw error; // Let the controller handle the error
  }
};

module.exports = { paginate };