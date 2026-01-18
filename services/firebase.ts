
import { db, auth, isMockMode } from "../firebaseConfig";
import { 
  collection, doc, setDoc, getDoc, updateDoc, deleteDoc,
  query, where, getDocs, onSnapshot, orderBy, limit 
} from "firebase/firestore";
import { User, Group, ActivityLog, LocationPoint } from "../types";

import * as _auth from "firebase/auth";
const { 
  signInAnonymously,
  onAuthStateChanged,
  updateProfile,
  signOut
} = _auth as any;

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
// MOCK STORAGE
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

export const observeAuthState = (callback: (user: any | null) => void) => {
  if (auth) {
    return onAuthStateChanged(auth, (user: any) => {
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
        // Ensure user record exists
        await setDoc(doc(db, "users", fbUser.uid), newUser, { merge: true });
        return newUser;
      }
    } catch (e) {
      console.warn("Firebase Anonymous Auth failed", e);
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
      // 1. Save Group
      await setDoc(doc(db, "groups", groupData.id), cleanUndefined({ ...groupData, adminId: creator.id }));
      // 2. Add Admin as Member
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
      throw new Error("تعذر إنشاء المجموعة على السيرفر. تحقق من الاتصال.");
    }
  }
  return true;
};

// 4. JOIN GROUP
export const joinGroupInFirestore = async (inviteCode: string, user: User): Promise<Group | null> => {
  const code = inviteCode.trim().toUpperCase();

  if (db && !isMockMode) {
    try {
      // Find Group by Code
      const q = query(collection(db, "groups"), where("inviteCode", "==", code));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const groupDoc = snapshot.docs[0];
        const groupData = groupDoc.data() as Group;
        
        // Add User to Group Members Collection
        await setDoc(doc(db, "group_members", `${groupData.id}_${user.id}`), {
          userId: user.id,
          groupId: groupData.id,
          name: user.name,
          isAdmin: false,
          joinedAt: Date.now()
        });

        // Also update local storage to reflect the join immediately
        const localMembers = getLocal(MOCK_STORAGE_KEYS.MEMBERS_DB);
        if (!localMembers.find((m: any) => m.userId === user.id && m.groupId === groupData.id)) {
            localMembers.push({ ...user, userId: user.id, groupId: groupData.id, joinedAt: Date.now() });
            setLocal(MOCK_STORAGE_KEYS.MEMBERS_DB, localMembers);
        }

        return groupData;
      }
    } catch (e) {
      console.error("Firestore Join Failed:", e);
    }
  }

  // Fallback to Local Search (only works if group was created locally on same device)
  const localGroups = getLocal(MOCK_STORAGE_KEYS.GROUPS_DB);
  const found = localGroups.find((g: Group) => g.inviteCode === code);
  
  if (found) {
    await joinGroupViaSeeding(found, user);
    return found;
  }

  return null;
};

// 5. GET USER GROUP (Enhanced)
export const getUserGroup = async (userId: string): Promise<Group | null> => {
  if (db && !isMockMode) {
    try {
      // Look for membership record
      const q = query(collection(db, "group_members"), where("userId", "==", userId));
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        // Assume user is in 1 group for MVP
        const groupId = snap.docs[0].data().groupId;
        const gDoc = await getDoc(doc(db, "groups", groupId));
        if (gDoc.exists()) return gDoc.data() as Group;
      }
    } catch (e) { 
        console.warn("Firestore get group failed", e); 
    }
  }

  // Fallback Local
  const members = getLocal(MOCK_STORAGE_KEYS.MEMBERS_DB);
  const membership = members.find((m: any) => m.userId === userId);
  if (membership) {
    const groups = getLocal(MOCK_STORAGE_KEYS.GROUPS_DB);
    return groups.find((g: Group) => g.id === membership.groupId) || null;
  }
  return null;
};

// 6. REALTIME MEMBERS LISTENER (Fixed Separation Issue)
export const subscribeToMembers = (groupId: string, callback: (members: User[]) => void) => {
  if (db && !isMockMode) {
    // If we have Firestore, RELY ON IT. Do not mix with local storage for membership list
    // because that causes ghost groups if local storage is empty on a new device.
    try {
      const q = query(collection(db, "group_members"), where("groupId", "==", groupId));
      return onSnapshot(q, (snap) => {
        const list: User[] = [];
        snap.forEach(d => list.push(d.data() as User));
        callback(list);
      });
    } catch (e) { console.error(e); }
  } 
  
  // Only if Mock Mode or DB fails, use Local Polling
  const interval = setInterval(() => {
    const all = getLocal(MOCK_STORAGE_KEYS.MEMBERS_DB);
    const filtered = all.filter((m: any) => m.groupId === groupId);
    callback(filtered);
  }, 2000);
  
  return () => clearInterval(interval);
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

// Hybrid Listener for Logs (Optimistic UI)
export const subscribeToLogs = (groupId: string, cb: (logs: ActivityLog[]) => void) => { 
    let remoteLogs: ActivityLog[] = [];
    let localLogs: ActivityLog[] = [];
    let unsubRemote = () => {};

    const mergeAndEmit = () => {
        const combined = [...remoteLogs];
        localLogs.forEach(l => {
            if (!combined.find(r => r.id === l.id)) {
                combined.push(l);
            }
        });
        combined.sort((a, b) => b.timestamp - a.timestamp);
        cb(combined.slice(0, 50));
    };

    if(db && !isMockMode) {
        const q = query(collection(db, "activity_logs"), where("groupId", "==", groupId));
        unsubRemote = onSnapshot(q, (s) => {
            remoteLogs = [];
            s.forEach(d => remoteLogs.push(d.data() as ActivityLog));
            mergeAndEmit();
        }, (error) => {
            console.warn("Firestore log subscription failed", error);
        });
    }

    // Always poll local for optimistic updates
    const interval = setInterval(() => {
        const all = getLocal(MOCK_STORAGE_KEYS.LOGS_DB);
        localLogs = all.filter((l:any) => l.groupId === groupId);
        mergeAndEmit();
    }, 2000); 

    const all = getLocal(MOCK_STORAGE_KEYS.LOGS_DB);
    localLogs = all.filter((l:any) => l.groupId === groupId);
    mergeAndEmit();

    return () => {
        unsubRemote();
        clearInterval(interval);
    };
};

// Hybrid Listener for Locations
export const subscribeToLocations = (groupId: string, cb: (locs: LocationPoint[]) => void) => {
    let remoteLocs: LocationPoint[] = [];
    let localLocs: LocationPoint[] = [];
    let unsubRemote = () => {};

    const mergeAndEmit = () => {
        const all = [...remoteLocs, ...localLocs];
        const latestMap = new Map<string, LocationPoint>();
        
        all.forEach(p => {
            const existing = latestMap.get(p.userId);
            if (!existing || p.timestamp > existing.timestamp) {
                latestMap.set(p.userId, p);
            }
        });
        cb(Array.from(latestMap.values()));
    };

    if(db && !isMockMode) {
        const q = query(collection(db, "locations"), where("groupId", "==", groupId));
        unsubRemote = onSnapshot(q, (s) => {
            remoteLocs = [];
            s.forEach(d => remoteLocs.push(d.data() as LocationPoint));
            mergeAndEmit();
        });
    }

    const interval = setInterval(() => {
        const all = getLocal(MOCK_STORAGE_KEYS.LOCATIONS_DB);
        localLocs = all.filter((l:any) => l.groupId === groupId);
        mergeAndEmit();
    }, 3000);

    const all = getLocal(MOCK_STORAGE_KEYS.LOCATIONS_DB);
    localLocs = all.filter((l:any) => l.groupId === groupId);
    mergeAndEmit();

    return () => {
        unsubRemote();
        clearInterval(interval);
    };
};

export const logActivityToFirestore = async (groupId: string, log: ActivityLog) => {
    forceSaveToLocalLog(groupId, log);

    if(db && !isMockMode) {
        try {
            await setDoc(doc(db, "activity_logs", log.id), { ...log, groupId });
        } catch (e) {
            console.warn("Firestore save failed", e);
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
