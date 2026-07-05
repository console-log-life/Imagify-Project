import React, { useContext, useEffect, useState } from 'react'
import { assets } from '../assets/assets'
import { AppContext } from '../context/AppContext'
import { motion } from 'motion/react'
import axios from 'axios'
import { toast } from 'react-toastify'

const Login = () => {
    const [state, setState] = useState('Login')
    const { setShowLogin, backendUrl, setToken, setUser } = useContext(AppContext)
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)

    const validateInputs = () => {
        if (!email || !password) {
            toast.error('Please fill in all required fields')
            return false
        }
        if (state !== 'Login' && !name) {
            toast.error('Please enter your name')
            return false
        }
        if (!email.includes('@')) {
            toast.error('Please enter a valid email address')
            return false
        }
        if (password.length < 6) {
            toast.error('Password must be at least 6 characters long')
            return false
        }
        return true
    }

    const onSubmitHandler = async (e) => {
        e.preventDefault()
        
        if (!validateInputs()) {
            return
        }

        setLoading(true)
        const endpoint = state === 'Login' ? '/api/user/login' : '/api/user/register'
        const payload = state === 'Login' ? { email, password } : { name, email, password }

        try {
            const { data } = await axios.post(backendUrl + endpoint, payload)

            if (data.success) {
                localStorage.setItem('token', data.token)
                setToken(data.token)
                setUser(data.user)
                setShowLogin(false)
                toast.success(state === 'Login' ? 'Welcome back!' : 'Account created successfully!')
            }
        } catch (error) {
            console.error('Auth error:', error)
            if (error.response?.data?.message) {
                toast.error(error.response.data.message)
            } else if (!error.response) {
                toast.error('Unable to connect to server. Please check your internet connection.')
            } else {
                toast.error('An unexpected error occurred')
            }
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        document.body.style.overflow = 'hidden'
        return () => {
            document.body.style.overflow = 'unset'
        }
    }, [])

    return (
        <div className='fixed flex top-0 right-0 left-0 bottom-0 backdrop-blur-sm z-10 bg-black/30 justify-center items-center'>
            <motion.form 
                onSubmit={onSubmitHandler}
                initial={{ opacity: 0.2, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className='relative bg-white rounded-xl p-10 text-slate-500'
            >
                <h1 className='text-center text-3xl text-neutral-700 font-medium'>{state}</h1>
                <p className='text-sm mt-3'>
                    {state === 'Login' 
                        ? 'Welcome back! Please sign in to continue' 
                        : 'Create an account to get started'}
                </p>

                {state !== 'Login' && (
                    <div className='flex border px-8 py-2 mt-5 rounded-full items-center gap-2'>
                        <img width={22} src={assets.user_icon} alt="icon" />
                        <input 
                            onChange={e => setName(e.target.value.trim())} 
                            value={name} 
                            className='outline-none text-sm w-full' 
                            type="text" 
                            placeholder='Full Name' 
                            required
                            minLength={2}
                        />
                    </div>
                )}

                <div className='flex border px-8 py-2 mt-4 rounded-full items-center gap-2'>
                    <img src={assets.email_icon} alt="icon" />
                    <input 
                        onChange={e => setEmail(e.target.value.trim())} 
                        value={email} 
                        className='outline-none text-sm w-full' 
                        type="email" 
                        placeholder='Email id' 
                        required
                    />
                </div>

                <div className='flex border px-8 py-2 mt-4 rounded-full items-center gap-2'>
                    <img src={assets.lock_icon} alt="icon" />
                    <input 
                        onChange={e => setPassword(e.target.value)} 
                        value={password} 
                        className='outline-none text-sm w-full' 
                        type="password" 
                        placeholder='Password' 
                        required
                        minLength={6}
                    />
                </div>

                <button 
                    disabled={loading}
                    className={`bg-blue-600 text-white py-2 w-full rounded-full mt-6 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                    {loading ? 'Please wait...' : (state === 'Login' ? 'Login' : 'Create account')}
                </button>

                {state === 'Login' ? (
                    <p className='text-center mt-5'>
                        Don't have an account? <span className='text-blue-600 cursor-pointer' onClick={() => setState('Sign up')}>Sign Up</span>
                    </p>
                ) : (
                    <p className='text-center mt-5'>
                        Already have an account? <span className='text-blue-600 cursor-pointer' onClick={() => setState('Login')}>Sign In</span>
                    </p>
                )}

                <img 
                    src={assets.cross_icon} 
                    onClick={() => setShowLogin(false)} 
                    className='absolute top-5 right-5 cursor-pointer' 
                    alt="close" 
                />
            </motion.form>
        </div>
    )
}

export default Login
