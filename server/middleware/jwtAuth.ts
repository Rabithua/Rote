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
