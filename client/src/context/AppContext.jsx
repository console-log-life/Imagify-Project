import { createContext, useEffect, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";

export const AppContext = createContext();

const AppContextProvider = (props) => {
    const [user, setUser] = useState(null);
    const [showLogin, setShowLogin] = useState(false);
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [credit, setCredit] = useState(0);
    const [loading, setLoading] = useState(false);
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const backendUrl = import.meta.env.VITE_BACKEND_URL;
    const navigate = useNavigate();

    // Configure axios defaults
    axios.defaults.baseURL = backendUrl;

    // Add axios interceptor for token
    axios.interceptors.request.use((config) => {
        const currentToken = localStorage.getItem('token');
        if (currentToken) {
            config.headers.Authorization = `Bearer ${currentToken}`;
        }
        return config;
    });

    const loadCreditsData = async (showError = true) => {
        try {
            if (!token) return;
            
            setLoading(true);
            const { data } = await axios.get('/api/user/credits');
            if (data.success) {
                setCredit(data.credits);
                setUser(data.user);
            } else if (showError) {
                toast.error(data.message);
            }
        } catch (error) {
            console.error('Credits loading error:', error);
            if (error.response?.status === 401) {
                silentLogout();
            } else if (showError) {
                toast.error(error.response?.data?.message || 'Failed to load credits');
            }
        } finally {
            setLoading(false);
            setIsInitialLoad(false);
        }
    };

    const generateImage = async (prompt) => {
        try {
            if (!user?._id) {
                toast.error('Please login first');
                setShowLogin(true);
                return;
            }
            
            setLoading(true);
            const { data } = await axios.post('/api/image/generate-image', { 
                prompt,
                userId: user._id 
            });
            
            if (data.success) {
                await loadCreditsData(false);
                return data.resultImage;
            } else {
                toast.error(data.message);
                await loadCreditsData(false);
                if (data.creditBalance === 0) {
                    navigate('/buy');
                }
            }
        } catch (error) {
            console.error('Image generation error:', error);
            if (error.response?.status === 401) {
                silentLogout();
                setShowLogin(true);
            } else {
                toast.error(error.response?.data?.message || 'Failed to generate image');
            }
        } finally {
            setLoading(false);
        }
    };

    const silentLogout = () => {
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
        setCredit(0);
    };

    const logout = () => {
        silentLogout();
        toast.info('Logged out successfully');
    };

    useEffect(() => {
        if (token) {
            loadCreditsData(!isInitialLoad);
        } else {
            setUser(null);
            setCredit(0);
        }
    }, [token]);

    const value = {
        user,
        setUser,
        showLogin,
        setShowLogin,
        backendUrl,
        token,
        setToken,
        credit,
        setCredit,
        loading,
        loadCreditsData,
        logout,
        generateImage
    };

    return (
        <AppContext.Provider value={value}>
            {props.children}
        </AppContext.Provider>
    );
};

export default AppContextProvider;