# فَذَكِّر - Fathakkir (MVP V1)

تطبيق ويب للمجموعات الخاصة لتعزيز الذكر والورد والرواتب باطمئنان وخصوصية.

## Tech Stack
- **Frontend:** React 18, TypeScript, Tailwind CSS
- **Backend (Simulated/Ready):** Firebase Auth, Firestore
- **AI Integration:** Google Gemini (for Smart Search)

## Setup Instructions

1. **Install Dependencies**
   If you are running this in a local Node environment (not just the XML output):
   ```bash
   npm create vite@latest fathakkir -- --template react-ts
   cd fathakkir
   npm install
   npm install @google/genai firebase
   ```

2. **Environment Variables**
   Create a `.env` file in the root:
   ```
   VITE_FIREBASE_API_KEY=your_key
   VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   VITE_GEMINI_API_KEY=your_gemini_key
   ```
   *Note: For the provided code to work in a pure browser environment (like the XML preview), we used dummy data and `localStorage` to simulate persistence.*

3. **Running the App**
   ```bash
   npm run dev
   ```

## Features Implemented
1. **Onboarding:** User creation and Group Join simulation.
2. **Today Tab:** Progress tracking, Quick Actions modal, and Location Check-in (One-time share).
3. **Dhikr Tab:** Digital counters with saving session logic.
4. **Read Tab:** Quran index and a **Smart Search** feature using Gemini to answer questions with sources.
5. **Group Tab:** Activity feed (mocked) and Google Meet scheduling interface.

## Privacy & Security
- No continuous background location tracking.
- Visibility controls handled in logic (and backed by Firestore rules).
- "Smart Search" uses Google Search Grounding to ensure accuracy of religious info.

## Deployment
This is a Single Page Application (SPA). It can be deployed to Vercel, Netlify, or Firebase Hosting.
