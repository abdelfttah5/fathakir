import React from 'react';
import { APP_NAME } from '../constants';

interface HeaderProps {
  title?: string;
  userInitials?: string;
}

export const Header: React.FC<HeaderProps> = ({ title, userInitials }) => {
  return (
    <header className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-slate-100 z-40 px-4 h-14 flex items-center justify-between">
      <h1 className="text-xl font-bold text-emerald-800 font-amiri">
        {title || APP_NAME}
      </h1>
      <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-bold border border-emerald-200">
        {userInitials || 'ع'}
      </div>
    </header>
  );
};
