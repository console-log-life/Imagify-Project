import './loadEnv.js';
import express from 'express';
import cors from 'cors';
import userModel from './model/usermodel.js';
import connectDB from './config/mongodb.js';
import userRouter from './Routes/userRouter.js';
import imageRouter from './Routes/imageRoutes.js';

const PORT = process.env.PORT || 4000;
const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Connect to MongoDB and start the server only if DB connection is successful
connectDB()
  .then(() => {
    console.log("Connected to MongoDB");

    // Routes
    app.use('/api/user', userRouter);
    app.use('/api/image', imageRouter);
    app.get('/', (req, res) => res.send('API Working good'));

    // Start Server
    app.listen(PORT, () =>
      console.log(`Server is running on PORT ${PORT}`)
    );
  })
  .catch((err) => {
    console.error("Database connection failed", err);
  });