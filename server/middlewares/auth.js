import jwt from 'jsonwebtoken'

const userAuth = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '') || req.headers.token;

        if (!token) {
            return res.status(401).json({ 
                success: false, 
                message: "Authentication required. Please login." 
            });
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = { id: decoded.id }; // Store user info in request
            next();
        } catch (error) {
            return res.status(401).json({ 
                success: false, 
                message: "Invalid or expired token. Please login again." 
            });
        }
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(500).json({ 
            success: false, 
            message: "Authentication error" 
        });
    }
};

export default userAuth;