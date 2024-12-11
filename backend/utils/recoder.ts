import moment from "moment";
import { Request, Response, NextFunction } from "express";

// Request middleware, record IP and time
export const recorderIpAndTime = function (
  req: Request,
  res: Response,
  next: NextFunction
) {
  const ipAddress =
    req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || req.ip;

  const logMessage = `[${moment().format(
    "YYYY/MM/DD HH:mm:ss"
  )}] IP: ${ipAddress} | Method: ${req.method} | Path: ${req.path}`;
  console.log(logMessage);
  next();
};
