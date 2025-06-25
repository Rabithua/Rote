import { config } from "dotenv";
// 加载环境变量
import dotenv from 'dotenv';
dotenv.config();

import { generateAccessToken, verifyAccessToken, generateRefreshToken, verifyRefreshToken } from "../utils/jwt";

// 加载环境变量
config();

async function testJWT() {
  console.log("🧪 开始 JWT 功能测试...");
  
  // 检查环境变量
  console.log("JWT_SECRET:", process.env.JWT_SECRET ? "已设置" : "未设置");
  console.log("JWT_REFRESH_SECRET:", process.env.JWT_REFRESH_SECRET ? "已设置" : "未设置");
  console.log("JWT_SECRET length:", process.env.JWT_SECRET?.length);
  
  if (!process.env.JWT_SECRET) {
    console.log("❌ JWT_SECRET 环境变量未设置");
    return;
  }
  
  try {
    // 测试 Access Token
    console.log("1. 测试 Access Token 生成和验证...");
    const accessToken = await generateAccessToken({
      userId: "test-user-123",
      username: "testuser",
    });
    console.log("✅ Access Token 生成成功:", accessToken.substring(0, 50) + "...");

    const accessPayload = await verifyAccessToken(accessToken);
    console.log("✅ Access Token 验证成功:", accessPayload);

    // 测试 Refresh Token
    console.log("\n2. 测试 Refresh Token 生成和验证...");
    const refreshToken = await generateRefreshToken({
      userId: "test-user-123",
      username: "testuser",
    });
    console.log("✅ Refresh Token 生成成功:", refreshToken.substring(0, 50) + "...");

    const refreshPayload = await verifyRefreshToken(refreshToken);
    console.log("✅ Refresh Token 验证成功:", refreshPayload);

    console.log("\n🎉 所有 JWT 测试通过!");
    
  } catch (error) {
    console.error("❌ JWT 测试失败:", error);
    process.exit(1);
  }
}

testJWT();
