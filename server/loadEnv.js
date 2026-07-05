import dotenv from 'dotenv';

dotenv.config({ override: true });

console.log('MONGODB_URI loaded:', process.env.MONGODB_URI ? 'yes' : 'NO (undefined)');
console.log('RAZORPAY_KEY_ID loaded:', process.env.RAZORPAY_KEY_ID ? 'yes' : 'NO (undefined)');