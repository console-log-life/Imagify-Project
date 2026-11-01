import userModel from "../model/usermodel.js";
import FormData from 'form-data';
import axios from "axios"

export const MAX_PROMPT_LENGTH = 1000;

// Text-to-image provider. Kept on an object so tests can replace it.
export const imageProvider = {
    async textToImage(prompt) {
        const formData = new FormData()
        formData.append('prompt', prompt)

        const { data } = await axios.post('https://clipdrop-api.co/text-to-image/v1', formData, {
            headers: { 'x-api-key': process.env.CLIPDROP_API },
            responseType: 'arraybuffer',
            timeout: 60000
        })
        return Buffer.from(data)
    }
}

// ClipDrop returns errors as an arraybuffer, so decode them before using them.
const providerErrorDetail = (error) => {
    const body = error.response?.data
    if (body) {
        try {
            const parsed = JSON.parse(Buffer.from(body).toString('utf8'))
            if (parsed?.error) return String(parsed.error)
        } catch {
            // not JSON
        }
    }
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
        const resultImage = `data:image/png;base64,${image.toString('base64')}`
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
