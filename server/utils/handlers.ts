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

  // Prisma unique constraint violation (check both direct error and nested error)
  if ((err as any).code === 'P2002' || (err as any).originalError?.code === 'P2002') {
    return c.json(
      {
        code: 1,
        message: 'Username or email already exists',
        data: null,
      },
      409
    );
  }

  // Validation errors
  if (err.name === 'ValidationError' || err.name === 'ZodError') {
    return c.json(
      {
        code: 1,
        message: err.message,
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
