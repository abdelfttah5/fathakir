
import * as React from 'react';
import { APP_NAME } from '../constants';

interface HeaderProps {
  title?: string;
  userInitials?: string;
  onInfoClick?: () => void;
  isDarkMode?: boolean;
  toggleDarkMode?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ title, userInitials, onInfoClick, isDarkMode, toggleDarkMode }) => {
  
  const handleAppShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'تطبيق فَذَكِّر',
        text: 'تطبيق للمجموعات الخاصة لتعزيز الذكر والورد والرواتب باطمئنان وخصوصية.',
        url: window.location.href,
      }).catch((e) => console.log('Sharing failed', e));
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('تم نسخ رابط التطبيق');
    }
  };

  // Embedded Expressive Logo (Mosque/Crescent stylized)
  const appLogo = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'%3E%3Cpath fill='%2310b981' d='M256 0C114.6 0 0 114.6 0 256s114.6 256 256 256 256-114.6 256-256S397.4 0 256 0zM128 384c0-35.3 28.7-64 64-64h64c35.3 0 64 28.7 64 64H128zm128-96h-64c-17.7 0-32-14.3-32-32s14.3-32 32-32h64c17.7 0 32 14.3 32 32s-14.3 32-32 32zM362.7 253.9c-7.5-6.1-13.9-13.3-18.8-21.3l-20.8-33.4c-7.6-12.2-11.6-26.3-11.6-40.7 0-44.1 35.9-80 80-80 9.7 0 19 1.7 27.8 4.9-18.5-38.6-58.1-65.4-104.3-65.4-63.5 0-115 51.5-115 115 0 6.1.5 12.1 1.4 17.9l-19.1-30.6c-7.6-12.2-11.6-26.3-11.6-40.7 0-25 11.5-47.3 29.6-62.6-67.6 15.1-118.9 75.3-118.9 147.3 0 83.9 68.1 152 152 152h.9c-3.1-8.8-4.9-18.1-4.9-27.8 0-44.1 35.9-80 80-80 12.8 0 25.1 3 36.3 8.3-2.1-7.2-3.3-14.8-3.3-22.7 0-44.1 35.9-80 80-80z'/%3E%3C/svg%3E";

  return (
    <header className={`sticky top-0 backdrop-blur-sm border-b z-40 px-4 h-14 flex items-center justify-between transition-colors ${isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white/95 border-slate-100'}`}>
      <div className="flex items-center gap-3">
        {/* App Logo Image (Replaces User Avatar) */}
        <img 
          src={appLogo} 
          alt="شعار التطبيق" 
          className="w-10 h-10 rounded-full shadow-sm object-cover"
        />
        
        <h1 className={`text-xl font-bold font-amiri ${isDarkMode ? 'text-emerald-400' : 'text-emerald-800'}`}>
          {title || APP_NAME}
        </h1>
      </div>

      <div className="flex items-center gap-2">
        {/* Share App Button */}
        <button 
           onClick={handleAppShare}
           className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${isDarkMode ? 'bg-slate-800 text-blue-400' : 'bg-slate-50 text-blue-600 hover:bg-slate-100'}`}
           title="مشاركة التطبيق"
        >
           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
             <path fillRule="evenodd" d="M15.75 4.5a3 3 0 11.825 2.066l-8.421 4.679a3.002 3.002 0 010 1.51l8.421 4.679a3 3 0 11-.729 1.31l-8.421-4.678a3 3 0 110-4.132l8.421-4.679a3 3 0 01-.096-.755z" clipRule="evenodd" />
           </svg>
        </button>

        {/* Dark Mode Toggle */}
        {toggleDarkMode && (
          <button 
             onClick={toggleDarkMode}
             className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${isDarkMode ? 'bg-slate-800 text-yellow-400' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
          >
             {isDarkMode ? '☀️' : '🌙'}
          </button>
        )}

        {/* Info Button */}
        <button 
          onClick={onInfoClick}
          className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-400 hover:text-emerald-600 hover:bg-slate-50'}`}
          aria-label="معلومات التطبيق"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
          </svg>
        </button>
      </div>
    </header>
  );
};
