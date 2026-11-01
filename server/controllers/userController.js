import userModel from "../model/usermodel.js";
import bcrypt from 'bcrypt'
import Razorpay from 'razorpay'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { transactionModel } from "../model/transactionModel.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;
// Case-insensitive match, so accounts created before emails were lower-cased still log in.
const EMAIL_COLLATION = { locale: 'en', strength: 2 };

// Credit plans, priced in INR. The server decides the price; the client only sends a plan id.
export const PLANS = {
    Basic: { credits: 100, amount: 10 },
    Advanced: { credits: 500, amount: 50 },
    Business: { credits: 5000, amount: 250 },
};

const signToken = (userId) =>
    jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

const publicUser = (user) => ({
    _id: user._id,
    name: user.name,
    email: user.email,
    creditBalance: user.creditBalance,
});

const registerUser = async (req, res) => {
    try {
        const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
        const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
        const password = typeof req.body.password === 'string' ? req.body.password : '';

        if (!name || !email || !password) {
            return res.status(400).json({ success: false, message: "Missing Details" });
        }
        if (!EMAIL_PATTERN.test(email)) {
            return res.status(400).json({ success: false, message: "Please enter a valid email address" });
        }
        if (password.length < MIN_PASSWORD_LENGTH) {
            return res.status(400).json({ success: false, message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long` });
        }

        const existingUser = await userModel.findOne({ email }).collation(EMAIL_COLLATION);
        if (existingUser) {
            return res.status(400).json({ success: false, message: "User already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await userModel.create({ name, email, password: hashedPassword });

        res.status(201).json({ success: true, token: signToken(user._id), user: publicUser(user) });
    } catch (error) {
        // Two sign-ups racing on the same email hit the unique index.
        if (error?.code === 11000) {
            return res.status(400).json({ success: false, message: "User already exists" });
        }
        console.error("Register error:", error);
        res.status(500).json({ success: false, message: "Could not create account" });
    }
};

const LoginUser = async (req, res) => {
    try {
        const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
        const password = typeof req.body.password === 'string' ? req.body.password : '';
        if (!email || !password) {
            return res.status(400).json({ success: false, message: "Email and password are required" });
        }

        const user = await userModel.findOne({ email }).collation(EMAIL_COLLATION);
        // Same reply for an unknown email and a wrong password, so the API does not
        // reveal which emails have accounts.
        const isMatch = user ? await bcrypt.compare(password, user.password) : false;
        if (!isMatch) {
            return res.status(401).json({ success: false, message: "Invalid email or password" });
        }

        res.json({ success: true, token: signToken(user._id), user: publicUser(user) });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ success: false, message: "Could not log in" });
    }
};

const userCredits = async (req, res) => {
    try {
        const user = await userModel.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        res.json({ success: true, credits: user.creditBalance, user: publicUser(user) });
    } catch (error) {
        console.error("Credits check error:", error);
        res.status(500).json({ success: false, message: "Could not load credits" });
    }
};

// Razorpay client, created on first use. Kept on an object so tests can replace it.
export const razorpayClient = {
    instance: null,
    get() {
        if (!this.instance) {
            this.instance = new Razorpay({
                key_id: process.env.RAZORPAY_KEY_ID,
                key_secret: process.env.RAZORPAY_KEY_SECRET
            });
        }
        return this.instance;
    }
};

const paymentRazorpay = async (req, res) => {
    try {
        const userId = req.user.id;
        const plan = PLANS[req.body.planId];
        if (!plan) {
            return res.status(400).json({ success: false, message: 'Invalid plan selected' });
        }

        const userData = await userModel.findById(userId);
        if (!userData) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const newTransaction = await transactionModel.create({
            userId,
            plan: req.body.planId,
            credits: plan.credits,
            amount: plan.amount,
            payment: false
        });

        const order = await razorpayClient.get().orders.create({
            amount: plan.amount * 100, // paise
            currency: 'INR',
            receipt: newTransaction._id.toString()
        });
        res.json({ success: true, order });
    } catch (error) {
        console.error("Payment creation error:", error);
        res.status(500).json({ success: false, message: 'Could not start payment' });
    }
};

const signaturesMatch = (expected, received) => {
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(String(received), 'utf8');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
};

const verifyRazorpay = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ success: false, message: 'Missing payment details' });
        }

        // Check the signature so a forged callback cannot add credits.
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest('hex');
        if (!signaturesMatch(expectedSignature, razorpay_signature)) {
            return res.status(400).json({ success: false, message: 'Invalid payment signature' });
        }

        const orderInfo = await razorpayClient.get().orders.fetch(razorpay_order_id);
        if (!orderInfo || orderInfo.status !== 'paid') {
            return res.status(400).json({ success: false, message: 'Payment verification failed' });
        }

        const transaction = await transactionModel.findById(orderInfo.receipt);
        if (!transaction) {
            return res.status(404).json({ success: false, message: 'Transaction not found' });
        }
        if (transaction.userId !== req.user.id) {
            return res.status(403).json({ success: false, message: 'This payment belongs to another account' });
        }

        // Mark the transaction paid atomically. Only the first request matches
        // payment: false, so a retried or duplicated callback cannot add credits twice.
        const claimed = await transactionModel.findOneAndUpdate(
            { _id: transaction._id, payment: false },
            { $set: { payment: true } },
            { new: true }
        );
        if (!claimed) {
            return res.status(400).json({ success: false, message: 'Payment already processed' });
        }

        await userModel.updateOne({ _id: claimed.userId }, { $inc: { creditBalance: claimed.credits } });
        res.json({ success: true, message: 'Credits Added Successfully' });
    } catch (error) {
        console.error("Payment verification error:", error);
        res.status(500).json({ success: false, message: 'Could not verify payment' });
    }
};

export { registerUser, LoginUser, userCredits, paymentRazorpay, verifyRazorpay };
