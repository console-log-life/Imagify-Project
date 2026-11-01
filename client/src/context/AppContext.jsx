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

    // Configure axios once. Registering the interceptor in the component body
    // added a new interceptor on every render; this registers one and removes it on unmount.
    useEffect(() => {
        axios.defaults.baseURL = backendUrl;
        const interceptorId = axios.interceptors.request.use((config) => {
            const currentToken = localStorage.getItem('token');
            if (currentToken) {
                config.headers.Authorization = `Bearer ${currentToken}`;
            }
            return config;
        });
        return () => axios.interceptors.request.eject(interceptorId);
    }, [backendUrl]);

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
            const { data } = await axios.post('/api/image/generate-image', { prompt });
            setCredit(data.creditBalance);
            return data.resultImage;
        } catch (error) {
            console.error('Image generation error:', error);
            const status = error.response?.status;
            if (status === 401) {
                silentLogout();
                setShowLogin(true);
            } else if (status === 402) {
                toast.error('You are out of credits');
                setCredit(0);
                navigate('/buy');
            } else {
                toast.error(error.response?.data?.message || 'Failed to generate image');
                if (typeof error.response?.data?.creditBalance === 'number') {
                    setCredit(error.response.data.creditBalance);
                }
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