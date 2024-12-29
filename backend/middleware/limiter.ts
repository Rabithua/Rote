import { RateLimiterMemory } from "rate-limiter-flexible";

// Configure the rate limiter
const limiter = new RateLimiterMemory({
  points: 100, // Maximum number of requests allowed within the duration
  duration: 1, // Duration in seconds
});

// Create rate limiting middleware function with enhanced features
export const rateLimiterMiddleware = (req: any, res: any, next: any) => {
  const key = req.user ? req.user.id : req.ip; // Use user ID if available, otherwise use IP address

  limiter
    .consume(key)
    .then(() => {
      console.log(`Request allowed for key: ${key}`); // Log successful requests
      next();
    })
    .catch((rejRes) => {
      const retrySecs = Math.round(rejRes.msBeforeNext / 1000) || 1;
      res.set("Retry-After", String(retrySecs)); // Set Retry-After header
      console.log("Too Many Requests", rejRes);
      res
        .status(429)
        .send(`Too Many Requests. Please try again in ${retrySecs} seconds.`); // Custom error message
    });
};
