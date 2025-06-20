import { SessionData, Store } from 'express-session';
import prisma from './prisma';

/**
 * 自定义的基于Prisma的会话存储类
 * 替代 @quixo3/prisma-session-store 实现相同功能
 */
export class CustomPrismaSessionStore extends Store {
  private checkPeriod: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(options: { checkPeriod?: number } = {}) {
    super();
    this.checkPeriod = options.checkPeriod || 2 * 60 * 1000; // 默认2分钟
    this.startCleanup();
  }

  /**
   * 获取会话数据
   */
  get(sid: string, callback: (err?: any, session?: SessionData | null) => void): void {
    prisma.session
      .findUnique({
        where: { sid },
      })
      .then((session) => {
        if (!session) {
          return callback(null, null);
        }

        // 检查是否过期
        if (session.expiresAt && new Date() > session.expiresAt) {
          // 会话已过期，删除并返回null
          this.destroy(sid, () => {});
          return callback(null, null);
        }

        try {
          const sessionData = JSON.parse(session.data);
          callback(null, sessionData);
        } catch (error) {
          callback(error);
        }
      })
      .catch((error) => {
        callback(error);
      });
  }

  /**
   * 设置会话数据
   */
  set(sid: string, session: SessionData, callback?: (err?: any) => void): void {
    const data = JSON.stringify(session);
    const expiresAt = session.cookie?.expires
      ? new Date(session.cookie.expires)
      : new Date(Date.now() + 31 * 24 * 60 * 60 * 1000); // 默认31天

    prisma.session
      .upsert({
        where: { sid },
        update: {
          data,
          expiresAt,
        },
        create: {
          id: sid, // 使用sid作为id
          sid,
          data,
          expiresAt,
        },
      })
      .then(() => {
        callback?.();
      })
      .catch((error) => {
        callback?.(error);
      });
  }

  /**
   * 销毁会话
   */
  destroy(sid: string, callback?: (err?: any) => void): void {
    prisma.session
      .delete({
        where: { sid },
      })
      .then(() => {
        callback?.();
      })
      .catch((error) => {
        // 如果记录不存在，也认为删除成功
        if (error.code === 'P2025') {
          callback?.();
        } else {
          callback?.(error);
        }
      });
  }

  /**
   * 触摸会话（更新过期时间）
   */
  touch(sid: string, session: SessionData, callback?: (err?: any) => void): void {
    const expiresAt = session.cookie?.expires
      ? new Date(session.cookie.expires)
      : new Date(Date.now() + 31 * 24 * 60 * 60 * 1000);

    prisma.session
      .update({
        where: { sid },
        data: { expiresAt },
      })
      .then(() => {
        callback?.();
      })
      .catch((error) => {
        callback?.(error);
      });
  }

  /**
   * 获取所有会话
   */
  all(callback: (err?: any, obj?: { [sid: string]: SessionData } | null) => void): void {
    prisma.session
      .findMany({
        where: {
          expiresAt: {
            gt: new Date(),
          },
        },
      })
      .then((sessions) => {
        const result: { [sid: string]: SessionData } = {};

        for (const session of sessions) {
          try {
            result[session.sid] = JSON.parse(session.data);
          } catch (error) {
            // 忽略无法解析的会话数据
            console.warn(`无法解析会话数据 ${session.sid}:`, error);
          }
        }

        callback(null, result);
      })
      .catch((error) => {
        callback(error);
      });
  }

  /**
   * 获取会话数量
   */
  length(callback: (err?: any, length?: number) => void): void {
    prisma.session
      .count({
        where: {
          expiresAt: {
            gt: new Date(),
          },
        },
      })
      .then((count) => {
        callback(null, count);
      })
      .catch((error) => {
        callback(error);
      });
  }

  /**
   * 清空所有会话
   */
  clear(callback?: (err?: any) => void): void {
    prisma.session
      .deleteMany({})
      .then(() => {
        callback?.();
      })
      .catch((error) => {
        callback?.(error);
      });
  }

  /**
   * 开始定期清理过期会话
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, this.checkPeriod);
  }

  /**
   * 停止清理定时器
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * 清理过期的会话
   */
  private async cleanupExpiredSessions(): Promise<void> {
    try {
      const result = await prisma.session.deleteMany({
        where: {
          expiresAt: {
            lte: new Date(),
          },
        },
      });

      if (result.count > 0) {
        console.log(`清理了 ${result.count} 个过期会话`);
      }
    } catch (error) {
      console.error('清理过期会话时出错:', error);
    }
  }
}
