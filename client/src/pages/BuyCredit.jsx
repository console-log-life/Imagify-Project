import React, { useContext } from 'react'
import { assets, plans } from '../assets/assets'
import {AppContext} from '../context/AppContext'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import axios from 'axios'

const BuyCredit = () => {
  const {user, backendUrl, loadCreditsData, token, setShowLogin} = useContext(AppContext)
  const navigate = useNavigate()

  // Load Razorpay script
  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      const script = document.createElement('script')
      script.src = 'https://checkout.razorpay.com/v1/checkout.js'
      script.onload = () => {
        resolve(true)
      }
      script.onerror = () => {
        resolve(false)
      }
      document.body.appendChild(script)
    })
  }

  const initPay = async(order) => {
    try {
      const res = await loadRazorpayScript()
      
      if (!res) {
        toast.error('Razorpay SDK failed to load')
        return
      }

      if (!import.meta.env.VITE_RAZORPAY_KEY_ID) {
        toast.error('Razorpay key not configured')
        return
      }

      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency || 'INR',
        name: 'Imagify Credits',
        description: 'Purchase Credits for Image Generation',
        order_id: order.id,
        handler: async(response) => {
          try {
            const verifyData = {
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature
            }
            
            const { data } = await axios.post(
              `${backendUrl}/api/user/verify-razor`,
              verifyData,
              {
                headers: {
                  'Authorization': `Bearer ${token}`
                }
              }
            )

            if(data.success) {
              await loadCreditsData()
              navigate('/')
              toast.success('Payment successful! Credits added to your account.')
            }
          } catch (error) {
            console.error('Payment verification error:', error)
            toast.error(error.response?.data?.message || 'Payment verification failed')
          }
        },
        prefill: {
          name: user?.name || '',
          email: user?.email || ''
        },
        theme: {
          color: '#2563eb'
        }
      }
      
      const rzp = new window.Razorpay(options)
      rzp.open()
    } catch (error) {
      console.error('Payment initialization error:', error)
      toast.error('Failed to initialize payment')
    }
  }

  const paymentrazorpay = async(planId) => {
    try {
      if(!user) {
        setShowLogin(true)
        return
      }

      const { data } = await axios.post(
        `${backendUrl}/api/user/pay-razor`,
        { planId },
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      )

      if(data.success) {
        await initPay(data.order)
      }
    } catch (error) {
      console.error('Payment creation error:', error)
      if (error.response?.status === 401) {
        setShowLogin(true)
        toast.error('Please login again to continue')
      } else {
        toast.error(error.response?.data?.message || 'Failed to initialize payment')
      }
    }
  }

  return (
    <motion.div 
      initial={{ opacity: 0.2, y: 100 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className='min-h-[80vh] flex flex-col items-center justify-center pt-14 mb-10'
    >
      <button className='bg-blue-100 px-10 py-2 border border-gray-400 rounded-full mb-6'>OUR PLANS</button>
      <h1 className='text-center mb-6 sm:mb-10 text-3xl font-medium font-semibold'>Choose the plan</h1>

      <div className='flex flex-wrap justify-center gap-6 text-left'>
        {plans.map((item,index)=>(
          <div key={index}
            className='bg-white drop-shadow-sm border rounded-lg py-12 px-8 text-gray-600 hover:scale-105 transition-all duration-500'
          >
            <img width={40} src={assets.logo_icon} alt="" />
            <p className='mt-3 mb-1 font-semibold'>{item.id}</p>
            <p className='text-sm'>{item.desc}</p>
            <p className='mt-6'>
              <span className='font-medium text-3xl'>${item.price}</span> / {item.credits} credits
            </p>
            <button 
              onClick={() => paymentrazorpay(item.id)} 
              className='w-full text-sm py-2.5 min-w-52 bg-gray-800 rounded-md text-white mt-8 hover:bg-gray-700 transition-colors'
            >
              {user ? 'Purchase' : 'Get Started'}
            </button>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

export default BuyCredit
