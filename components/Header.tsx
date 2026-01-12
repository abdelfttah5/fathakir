
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
  return (
    <header className={`sticky top-0 backdrop-blur-sm border-b z-40 px-4 h-14 flex items-center justify-between transition-colors ${isDarkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-white/95 border-slate-100'}`}>
      <div className="flex items-center gap-3">
        {/* User Avatar */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border ${isDarkMode ? 'bg-emerald-900 text-emerald-200 border-emerald-800' : 'bg-emerald-100 text-emerald-700 border-emerald-200'}`}>
          {userInitials || 'ع'}
        </div>
        
        <h1 className={`text-xl font-bold font-amiri ${isDarkMode ? 'text-emerald-400' : 'text-emerald-800'}`}>
          {title || APP_NAME}
        </h1>
      </div>

      <div className="flex items-center gap-2">
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
