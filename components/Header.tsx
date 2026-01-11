import * as React from 'react';
import { APP_NAME } from '../constants';

interface HeaderProps {
  title?: string;
  userInitials?: string;
  onInfoClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ title, userInitials, onInfoClick }) => {
  return (
    <header className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-slate-100 z-40 px-4 h-14 flex items-center justify-between">
      <div className="flex items-center gap-3">
        {/* User Avatar */}
        <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-bold border border-emerald-200">
          {userInitials || 'ع'}
        </div>
        
        <h1 className="text-xl font-bold text-emerald-800 font-amiri">
          {title || APP_NAME}
        </h1>
      </div>

      {/* Info Button */}
      <button 
        onClick={onInfoClick}
        className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-emerald-600 transition-colors rounded-full hover:bg-slate-50"
        aria-label="معلومات التطبيق"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
        </svg>
      </button>
    </header>
  );
};