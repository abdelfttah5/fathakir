
import { db, auth, isMockMode } from "../firebaseConfig";
import { 
  collection, doc, setDoc, getDoc, updateDoc, deleteDoc,
  query, where, getDocs, onSnapshot, orderBy, limit 
} from "firebase/firestore";
import { 
  signInAnonymously,
  onAuthStateChanged,
  updateProfile,
  signOut
} from "firebase/auth";
import { User, Group, ActivityLog, LocationPoint } from "../types";

// ==========================================
// HELPERS
// ==========================================

const cleanUndefined = (obj: any) => {
  const newObj: any = {};
  Object.keys(obj).forEach(key => {
    if (obj[key] !== undefined) newObj[key] = obj[key];
  });
  return newObj;
};

// ==========================================
// MOCK STORAGE (Fallback)
// ==========================================
const MOCK_STORAGE_KEYS = {
  USER: 'fathakkir_session_user',
  USERS_DB: 'f_users',
  GROUPS_DB: 'f_groups',
  MEMBERS_DB: 'f_members',
  LOGS_DB: 'f_logs',
  LOCATIONS_DB: 'f_locations'
};

const getLocal = (key: string) => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : [];
  } catch (e) { return []; }
};

const setLocal = (key: string, data: any) => {
  localStorage.setItem(key, JSON.stringify(data));
};

// ==========================================
// CORE SERVICES
// ==========================================

// 1. AUTH OBSERVATION
export const observeAuthState = (callback: (user: any | null) => void) => {
  if (auth) {
    return onAuthStateChanged(auth, (user) => {
      if (user) {
        callback(user);
      } else {
        const stored = localStorage.getItem(MOCK_STORAGE_KEYS.USER);
        callback(stored ? JSON.parse(stored) : null);
      }
    });
  } else {
    const stored = localStorage.getItem(MOCK_STORAGE_KEYS.USER);
    callback(stored ? JSON.parse(stored) : null);
    return () => {};
  }
};

// 2. GUEST LOGIN
export const loginGuestUser = async (customName: string): Promise<User> => {
  const id = 'guest_' + Date.now() + Math.floor(Math.random() * 1000);
  
  if (auth) {
    try {
      const cred = await signInAnonymously(auth);
      const fbUser = cred.user;
      if (fbUser) {
        await updateProfile(fbUser, { displayName: customName });
        const newUser: User = {
          id: fbUser.uid, 
          name: customName, 
          isAdmin: false,
          isGuest: true,
          privacySettings: { showDetails: false, shareLocation: false }
        };
        await setDoc(doc(db, "users", fbUser.uid), newUser, { merge: true });
        return newUser;
      }
    } catch (e) {
      console.warn("Firebase Anonymous Auth failed, using local mock", e);
    }
  }

  const newUser: User = {
    id, name: customName, isAdmin: false, isGuest: true,
    privacySettings: { showDetails: false, shareLocation: false }
  };
  localStorage.setItem(MOCK_STORAGE_KEYS.USER, JSON.stringify({ uid: id, displayName: customName, isAnonymous: true }));
  return newUser;
};

// 3. CREATE GROUP
export const createGroupInFirestore = async (groupData: Group, creator: User) => {
  const localGroups = getLocal(MOCK_STORAGE_KEYS.GROUPS_DB);
  localGroups.push({ ...groupData, adminId: creator.id });
  setLocal(MOCK_STORAGE_KEYS.GROUPS_DB, localGroups);
  
  const localMembers = getLocal(MOCK_STORAGE_KEYS.MEMBERS_DB);
  localMembers.push({ ...creator, userId: creator.id, groupId: groupData.id, isAdmin: true, joinedAt: Date.now() });
  setLocal(MOCK_STORAGE_KEYS.MEMBERS_DB, localMembers);

  if (db && !isMockMode) {
    try {
      await setDoc(doc(db, "groups", groupData.id), cleanUndefined({ ...groupData, adminId: creator.id }));
      await setDoc(doc(db, "group_members", `${groupData.id}_${creator.id}`), {
        userId: creator.id,
        groupId: groupData.id,
        name: creator.name,
        isAdmin: true,
        joinedAt: Date.now()
      });
      return true;
    } catch (e) {
      console.error("Firestore Create Group Failed:", e);
      throw new Error("تعذر إنشاء المجموعة على السيرفر. تم الإنشاء محلياً.");
    }
  }
  return true;
};

// 4. JOIN GROUP
export const joinGroupInFirestore = async (inviteCode: string, user: User): Promise<Group | null> => {
  const code = inviteCode.trim().toUpperCase();

  if (db && !isMockMode) {
    try {
      const q = query(collection(db, "groups"), where("inviteCode", "==", code));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const groupDoc = snapshot.docs[0];
        const groupData = groupDoc.data() as Group;
        
        await setDoc(doc(db, "group_members", `${groupData.id}_${user.id}`), {
          userId: user.id,
          groupId: groupData.id,
          name: user.name,
          isAdmin: false,
          joinedAt: Date.now()
        });

        return groupData;
      }
    } catch (e) {
      console.error("Firestore Join Failed:", e);
    }
  }

  const localGroups = getLocal(MOCK_STORAGE_KEYS.GROUPS_DB);
  const found = localGroups.find((g: Group) => g.inviteCode === code);
  
  if (found) {
    await joinGroupViaSeeding(found, user);
    return found;
  }

  return null;
};

// 5. GET USER GROUP
export const getUserGroup = async (userId: string): Promise<Group | null> => {
  if (db && !isMockMode) {
    try {
      const q = query(collection(db, "group_members"), where("userId", "==", userId));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const groupId = snap.docs[0].data().groupId;
        const gDoc = await getDoc(doc(db, "groups", groupId));
        if (gDoc.exists()) return gDoc.data() as Group;
      }
    } catch (e) { console.warn("Firestore get group failed", e); }
  }

  const members = getLocal(MOCK_STORAGE_KEYS.MEMBERS_DB);
  const membership = members.find((m: any) => m.userId === userId);
  if (membership) {
    const groups = getLocal(MOCK_STORAGE_KEYS.GROUPS_DB);
    return groups.find((g: Group) => g.id === membership.groupId) || null;
  }
  return null;
};

// 6. REALTIME MEMBERS LISTENER
export const subscribeToMembers = (groupId: string, callback: (members: User[]) => void) => {
  let unsub = () => {};

  if (db && !isMockMode) {
    try {
      const q = query(collection(db, "group_members"), where("groupId", "==", groupId));
      unsub = onSnapshot(q, (snap) => {
        const list: User[] = [];
        snap.forEach(d => list.push(d.data() as User));
        callback(list);
      });
    } catch (e) { console.error(e); }
  } else {
    const interval = setInterval(() => {
      const all = getLocal(MOCK_STORAGE_KEYS.MEMBERS_DB);
      const filtered = all.filter((m: any) => m.groupId === groupId);
      callback(filtered);
    }, 2000);
    unsub = () => clearInterval(interval);
  }
  return unsub;
};

// 7. SEEDING
export const joinGroupViaSeeding = async (groupData: Group, user: User): Promise<Group> => {
  const groups = getLocal(MOCK_STORAGE_KEYS.GROUPS_DB);
  if (!groups.find((g: Group) => g.id === groupData.id)) {
    groups.push(groupData);
    setLocal(MOCK_STORAGE_KEYS.GROUPS_DB, groups);
  }
  
  const members = getLocal(MOCK_STORAGE_KEYS.MEMBERS_DB);
  if (!members.find((m: any) => m.userId === user.id && m.groupId === groupData.id)) {
    members.push({ ...user, userId: user.id, groupId: groupData.id, joinedAt: Date.now() });
    setLocal(MOCK_STORAGE_KEYS.MEMBERS_DB, members);
  }

  if (db && !isMockMode) {
     try {
       await setDoc(doc(db, "groups", groupData.id), cleanUndefined(groupData), { merge: true });
       await setDoc(doc(db, "group_members", `${groupData.id}_${user.id}`), {
          userId: user.id,
          groupId: groupData.id,
          name: user.name,
          isAdmin: false,
          joinedAt: Date.now()
       });
     } catch(e) {}
  }

  return groupData;
};

export const logoutUser = async () => {
  localStorage.removeItem(MOCK_STORAGE_KEYS.USER);
  if (auth) await signOut(auth);
};

// --- LOGGING & LOCATIONS ---

const forceSaveToLocalLog = (groupId: string, log: ActivityLog) => {
  const logs = getLocal(MOCK_STORAGE_KEYS.LOGS_DB);
  logs.push({ ...log, groupId });
  setLocal(MOCK_STORAGE_KEYS.LOGS_DB, logs);
};

// UPDATED: Hybrid Listener (Merges Remote and Local)
export const subscribeToLogs = (groupId: string, cb: (logs: ActivityLog[]) => void) => { 
    let remoteLogs: ActivityLog[] = [];
    let localLogs: ActivityLog[] = [];
    let unsubRemote = () => {};

    // Helper to merge and sort
    const mergeAndEmit = () => {
        const combined = [...remoteLogs];
        // Add local logs that are not in remote (by ID)
        localLogs.forEach(l => {
            if (!combined.find(r => r.id === l.id)) {
                combined.push(l);
            }
        });
        // Sort DESC
        combined.sort((a, b) => b.timestamp - a.timestamp);
        cb(combined);
    };

    // 1. Setup Remote Listener
    if(db && !isMockMode) {
        const q = query(collection(db, "activity_logs"), where("groupId", "==", groupId), orderBy("timestamp", "desc"), limit(50));
        unsubRemote = onSnapshot(q, (s) => {
            remoteLogs = [];
            s.forEach(d => remoteLogs.push(d.data() as ActivityLog));
            mergeAndEmit();
        }, (error) => {
            console.warn("Firestore subscription failed, relying on local:", error);
        });
    }

    // 2. Setup Local Polling (Always active to catch local-only saves)
    const interval = setInterval(() => {
        const all = getLocal(MOCK_STORAGE_KEYS.LOGS_DB);
        localLogs = all.filter((l:any) => l.groupId === groupId);
        mergeAndEmit();
    }, 2000); // Check every 2 seconds

    // Initial Local Load
    const all = getLocal(MOCK_STORAGE_KEYS.LOGS_DB);
    localLogs = all.filter((l:any) => l.groupId === groupId);
    mergeAndEmit();

    return () => {
        unsubRemote();
        clearInterval(interval);
    };
};

export const subscribeToLocations = (groupId: string, cb: any) => {
    if(db && !isMockMode) {
        const q = query(collection(db, "locations"), where("groupId", "==", groupId));
        return onSnapshot(q, (s) => {
            const locs: any[] = [];
            s.forEach(d => locs.push(d.data()));
            cb(locs);
        });
    }
    const interval = setInterval(() => {
        const all = getLocal(MOCK_STORAGE_KEYS.LOCATIONS_DB);
        cb(all.filter((l:any) => l.groupId === groupId));
    }, 3000);
    return () => clearInterval(interval);
};

export const logActivityToFirestore = async (groupId: string, log: ActivityLog) => {
    // 1. Always save locally first (Fail-safe)
    forceSaveToLocalLog(groupId, log);

    // 2. Try remote save if configured
    if(db && !isMockMode) {
        try {
            await setDoc(doc(db, "activity_logs", log.id), { ...log, groupId });
        } catch (e) {
            console.warn("Firestore save failed (saved locally only):", e);
        }
    }
};

export const updateLocationInFirestore = async (groupId: string, point: LocationPoint) => {
    const locations = getLocal(MOCK_STORAGE_KEYS.LOCATIONS_DB);
    const filtered = locations.filter((l: any) => !(l.userId === point.userId && l.groupId === groupId));
    filtered.push({ ...point, groupId });
    setLocal(MOCK_STORAGE_KEYS.LOCATIONS_DB, filtered);

    if(db && !isMockMode) {
        try {
            await setDoc(doc(db, "locations", `${groupId}_${point.userId}`), {
                ...point,
                groupId
            });
        } catch(e) {}
    }
};

export const leaveGroupInFirestore = async (uid: string, gid: string) => {
    const mems = getLocal(MOCK_STORAGE_KEYS.MEMBERS_DB).filter((m:any) => !(m.userId === uid && m.groupId === gid));
    setLocal(MOCK_STORAGE_KEYS.MEMBERS_DB, mems);
    if(db && !isMockMode) {
        await deleteDoc(doc(db, "group_members", `${gid}_${uid}`));
    }
};

export const updateGroupCode = async (gid: string, code: string) => {
    const groups = getLocal(MOCK_STORAGE_KEYS.GROUPS_DB);
    const g = groups.find((x:any) => x.id === gid);
    if(g) { g.inviteCode = code; setLocal(MOCK_STORAGE_KEYS.GROUPS_DB, groups); }
    if(db && !isMockMode) await updateDoc(doc(db, "groups", gid), { inviteCode: code });
};
