import express from 'express';
import cors from 'cors';
import userRouter from './Routes/userRouter.js';
import imageRouter from './Routes/imageRoutes.js';

// Allowed browser origins, comma separated. Leave CLIENT_URL unset in local
// development to allow any origin.
const allowedOrigins = (process.env.CLIENT_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const app = express();

app.use(express.json({ limit: '10kb' }));
app.use(cors(allowedOrigins.length ? { origin: allowedOrigins } : undefined));

app.use('/api/user', userRouter);
app.use('/api/image', imageRouter);
app.get('/', (req, res) => res.send('API Working good'));

export default app;
