// 加载环境变量
import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

// 密码验证函数（与 passport.ts 中的逻辑一致）
function verifyPassword(password: string, salt: Buffer, hash: Buffer): Promise<boolean> {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, 310000, 32, 'sha256', (err, hashedPassword) => {
      if (err) {
        reject(err);
        return;
      }
      const isValid = crypto.timingSafeEqual(hash, hashedPassword);
      resolve(isValid);
    });
  });
}

async function checkUser() {
  try {
    console.log('🔍 检查数据库中的用户信息...');
    
    // 查找用户
    const user = await prisma.user.findFirst({
      where: {
        username: 'rabithua'
      }
    });
    
    if (!user) {
      console.log('❌ 用户 rabithua 不存在');
      
      // 列出所有用户
      const allUsers = await prisma.user.findMany({
        select: {
          username: true,
          email: true,
          id: true
        }
      });
      
      console.log('📋 数据库中的所有用户：');
      allUsers.forEach(u => {
        console.log(`- ${u.username} (${u.email})`);
      });
      
    } else {
      console.log('✅ 找到用户:', user.username);
      console.log('- ID:', user.id);
      console.log('- Email:', user.email);
      console.log('- 密码 Hash:', user.passwordhash ? '存在' : '不存在');
      console.log('- Salt:', user.salt ? '存在' : '不存在');
      
      // 测试密码
      if (user.passwordhash && user.salt) {
        try {
          const isValidPassword = await verifyPassword('password', Buffer.from(user.salt), Buffer.from(user.passwordhash));
          console.log('- 密码 "password" 验证:', isValidPassword ? '✅ 正确' : '❌ 错误');
          
          // 如果密码不正确，尝试其他常见密码
          if (!isValidPassword) {
            const commonPasswords = ['123456', 'admin', 'rabithua', 'test'];
            for (const pwd of commonPasswords) {
              try {
                const isValid = await verifyPassword(pwd, Buffer.from(user.salt), Buffer.from(user.passwordhash));
                if (isValid) {
                  console.log(`- ✅ 正确密码是: ${pwd}`);
                  break;
                }
              } catch (err) {
                console.log(`- 测试密码 "${pwd}" 时出错:`, err);
              }
            }
          }
        } catch (error) {
          console.log('- 密码验证出错:', error);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ 检查用户失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUser();
