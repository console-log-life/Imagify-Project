import userModel from "../model/usermodel.js";
import bcrypt from 'bcrypt'
import Razorpay from 'razorpay'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { transactionModel } from "../model/transactionModel.js";

const registerUser = async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ success: false, message: "Missing Details" });
        }

        // Check if user already exists
        const existingUser = await userModel.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ success: false, message: "User already exists" });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const userData = { name, email, password: hashedPassword };
        const newUser = new userModel(userData);
        const user = await newUser.save();

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);

        res.status(201).json({ success: true, token, user: { _id: user._id, name: user.name, email: user.email, creditBalance: user.creditBalance } });
    } catch (error) {
        console.error("Register error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const LoginUser = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ success: false, message: "Email and password are required" });
        }

        const user = await userModel.findOne({ email });
        if (!user) {
            return res.status(404).json({ success: false, message: "User doesn't exist" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: "Invalid credentials" });
        }

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
        res.json({ 
            success: true, 
            token, 
            user: { 
                _id: user._id,
                name: user.name,
                email: user.email,
                creditBalance: user.creditBalance 
            } 
        });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const userCredits = async (req, res) => {
    try {
        const userId = req.user.id; // This should come from auth middleware
        const user = await userModel.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        res.json({ 
            success: true, 
            credits: user.creditBalance, 
            user: { 
                _id: user._id,
                name: user.name,
                email: user.email,
                creditBalance: user.creditBalance 
            } 
        });
    } catch (error) {
        console.error("Credits check error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Initialize Razorpay
const razorInstance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

const paymentRazorpay = async (req, res) => {
    try {
        const userId = req.user.id; // This should come from auth middleware
        const { planId } = req.body;

        if (!userId || !planId) {
            return res.status(400).json({ success: false, message: 'Missing Details' });
        }

        const userData = await userModel.findById(userId);
        if (!userData) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        let credits, plan, amount;
        switch (planId) {
            case 'Basic':
                plan = 'Basic'; credits = 100; amount = 10;
                break;
            case 'Advanced':
                plan = 'Advanced'; credits = 500; amount = 50;
                break;
            case 'Business':
                plan = 'Business'; credits = 5000; amount = 250;
                break;
            default:
                return res.status(400).json({ success: false, message: 'Invalid plan selected' });
        }

        const transactionData = {
            userId,
            credits,
            plan,
            amount,
            payment: false
        };

        const newTransaction = await transactionModel.create(transactionData);

        const options = {
            amount: amount * 100, // Amount in paise
            currency: 'INR',
            receipt: newTransaction._id.toString()
        };

        const order = await razorInstance.orders.create(options);
        res.json({ success: true, order });

    } catch (error) {
        console.error("Payment creation error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

const verifyRazorpay = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
        
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ success: false, message: 'Missing payment details' });
        }

        // Verify the payment signature to make sure the callback wasn't forged
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest('hex');

        if (expectedSignature !== razorpay_signature) {
            return res.status(400).json({ success: false, message: 'Invalid payment signature' });
        }

        const orderInfo = await razorInstance.orders.fetch(razorpay_order_id);
        if (!orderInfo) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (orderInfo.status === 'paid') {
            const transactionData = await transactionModel.findById(orderInfo.receipt);
            if (!transactionData) {
                return res.status(404).json({ success: false, message: 'Transaction not found' });
            }

            if (transactionData.payment) {
                return res.status(400).json({ success: false, message: 'Payment already processed' });
            }

            const userData = await userModel.findById(transactionData.userId);
            if (!userData) {
                return res.status(404).json({ success: false, message: 'User not found' });
            }

            const creditBalance = userData.creditBalance + transactionData.credits;

            await userModel.findByIdAndUpdate(userData._id, { creditBalance });
            await transactionModel.findByIdAndUpdate(transactionData._id, { payment: true });

            res.json({ success: true, message: 'Credits Added Successfully' });
        } else {
            res.status(400).json({ success: false, message: 'Payment verification failed' });
        }
    } catch (error) {
        console.error("Payment verification error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export { registerUser, LoginUser, userCredits, paymentRazorpay, verifyRazorpay };
