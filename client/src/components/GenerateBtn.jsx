import React, { useContext } from 'react'
import { assets } from '../assets/assets'
import { motion } from 'motion/react'
import { AppContext } from '../context/AppContext'
import { useNavigate } from 'react-router-dom'

const GenerateBtn = () => {
  const {user, setShowLogin} = useContext(AppContext)
  const navigate = useNavigate()

  const onClickHandler =()=>{
    if(user){
      navigate('/result')
    }else{
      setShowLogin(true)
    }
  }
  return (
    <motion.div 
    initial={{opacity:0.2,y:100}}
    transition={{duration:1}}
    whileHover={{opacity:1,y:0}}
    viewport={{once:true}}
    className='text-center pb-16'>
      <h1 className='text-2xl md:text-3xl lg:text-4xl font-semibold mt-4 text-neutral-800 py-4 md:py-16'>See the magic. Try now</h1>
      <button 
      onClick={onClickHandler}
      className='inline-flex items-center gap-2 bg-black rounded-full px-12 py-3 hover:scale-105 transition-all duration-500 text-white w-auto mt-8 sm:text-lg'>
        Generate Images <img className='h-6' src={assets.star_group} alt="" /></button>
    </motion.div>
  )
}

export default GenerateBtn
