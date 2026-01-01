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
    errorMessage.includes('duplicate key') ||
    errorMessage.includes('Username already exists') ||
    errorMessage.includes('Email already exists')
  ) {
    // 根据约束名称或字段信息判断具体的唯一约束错误
    let message = 'Resource already exists';

    // 检查是否是订阅 endpoint 的唯一约束
    // PostgreSQL 错误消息可能包含: user_sw_subscriptions_endpoint_unique 或 user_sw_subscriptions.endpoint
    if (errorMessage.includes('user_sw_subscriptions') && errorMessage.includes('endpoint')) {
      message = 'Subscription endpoint already exists';
    }
    // 检查是否是用户名的唯一约束（包括手动检查的情况）
    else if (
      errorMessage.includes('Username already exists') ||
      (errorMessage.includes('users') &&
        errorMessage.includes('username') &&
        !errorMessage.includes('email'))
    ) {
      message = 'Username already exists';
    }
    // 检查是否是邮箱的唯一约束（包括手动检查的情况）
    else if (
      errorMessage.includes('Email already exists') ||
      (errorMessage.includes('users') &&
        errorMessage.includes('email') &&
        !errorMessage.includes('username'))
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
    const anyErr = err as any;
    let message = err.message;

    // 优先从 Zod 的 issues 中提取错误消息（标准 Zod 错误格式）
    if (Array.isArray(anyErr.issues) && anyErr.issues.length > 0) {
      // 提取所有错误消息，合并显示（最多显示前 3 个，避免消息过长）
      const errorMessages = anyErr.issues
        .slice(0, 3)
        .map((issue: any) => issue?.message)
        .filter((msg: any): msg is string => typeof msg === 'string' && msg.length > 0);

      if (errorMessages.length > 0) {
        // 如果有多个错误，用分号分隔；如果只有一个，直接使用
        message = errorMessages.length === 1 ? errorMessages[0] : errorMessages.join('; ');
      }
    } else {
      // 兼容部分场景：message 里直接是 JSON 字符串（如 [ { origin, code, message } ]）
      try {
        const parsed = JSON.parse(message);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // 提取所有错误消息
          const errorMessages = parsed
            .slice(0, 3)
            .map((item: any) => item?.message)
            .filter((msg: any): msg is string => typeof msg === 'string' && msg.length > 0);

          if (errorMessages.length > 0) {
            message = errorMessages.length === 1 ? errorMessages[0] : errorMessages.join('; ');
          } else if (parsed[0]?.message) {
            // 降级：如果提取失败，至少尝试第一个
            message = parsed[0].message;
          }
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

  // Database errors - 特殊处理数据库错误
  if (err.name === 'DatabaseError') {
    const originalError = (err as any).originalError;
    const errorCode = originalError?.code;
    const errorMessage = originalError?.message || err.message;

    // PostgreSQL 错误代码处理
    // 42P01 = undefined_table (表不存在)
    // 42703 = undefined_column (列不存在)
    // 28P01 = invalid_password (密码认证失败)
    // 3D000 = invalid_catalog_name (数据库不存在)
    // 08006 = connection_failure (连接失败)
    if (errorCode === '42P01' || errorMessage.includes('does not exist')) {
      console.error(
        '❌ Database table or column does not exist. Please check if migrations were applied correctly.'
      );
      return c.json(
        {
          code: 1,
          message: 'Database schema error. Please contact administrator.',
          data: null,
        },
        500
      );
    }

    if (
      errorCode === '28P01' ||
      errorCode === '08006' ||
      errorMessage.includes('password') ||
      errorMessage.includes('connection')
    ) {
      console.error('❌ Database connection error. Please check database credentials.');
      return c.json(
        {
          code: 1,
          message: 'Database connection error. Please contact administrator.',
          data: null,
        },
        500
      );
    }

    // 其他数据库错误
    return c.json(
      {
        code: 1,
        message: 'Database error occurred. Please contact administrator.',
        data: null,
      },
      500
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
