import userModel from "../model/usermodel.js";
import FormData from 'form-data';
import axios from "axios"

export const MAX_PROMPT_LENGTH = 1000;

// Text-to-image providers. Cloudflare Workers AI (FLUX.1 schnell) is used when
// its credentials are set, because its free plan covers roughly 170 images a
// day. ClipDrop is kept as the fallback. Both return { data: Buffer, mimeType }.
const cloudflare = async (prompt) => {
    const url = `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/ai/run/@cf/black-forest-labs/flux-1-schnell`
    const { data } = await axios.post(url, { prompt, steps: 4 }, {
        headers: { Authorization: `Bearer ${process.env.CF_API_TOKEN}` },
        timeout: 60000
    })
    if (!data?.result?.image) {
        throw new Error('Cloudflare response had no image')
    }
    return { data: Buffer.from(data.result.image, 'base64'), mimeType: 'image/jpeg' }
}

const clipdrop = async (prompt) => {
    const formData = new FormData()
    formData.append('prompt', prompt)

    const { data } = await axios.post('https://clipdrop-api.co/text-to-image/v1', formData, {
        headers: { 'x-api-key': process.env.CLIPDROP_API },
        responseType: 'arraybuffer',
        timeout: 60000
    })
    return { data: Buffer.from(data), mimeType: 'image/png' }
}

// Kept on an object so tests can replace it.
export const imageProvider = {
    async textToImage(prompt) {
        if (process.env.CF_ACCOUNT_ID && process.env.CF_API_TOKEN) {
            return cloudflare(prompt)
        }
        return clipdrop(prompt)
    }
}

// Pull a readable error out of a provider response. ClipDrop sends errors as an
// arraybuffer; Cloudflare sends JSON with an errors array.
const providerErrorDetail = (error) => {
    let body = error.response?.data
    if (body && (Buffer.isBuffer(body) || body instanceof ArrayBuffer)) {
        try {
            body = JSON.parse(Buffer.from(body).toString('utf8'))
        } catch {
            body = null
        }
    }
    if (body?.error) return String(body.error)
    if (Array.isArray(body?.errors) && body.errors[0]?.message) return String(body.errors[0].message)
    return error.message
}

// Message shown to the user. Only a 400 (a problem with the prompt itself) is
// passed through. Account-side errors such as the provider's own credits running
// out (402) or a bad API key (401/403) would confuse users, because they refer
// to the app's ClipDrop account, not the user's Imagify credits.
const providerErrorMessage = (error) => {
    if (error.response?.status === 400) {
        return `${providerErrorDetail(error)}. Your credit has been refunded.`
    }
    return 'The image service is unavailable right now. Your credit has been refunded, please try again later.'
}

export const generateImage = async (req, res) => {
    const userId = req.user.id
    const prompt = typeof req.body.prompt === 'string' ? req.body.prompt.trim() : ''

    if (!prompt) {
        return res.status(400).json({ success: false, message: 'Please enter a prompt' })
    }
    if (prompt.length > MAX_PROMPT_LENGTH) {
        return res.status(400).json({ success: false, message: `Prompt must be at most ${MAX_PROMPT_LENGTH} characters` })
    }

    // Reserve one credit atomically. The filter only matches while the balance is
    // above zero, so concurrent requests can never spend more credits than exist.
    let user
    try {
        user = await userModel.findOneAndUpdate(
            { _id: userId, creditBalance: { $gt: 0 } },
            { $inc: { creditBalance: -1 } },
            { new: true }
        )
    } catch (error) {
        console.error('Credit reservation error:', error)
        return res.status(500).json({ success: false, message: 'Could not start image generation' })
    }

    if (!user) {
        const exists = await userModel.exists({ _id: userId })
        if (!exists) {
            return res.status(404).json({ success: false, message: 'User not found' })
        }
        return res.status(402).json({ success: false, message: 'No Credit Balance', creditBalance: 0 })
    }

    try {
        const image = await imageProvider.textToImage(prompt)
        const resultImage = `data:${image.mimeType};base64,${image.data.toString('base64')}`
        return res.json({ success: true, message: 'Image Generated', creditBalance: user.creditBalance, resultImage })
    } catch (error) {
        console.error('Image provider error:', error.response?.status, providerErrorDetail(error))
        // Give the reserved credit back, since the user got no image.
        await userModel.updateOne({ _id: userId }, { $inc: { creditBalance: 1 } })
            .catch((refundError) => console.error('Credit refund failed:', refundError))
        return res.status(502).json({
            success: false,
            message: providerErrorMessage(error),
            creditBalance: user.creditBalance + 1
        })
    }
}
