import './loadEnv.js';
import app from './app.js';
import connectDB from './config/mongodb.js';

const PORT = process.env.PORT || 4000;

// Start the server only after the database connection succeeds.
connectDB()
  .then(() => {
    app.listen(PORT, () => console.log(`Server is running on PORT ${PORT}`));
  })
  .catch((err) => {
    console.error('Database connection failed', err);
  });
