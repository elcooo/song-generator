import rateLimit from "express-rate-limit";

const createLimiter = (max, windowMs = 15 * 60 * 1000) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
  });

export const authLimiter = createLimiter(10);
export const wizardLimiter = createLimiter(12);
export const generateLimiter = createLimiter(8);
export const trialLimiter = createLimiter(6);
