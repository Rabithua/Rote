import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/jwt";
import { oneUser } from "../utils/dbMethods";

export async function authenticateJWT(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res
      .status(401)
      .json({ code: 401, message: "Access token required" });
  }

  try {
    const payload = await verifyAccessToken(token);
    const user = await oneUser(payload.userId);

    if (!user) {
      return res.status(401).json({ code: 401, message: "User not found" });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ code: 401, message: "Invalid token" });
  }
}

// 可选JWT认证中间件，允许访客和用户双重访问
export async function optionalJWT(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];  // 如果没有token，直接继续（访客模式）
  if (!token) {
    req.user = undefined;
    return next();
  }

  try {
    const payload = await verifyAccessToken(token);
    const user = await oneUser(payload.userId);

    if (user) {
      req.user = user;
    } else {
      req.user = undefined;
    }
    
    next();
  } catch (error) {
    // Token无效时，仍然允许继续（作为访客）
    req.user = undefined;
    next();
  }
}
