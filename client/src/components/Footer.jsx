import React from 'react';
import { assets } from '../assets/assets';

const Footer = () => {
  return (
    <div className="flex items-center justify-between gap-4 py-3 mt-20">
      <img src={assets.logo} width={150} alt="" />
      <p className="flex-1 border-l border-gray-400 text-gray-500 text-sm pl-4 max-sm:hidden">
        Copyright @imagify | All rights reserved.
      </p>

      <div className="flex flex-row gap-2.5">
        <img className='hover:scale-105 transition-all duration-700' src={assets.facebook_icon} width={35} alt="Facebook" />
        <img className='hover:scale-105 transition-all duration-700' src={assets.twitter_icon} width={35} alt="Twitter" />
        <img className='hover:scale-105 transition-all duration-700' src={assets.instagram_icon} width={35} alt="Instagram" />
      </div>
    </div>
  );
};

export default Footer;
