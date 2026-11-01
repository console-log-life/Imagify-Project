import express from 'express';
import { registerUser, LoginUser, userCredits, paymentRazorpay, verifyRazorpay } from '../controllers/userController.js';
import userAuth from '../middlewares/auth.js';
import rateLimit from '../middlewares/rateLimit.js';

const userRouter = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many attempts. Please try again later.'
});

// Public routes
userRouter.post('/register', authLimiter, registerUser);
userRouter.post('/login', authLimiter, LoginUser);

// Protected routes - require authentication
userRouter.get('/credits', userAuth, userCredits);
userRouter.post('/pay-razor', userAuth, paymentRazorpay);
userRouter.post('/verify-razor', userAuth, verifyRazorpay);

export default userRouter;
