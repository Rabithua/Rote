import { RateLimiterMemory } from "rate-limiter-flexible";

// 配置限流器
const limiter = new RateLimiterMemory({
    points: 10, // 在持续时间内允许的最大请求数
    duration: 1, // 持续时间，单位为秒
});

// 创建限流中间件函数
export const rateLimiterMiddleware = (req: any, res: any, next: any) => {
    limiter.consume(req.ip) // 基于IP地址跟踪请求
        .then(() => {
            next(); // 请求在限流范围内，继续执行下一个中间件
        })
        .catch(() => {
            res.status(429).send('请求过多'); // 请求超出限流范围，返回429状态码和错误消息
        });
};
