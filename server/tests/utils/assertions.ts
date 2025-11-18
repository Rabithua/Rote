/**
 * 测试断言工具
 */

export class AssertionError extends Error {
  constructor(message: string) {
    super(`Assertion failed: ${message}`);
    this.name = 'AssertionError';
  }
}

export class TestAssertions {
  /**
   * 断言条件为真
   */
  static assert(condition: boolean, message: string): void {
    if (!condition) {
      throw new AssertionError(message);
    }
  }

  /**
   * 断言状态码
   */
  static assertStatus(status: number, expected: number | number[], context: string): void {
    const expectedArray = Array.isArray(expected) ? expected : [expected];
    if (!expectedArray.includes(status)) {
      throw new AssertionError(
        `Expected status ${expectedArray.join(' or ')}, got ${status} in ${context}`
      );
    }
  }

  /**
   * 断言响应数据结构
   */
  static assertResponse(data: any, context: string): void {
    if (!data || typeof data !== 'object') {
      throw new AssertionError(
        `Invalid response data in ${context}: expected object, got ${typeof data}`
      );
    }
    if (data.success === false && !data.error) {
      throw new AssertionError(`Response indicates failure but no error message in ${context}`);
    }
  }

  /**
   * 断言响应成功
   */
  static assertSuccess(data: any, context: string): void {
    this.assertResponse(data, context);
    if (data.success === false) {
      throw new AssertionError(
        `Expected success response in ${context}, but got error: ${data.error || data.message}`
      );
    }
  }

  /**
   * 断言值相等
   */
  static assertEquals<T>(actual: T, expected: T, message?: string): void {
    if (actual !== expected) {
      throw new AssertionError(message || `Expected ${expected}, but got ${actual}`);
    }
  }

  /**
   * 断言值不相等
   */
  static assertNotEquals<T>(actual: T, expected: T, message?: string): void {
    if (actual === expected) {
      throw new AssertionError(
        message || `Expected values to be different, but both are ${actual}`
      );
    }
  }

  /**
   * 断言值不为空
   */
  static assertNotNull<T>(value: T | null | undefined, message?: string): asserts value is T {
    if (value === null || value === undefined) {
      throw new AssertionError(message || 'Expected value to be not null/undefined');
    }
  }

  /**
   * 断言值为空
   */
  static assertNull(value: any, message?: string): void {
    if (value !== null && value !== undefined) {
      throw new AssertionError(message || `Expected value to be null/undefined, but got ${value}`);
    }
  }

  /**
   * 断言数组长度
   */
  static assertArrayLength<T>(array: T[], expectedLength: number, message?: string): void {
    if (array.length !== expectedLength) {
      throw new AssertionError(
        message || `Expected array length ${expectedLength}, but got ${array.length}`
      );
    }
  }

  /**
   * 断言字符串包含
   */
  static assertContains(haystack: string, needle: string, message?: string): void {
    if (!haystack.includes(needle)) {
      throw new AssertionError(message || `Expected string to contain "${needle}", but it doesn't`);
    }
  }
}
