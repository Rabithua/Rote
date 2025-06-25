import { SignJWT, jwtVerify, type JWTPayload } from "jose";

interface CustomJWTPayload extends JWTPayload {
  userId: string;
  username: string;
}

// 正确处理 base64 编码的密钥
const secret = new TextEncoder().encode(
  Buffer.from(process.env.JWT_SECRET || "", "base64").toString() || "default-secret-key"
);
const refreshSecret = new TextEncoder().encode(
  Buffer.from(process.env.JWT_REFRESH_SECRET || "", "base64").toString() || "default-refresh-secret-key"
);

// 生成 Access Token (短期有效)
export async function generateAccessToken(
  payload: CustomJWTPayload
): Promise<string> {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer("rote-app")
    .setExpirationTime(process.env.JWT_ACCESS_EXPIRY || "15m")
    .sign(secret);
}

// 生成 Refresh Token (长期有效)
export async function generateRefreshToken(
  payload: CustomJWTPayload
): Promise<string> {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer("rote-app")
    .setExpirationTime(process.env.JWT_REFRESH_EXPIRY || "7d")
    .sign(refreshSecret);
}

// 验证 Access Token
export async function verifyAccessToken(
  token: string
): Promise<CustomJWTPayload> {
  const { payload } = await jwtVerify(token, secret, { issuer: "rote-app" });
  return payload as CustomJWTPayload;
}

// 验证 Refresh Token
export async function verifyRefreshToken(
  token: string
): Promise<CustomJWTPayload> {
  const { payload } = await jwtVerify(token, refreshSecret, {
    issuer: "rote-app",
  });
  return payload as CustomJWTPayload;
}

// 解析 Token 但不验证（用于获取过期 token 的信息）
export function decodeToken(token: string): CustomJWTPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8")
    );
    return payload as CustomJWTPayload;
  } catch {
    return null;
  }
}
