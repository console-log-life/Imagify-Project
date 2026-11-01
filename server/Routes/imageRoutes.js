import express from 'express'
import { generateImage } from '../controllers/imageController.js'
import userAuth from '../middlewares/auth.js'
import rateLimit from '../middlewares/rateLimit.js'

const imageRouter = express.Router()

const generateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Too many image requests. Please wait a minute and try again.'
})

imageRouter.post('/generate-image', userAuth, generateLimiter, generateImage)

export default imageRouter
