import { HonoContext } from '../types/hono';

export const errorHandler = async (err: Error, c: HonoContext) => {
  console.error('API Error:', err.message);
  // 只在开发环境下打印完整的错误堆栈
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    console.error('Error details:', err);
    // 如果是 DatabaseError，打印原始错误
    if ((err as any).originalError) {
      console.error('Original error:', (err as any).originalError);
    }
  }

  // PostgreSQL unique constraint violation (23505 = unique_violation)
  // Check for both direct error code and nested error
  const errorCode = (err as any).code || (err as any).originalError?.code;
  const errorMessage = err.message || (err as any).originalError?.message || '';

  if (
    errorCode === '23505' ||
    errorMessage.includes('unique constraint') ||
    errorMessage.includes('duplicate key')
  ) {
    // 根据约束名称或字段信息判断具体的唯一约束错误
    let message = 'Resource already exists';

    // 检查是否是订阅 endpoint 的唯一约束
    // PostgreSQL 错误消息可能包含: user_sw_subscriptions_endpoint_unique 或 user_sw_subscriptions.endpoint
    if (errorMessage.includes('user_sw_subscriptions') && errorMessage.includes('endpoint')) {
      message = 'Subscription endpoint already exists';
    }
    // 检查是否是用户名的唯一约束
    else if (
      errorMessage.includes('users') &&
      errorMessage.includes('username') &&
      !errorMessage.includes('email')
    ) {
      message = 'Username already exists';
    }
    // 检查是否是邮箱的唯一约束
    else if (
      errorMessage.includes('users') &&
      errorMessage.includes('email') &&
      !errorMessage.includes('username')
    ) {
      message = 'Email already exists';
    }
    // 检查是否是用户名或邮箱（通用用户注册错误）
    else if (errorMessage.includes('username') || errorMessage.includes('email')) {
      message = 'Username or email already exists';
    }

    return c.json(
      {
        code: 1,
        message,
        data: null,
      },
      409
    );
  }

  // Validation errors（包含 Zod 校验错误）
  if (err.name === 'ValidationError' || err.name === 'ZodError') {
    // 默认使用原始错误信息
    let message = err.message;

    const anyErr = err as any;

    // 优先从 Zod 的 issues 中提取更友好的 message
    if (Array.isArray(anyErr.issues) && anyErr.issues.length > 0) {
      const firstIssue = anyErr.issues[0];
      if (firstIssue?.message && typeof firstIssue.message === 'string') {
        message = firstIssue.message;
      }
    } else {
      // 兼容部分场景：message 里直接是 JSON 字符串（如 [ { origin, code, message } ]）
      try {
        const parsed = JSON.parse(message);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.message) {
          message = parsed[0].message;
        }
      } catch {
        // 解析失败则保留原始 message
      }
    }

    return c.json(
      {
        code: 1,
        message,
        data: null,
      },
      400
    );
  }

  // Authentication errors
  if (err.name === 'AuthenticationError' || err.message.includes('Authentication')) {
    return c.json(
      {
        code: 1,
        message: err.message,
        data: null,
      },
      401
    );
  }

  // Authorization errors
  if (err.name === 'AuthorizationError' || err.message.includes('Access denied')) {
    return c.json(
      {
        code: 1,
        message: err.message,
        data: null,
      },
      403
    );
  }

  // Not found errors
  if (err.message.includes('not found') || err.message.includes('Not found')) {
    return c.json(
      {
        code: 1,
        message: err.message,
        data: null,
      },
      404
    );
  }

  // Bad request errors (includes "required" errors)
  if (err.message.includes('required') || err.message.includes('Invalid')) {
    return c.json(
      {
        code: 1,
        message: err.message,
        data: null,
      },
      400
    );
  }

  // Default server error
  return c.json(
    {
      code: 1,
      message: err.message || 'Internal server error',
      data: null,
    },
    500
  );
};
