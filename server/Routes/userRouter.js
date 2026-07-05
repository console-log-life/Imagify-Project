import express from 'express';
import { registerUser, LoginUser, userCredits, paymentRazorpay, verifyRazorpay } from '../controllers/userController.js';
import userAuth from '../middlewares/auth.js';

const userRouter = express.Router();

// Public routes
userRouter.post('/register', registerUser);
userRouter.post('/login', LoginUser);

// Protected routes - require authentication
userRouter.get('/credits', userAuth, userCredits);
userRouter.post('/pay-razor', userAuth, paymentRazorpay);  // Changed to POST and fixed path
userRouter.post('/verify-razor', userAuth, verifyRazorpay);

export default userRouter;

//http://localhost:4000/api/user/register  ==>registerUser
//http://localhost:4000/api/user/login  ==>LoginUser