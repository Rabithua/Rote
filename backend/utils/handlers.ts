import express from 'express';

export const errorHandler: express.ErrorRequestHandler = (err, _req, res, _next) => {
  console.error('API Error:', err.message);

  // Prisma unique constraint violation
  if (err.code === 'P2002') {
    return res.status(409).json({
      code: 1,
      message: 'Data already exists',
      data: null,
    });
  }

  // Validation errors
  if (err.name === 'ValidationError' || err.name === 'ZodError') {
    return res.status(400).json({
      code: 1,
      message: err.message,
      data: null,
    });
  }

  // Authentication errors
  if (err.name === 'AuthenticationError' || err.message.includes('Authentication')) {
    return res.status(401).json({
      code: 1,
      message: err.message,
      data: null,
    });
  }

  // Authorization errors
  if (err.name === 'AuthorizationError' || err.message.includes('Access denied')) {
    return res.status(403).json({
      code: 1,
      message: err.message,
      data: null,
    });
  }

  // Not found errors
  if (err.message.includes('not found') || err.message.includes('Not found')) {
    return res.status(404).json({
      code: 1,
      message: err.message,
      data: null,
    });
  }

  // Bad request errors (includes "required" errors)
  if (err.message.includes('required') || err.message.includes('Invalid')) {
    return res.status(400).json({
      code: 1,
      message: err.message,
      data: null,
    });
  }

  // Default server error
  res.status(500).json({
    code: 1,
    message: err.message || 'Internal server error',
    data: null,
  });
};

export const asyncHandler = (fn: express.RequestHandler): express.RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
