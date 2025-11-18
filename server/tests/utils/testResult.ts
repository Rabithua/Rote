/**
 * 测试结果管理
 */

export interface TestResult {
  name: string;
  success: boolean;
  message: string;
  duration: number;
  error?: any;
  data?: any;
}

export class TestResultManager {
  private results: TestResult[] = [];
  private startTime: number = 0;

  constructor() {
    this.startTime = Date.now();
  }

  /**
   * 记录测试结果
   */
  recordResult(
    name: string,
    success: boolean,
    message: string,
    duration: number,
    error?: any,
    data?: any
  ): void {
    this.results.push({ name, success, message, duration, error, data });
    const status = success ? '✅' : '❌';
    const durationStr = `${duration}ms`;
    console.log(`${status} ${name} (${durationStr}): ${message}`);
    if (error) {
      console.log(`   Error: ${error.message || JSON.stringify(error)}`);
    }
  }

  /**
   * 显示测试摘要
   */
  showSummary(): void {
    const totalDuration = Date.now() - this.startTime;
    const passed = this.results.filter((r) => r.success).length;
    const failed = this.results.filter((r) => !r.success).length;
    const total = this.results.length;

    console.log('\n' + '='.repeat(80));
    console.log('📊 测试结果摘要');
    console.log('='.repeat(80));
    console.log(`总测试数: ${total}`);
    console.log(`通过: ${passed} ✅`);
    console.log(`失败: ${failed} ${failed > 0 ? '❌' : ''}`);
    console.log(`总耗时: ${totalDuration}ms`);
    if (total > 0) {
      console.log(`平均耗时: ${Math.round(totalDuration / total)}ms/测试`);
    }
    console.log('='.repeat(80));

    if (failed > 0) {
      console.log('\n失败的测试:');
      this.results
        .filter((r) => !r.success)
        .forEach((r) => {
          console.log(`  ❌ ${r.name}: ${r.message}`);
          if (r.error) {
            console.log(`     错误: ${r.error.message || JSON.stringify(r.error)}`);
          }
        });
    }

    console.log('\n详细测试结果:');
    this.results.forEach((r) => {
      const status = r.success ? '✅' : '❌';
      console.log(`  ${status} ${r.name} (${r.duration}ms): ${r.message}`);
    });
  }

  /**
   * 获取所有结果
   */
  getResults(): TestResult[] {
    return this.results;
  }

  /**
   * 检查是否所有测试都通过
   */
  allPassed(): boolean {
    return this.results.every((r) => r.success);
  }

  /**
   * 获取统计信息
   */
  getStats() {
    const passed = this.results.filter((r) => r.success).length;
    const failed = this.results.filter((r) => !r.success).length;
    const totalDuration = Date.now() - this.startTime;

    return {
      total: this.results.length,
      passed,
      failed,
      totalDuration,
      averageDuration:
        this.results.length > 0 ? Math.round(totalDuration / this.results.length) : 0,
    };
  }
}
