import express from "express";

export const errorHandler: express.ErrorRequestHandler = (
  err,
  _req,
  res,
  _next
) => {
  console.error("API Error:", err.message);

  if (err.code === "P2002") {
    return res.status(400).json({
      code: 1,
      msg: "Data already exists",
      data: null,
    });
  }

  if (err.name === "ValidationError") {
    return res.status(400).json({
      code: 1,
      msg: err.message,
      data: null,
    });
  }

  if (err.name === "AuthenticationError") {
    return res.status(401).json({
      code: 1,
      msg: err.message,
      data: null,
    });
  }

  if (err.name === "AuthorizationError") {
    return res.status(403).json({
      code: 1,
      msg: err.message,
      data: null,
    });
  }

  res.status(500).json({
    code: 1,
    msg: err.message || "Internal server error",
    data: null,
  });
};

export const asyncHandler = (
  fn: express.RequestHandler
): express.RequestHandler => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
