import { RateLimiterMemory } from "rate-limiter-flexible";

// Configure the rate limiter
const limiter = new RateLimiterMemory({
  points: 10, // Maximum number of requests allowed within the duration
  duration: 1, // Duration in seconds
});

// Create rate limiting middleware function
export const rateLimiterMiddleware = (req: any, res: any, next: any) => {
  limiter
    .consume(req.ip) // Track requests based on IP address
    .then(() => {
      next(); // Request is within the rate limit, proceed to the next middleware
    })
    .catch(() => {
      res.status(429).send("Too Many Requests"); // Request exceeds the rate limit, return 429 status code and error message
    });
};
