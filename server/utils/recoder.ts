import { NextFunction, Request, Response } from 'express';
import moment from 'moment';

// Request middleware, record IP and time
export const recorderIpAndTime = function (req: Request, res: Response, next: NextFunction) {
  // Skip logging for specific endpoints
  const ignoredPaths = ['/', '/v1/api/status'];
  if (ignoredPaths.includes(req.path)) {
    next();
    return;
  }

  const ipAddress = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.ip;

  const logMessage = `[${moment().format(
    'YYYY/MM/DD HH:mm:ss'
  )}] IP: ${ipAddress} | Method: ${req.method} | Path: ${req.path}`;
  console.log(logMessage);
  next();
};
