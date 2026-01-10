import React, { useState } from 'react';
import { User, Group } from '../types';

interface OnboardingProps {
  onComplete: (user: User, group: Group) => void;
}

const OnboardingScreen: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [groupName, setGroupName] = useState('');
  const [token, setToken] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1 && name) {
      setStep(2);
    } else if (step === 2) {
      const newUser: User = {
        id: `user_${Date.now()}`,
        name,
        isAdmin: true,
        privacySettings: { showDetails: false, shareLocation: false }
      };
      
      const newGroup: Group = {
        id: `group_${Date.now()}`,
        name: mode === 'create' ? groupName : 'مجموعة المنضمين',
        timezone: 'Asia/Muscat',
        inviteCode: 'XYZ-789'
      };

      onComplete(newUser, newGroup);
    }
  };

  return (
    <div className="min-h-screen bg-emerald-600 flex flex-col items-center justify-center p-6 text-white">
      <div className="w-full max-w-sm">
        <h1 className="text-4xl font-bold font-amiri text-center mb-2">فَذَكِّر</h1>
        <p className="text-center text-emerald-100 mb-8 opacity-90">اطمئنان، ذكر، وقرب.</p>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 text-slate-800 shadow-xl">
          {step === 1 ? (
            <>
              <label className="block text-sm font-medium text-slate-700 mb-2">ما اسمك؟</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-3 border border-slate-300 rounded-lg mb-4 focus:ring-2 focus:ring-emerald-500 outline-none"
                placeholder="الاسم الكريم"
                required
              />
              <button type="submit" className="w-full bg-emerald-600 text-white py-3 rounded-lg font-bold hover:bg-emerald-700">
                التالي
              </button>
            </>
          ) : (
            <>
              <div className="flex gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => setMode('create')}
                  className={`flex-1 py-2 text-sm rounded-lg border ${mode === 'create' ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'border-slate-200'}`}
                >
                  إنشاء مجموعة
                </button>
                <button
                  type="button"
                  onClick={() => setMode('join')}
                  className={`flex-1 py-2 text-sm rounded-lg border ${mode === 'join' ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'border-slate-200'}`}
                >
                  انضمام
                </button>
              </div>

              {mode === 'create' ? (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">اسم المجموعة</label>
                  <input
                    type="text"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    className="w-full p-3 border border-slate-300 rounded-lg mb-4 focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="مثال: أسرتي"
                    required
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">رمز الدعوة</label>
                  <input
                    type="text"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    className="w-full p-3 border border-slate-300 rounded-lg mb-4 focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="أدخل الرمز"
                    required
                  />
                </div>
              )}

              <button type="submit" className="w-full bg-emerald-600 text-white py-3 rounded-lg font-bold hover:bg-emerald-700">
                ابدأ الرحلة
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
};

export default OnboardingScreen;