// 加载环境变量
import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

// 生成密码 hash 的函数（与 passport.ts 中的逻辑一致）
function generatePasswordHash(password: string): Promise<{ hash: Buffer, salt: Buffer }> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(32);
    crypto.pbkdf2(password, salt, 310000, 32, 'sha256', (err, hash) => {
      if (err) {
        reject(err);
        return;
      }
      resolve({ hash, salt });
    });
  });
}

async function updateUserPassword() {
  try {
    console.log('🔧 更新用户密码...');
    
    const { hash, salt } = await generatePasswordHash('password');
    
    const updatedUser = await prisma.user.update({
      where: {
        username: 'rabithua'
      },
      data: {
        passwordhash: hash,
        salt: salt
      }
    });
    
    console.log('✅ 用户密码更新成功!');
    console.log('- 用户名:', updatedUser.username);
    console.log('- 新密码: password');
    
  } catch (error) {
    console.error('❌ 更新密码失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateUserPassword();
