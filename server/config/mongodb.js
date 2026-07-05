import mongoose from 'mongoose';

const connectDB = async () => {
    try {
        if (!process.env.MONGODB_URI) {
            throw new Error('MONGODB_URI is not defined in environment variables');
        }

        // Clear any existing connections
        if (mongoose.connection.readyState !== 0) {
            await mongoose.connection.close();
        }

        mongoose.connection.on('connected', () => {
            console.log("Database Connected Successfully");
        });

        mongoose.connection.on('error', (err) => {
            console.error('MongoDB connection error:', err);
        });

        mongoose.connection.on('disconnected', () => {
            console.log('MongoDB disconnected');
        });

        // Configure mongoose options
        mongoose.set('strictQuery', false);
        
        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            family: 4 // Force IPv4
        });
        
        console.log(`MongoDB Connected: ${conn.connection.host}`);
        return conn;
    } catch (error) {
        console.error('Error connecting to MongoDB:', error.message);
        
        // Check if using MongoDB Atlas
        if (process.env.MONGODB_URI.includes('mongodb+srv')) {
            console.error('\nMongoDB Atlas Connection Error. Please check:');
            console.error('1. Your MongoDB Atlas cluster is running');
            console.error('2. Your IP address is whitelisted in MongoDB Atlas');
            console.error('3. Your username and password are correct');
            console.error('4. Your cluster URL is correct');
            console.error('\nTry using a local MongoDB connection for testing:');
            console.error('MONGODB_URI=mongodb://localhost:27017/imagify');
        } else {
            console.error('\nLocal MongoDB Connection Error. Please check:');
            console.error('1. MongoDB is installed and running locally');
            console.error('2. The port 27017 is available');
            console.error('3. No firewall is blocking the connection');
        }
        
        process.exit(1);
    }
}

export default connectDB;