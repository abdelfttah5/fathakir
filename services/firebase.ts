
import { db, auth, isMockMode } from "../firebaseConfig";
import { 
  collection, doc, setDoc, getDoc, updateDoc, deleteDoc,
  query, where, getDocs, onSnapshot, orderBy, limit 
} from "firebase/firestore";
import { 
  createUserWithEmailAndPassword, signInWithEmailAndPassword, 
  signOut, updateProfile, sendPasswordResetEmail, signInAnonymously,
  onAuthStateChanged
} from "firebase/auth";
import { User, Group, ActivityLog, LocationPoint } from "../types";

// ==========================================
// MOCK IMPLEMENTATION (LocalStorage)
// ==========================================

const MOCK_STORAGE_KEYS = {
  USER: 'fathakkir_session_user',
  USERS_DB: 'f_users',
  GROUPS_DB: 'f_groups',
  MEMBERS_DB: 'f_members',
  LOGS_DB: 'f_logs',
  LOCATIONS_DB: 'f_locations'
};

// Mock Auth Observers
let mockAuthListeners: ((user: any | null) => void)[] = [];

const mockNotifyAuth = (user: any | null) => {
  mockAuthListeners.forEach(cb => cb(user));
};

const getLocal = (key: string) => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : [];
  } catch (e) {
    console.error(`Error parsing local storage for key ${key}`, e);
    return [];
  }
};

const setLocal = (key: string, data: any) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error(`Error saving to local storage for key ${key}`, e);
  }
};

// Helper to Force Save to Local Storage (Fallback Mechanism)
const forceSaveToLocalLog = (groupId: string, log: ActivityLog) => {
    let logs = getLocal(MOCK_STORAGE_KEYS.LOGS_DB);
    if (!Array.isArray(logs)) logs = [];
    const logWithGroup = { ...log, groupId };
    const exists = logs.findIndex((l: any) => l.id === log.id);
    if (exists > -1) {
        logs[exists] = logWithGroup;
    } else {
        logs.push(logWithGroup);
    }
    setLocal(MOCK_STORAGE_KEYS.LOGS_DB, logs);
};

// Helper to seed group from URL (Radical Fix for Joining)
export const seedLocalGroup = (groupData: Group) => {
  if (!groupData || !groupData.id) return;
  const groups = getLocal(MOCK_STORAGE_KEYS.GROUPS_DB);
  const exists = groups.find((g: Group) => g.id === groupData.id);
  if (!exists) {
    groups.push(groupData);
    setLocal(MOCK_STORAGE_KEYS.GROUPS_DB, groups);
    console.log("Group seeded locally from URL data");
  }
};

// ==========================================
// AUTH SERVICES
// ==========================================

export const observeAuthState = (callback: (user: any | null) => void) => {
  if (isMockMode) {
    const stored = localStorage.getItem(MOCK_STORAGE_KEYS.USER);
    if (stored) {
      try { callback(JSON.parse(stored)); } catch { callback(null); }
    } else {
      callback(null);
    }
    mockAuthListeners.push(callback);
    return () => { mockAuthListeners = mockAuthListeners.filter(l => l !== callback); };
  } else {
    // Real Firebase - Safety check for auth
    if (!auth) {
        console.warn("Auth object is undefined, falling back to mock behavior to prevent crash.");
        callback(null);
        return () => {};
    }
    return onAuthStateChanged(auth, callback);
  }
};

export const registerUser = async (email: string, pass: string, name: string): Promise<User> => {
  if (isMockMode || !auth) {
    const id = 'user_' + Date.now();
    const newUser: User = {
      id, name, email, isAdmin: false,
      privacySettings: { showDetails: false, shareLocation: false }
    };
    const users = getLocal(MOCK_STORAGE_KEYS.USERS_DB);
    users.push(newUser);
    setLocal(MOCK_STORAGE_KEYS.USERS_DB, users);
    const sessionUser = { uid: id, displayName: name, email };
    localStorage.setItem(MOCK_STORAGE_KEYS.USER, JSON.stringify(sessionUser));
    mockNotifyAuth(sessionUser);
    return newUser;
  }

  // Real Firebase
  const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
  const fbUser = userCredential.user;
  if (fbUser) {
    await updateProfile(fbUser, { displayName: name });
    const newUser: User = {
      id: fbUser.uid, name: name, email: email, isAdmin: false,
      privacySettings: { showDetails: false, shareLocation: false }
    };
    await setDoc(doc(db, "users", fbUser.uid), newUser);
    return newUser;
  }
  throw new Error("Registration failed");
};

export const loginUser = async (email: string, pass: string): Promise<User> => {
  if (isMockMode || !auth) {
    const users = getLocal(MOCK_STORAGE_KEYS.USERS_DB);
    const found = users.find((u: User) => u.email === email);
    if (found) {
      const sessionUser = { uid: found.id, displayName: found.name, email };
      localStorage.setItem(MOCK_STORAGE_KEYS.USER, JSON.stringify(sessionUser));
      mockNotifyAuth(sessionUser);
      return found;
    }
    throw new Error("auth/user-not-found");
  }

  // Real Firebase
  const userCredential = await signInWithEmailAndPassword(auth, email, pass);
  const fbUser = userCredential.user;
  if (!fbUser) throw new Error("Login failed");
  const userDoc = await getDoc(doc(db, "users", fbUser.uid));
  if (userDoc.exists()) {
    return userDoc.data() as User;
  } else {
    return {
      id: fbUser.uid, name: fbUser.displayName || 'مستخدم', email: fbUser.email || '', isAdmin: false,
      privacySettings: { showDetails: false, shareLocation: false }
    };
  }
};

export const loginGuestUser = async (customName?: string): Promise<User> => {
  if (isMockMode || !auth) {
    const id = 'guest_' + Date.now();
    const name = customName || `زائر ${id.substring(6, 10)}`;
    const newUser: User = {
      id, name, email: '', isAdmin: false,
      privacySettings: { showDetails: false, shareLocation: false }
    };
    const users = getLocal(MOCK_STORAGE_KEYS.USERS_DB);
    users.push(newUser);
    setLocal(MOCK_STORAGE_KEYS.USERS_DB, users);
    const sessionUser = { uid: id, displayName: name, email: '' };
    localStorage.setItem(MOCK_STORAGE_KEYS.USER, JSON.stringify(sessionUser));
    mockNotifyAuth(sessionUser);
    return newUser;
  }

  // Real Firebase
  try {
    const userCredential = await signInAnonymously(auth);
    const fbUser = userCredential.user;
    if (fbUser) {
      const guestName = customName || `زائر ${fbUser.uid.substring(0, 4)}`;
      try { await updateProfile(fbUser, { displayName: guestName }); } catch(e) {}
      const newUser: User = {
        id: fbUser.uid, name: guestName, email: '', isAdmin: false,
        privacySettings: { showDetails: false, shareLocation: false }
      };
      const userDoc = await getDoc(doc(db, "users", fbUser.uid));
      // Always update/set doc to ensure name is current
      await setDoc(doc(db, "users", fbUser.uid), newUser, { merge: true });
      return newUser;
    }
    throw new Error("Guest login failed");
  } catch (error) {
    console.error("Firebase Guest Login Error", error);
    const id = 'guest_' + Date.now();
    const name = customName || `زائر (غير متصل)`;
    const newUser: User = {
      id, name, email: '', isAdmin: false, isGuest: true,
      privacySettings: { showDetails: false, shareLocation: false }
    };
    const sessionUser = { uid: id, displayName: name, email: '', isAnonymous: true };
    localStorage.setItem(MOCK_STORAGE_KEYS.USER, JSON.stringify(sessionUser));
    return newUser;
  }
};

export const logoutUser = async () => {
  if (isMockMode || !auth) {
    localStorage.removeItem(MOCK_STORAGE_KEYS.USER);
    mockNotifyAuth(null);
    return;
  }
  try {
    await signOut(auth);
  } catch (e) {
    console.error(e);
    localStorage.removeItem(MOCK_STORAGE_KEYS.USER);
  }
};

export const resetPassword = async (email: string) => {
  if (isMockMode || !auth) return;
  await sendPasswordResetEmail(auth, email);
};

export const getUserGroup = async (userId: string): Promise<Group | null> => {
  if (isMockMode) {
    const members = getLocal(MOCK_STORAGE_KEYS.MEMBERS_DB);
    const membership = members.find((m: any) => m.userId === userId);
    if (membership) {
      const groups = getLocal(MOCK_STORAGE_KEYS.GROUPS_DB);
      return groups.find((g: Group) => g.id === membership.groupId) || null;
    }
    return null;
  }

  try {
    const q = query(collection(db, "group_members"), where("userId", "==", userId));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const memberData = querySnapshot.docs[0].data();
      const groupId = memberData.groupId;
      const groupDoc = await getDoc(doc(db, "groups", groupId));
      if (groupDoc.exists()) {
        return groupDoc.data() as Group;
      }
    }
    return null;
  } catch (e) {
    console.warn("Error fetching group, falling back to local check", e);
    const members = getLocal(MOCK_STORAGE_KEYS.MEMBERS_DB);
    const membership = members.find((m: any) => m.userId === userId);
    if (membership) {
      const groups = getLocal(MOCK_STORAGE_KEYS.GROUPS_DB);
      return groups.find((g: Group) => g.id === membership.groupId) || null;
    }
    return null;
  }
};

// ==========================================
// GROUP SERVICES
// ==========================================

const cleanUndefined = (obj: any) => {
  const newObj: any = {};
  Object.keys(obj).forEach(key => {
    if (obj[key] !== undefined) newObj[key] = obj[key];
  });
  return newObj;
};

export const createGroupInFirestore = async (groupData: Group, creator: User) => {
  // Always save locally first for resilience
  const groups = getLocal(MOCK_STORAGE_KEYS.GROUPS_DB);
  const groupWithAdmin = { ...groupData, adminId: creator.id };
  groups.push(groupWithAdmin);
  setLocal(MOCK_STORAGE_KEYS.GROUPS_DB, groups);
  const members = getLocal(MOCK_STORAGE_KEYS.MEMBERS_DB);
  const memberData = { ...creator, userId: creator.id, groupId: groupData.id, joinedAt: Date.now() };
  members.push(memberData);
  setLocal(MOCK_STORAGE_KEYS.MEMBERS_DB, members);

  if (isMockMode) return true;

  try {
    await setDoc(doc(db, "groups", groupData.id), cleanUndefined(groupWithAdmin));
    await setDoc(doc(db, "group_members", `${groupData.id}_${creator.id}`), cleanUndefined(memberData));
    await updateDoc(doc(db, "users", creator.id), { isAdmin: true });
    return true;
  } catch (error) {
    console.error("Error creating group in Firestore, but saved locally:", error);
    return true;
  }
};

export const updateGroupCode = async (groupId: string, newCode: string) => {
    // 1. Mock Update
    const groups = getLocal(MOCK_STORAGE_KEYS.GROUPS_DB);
    const idx = groups.findIndex((g: Group) => g.id === groupId);
    if (idx > -1) {
        groups[idx].inviteCode = newCode;
        setLocal(MOCK_STORAGE_KEYS.GROUPS_DB, groups);
    }

    if (isMockMode) return;

    // 2. Real Update
    try {
        await updateDoc(doc(db, "groups", groupId), { inviteCode: newCode });
    } catch (e) {
        console.error("Failed to update group code in Firestore", e);
    }
};

export const joinGroupInFirestore = async (inviteCode: string, user: User): Promise<Group | null> => {
  // FIX: Force persistence of membership even in Hybrid mode to ensure "My Group" UI updates instantly
  const localGroups = getLocal(MOCK_STORAGE_KEYS.GROUPS_DB) || [];
  const localGroup = localGroups.find((g: Group) => g.inviteCode === inviteCode.trim());
  
  // Logic to add member locally if group is found locally
  if (localGroup) {
      const members = getLocal(MOCK_STORAGE_KEYS.MEMBERS_DB);
      const existing = members.find((m: any) => m.userId === user.id && m.groupId === localGroup.id);
      if (!existing) {
          members.push({ ...user, userId: user.id, groupId: localGroup.id, joinedAt: Date.now() });
          setLocal(MOCK_STORAGE_KEYS.MEMBERS_DB, members);
      }
  }

  // If in Mock Mode, return local success immediately
  if (isMockMode) {
      if (localGroup) return localGroup;
      throw new Error("رمز الدعوة غير صحيح");
  }

  // Real Firestore Logic
  try {
    const q = query(collection(db, "groups"), where("inviteCode", "==", inviteCode.trim()));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      // Fallback: If found locally but not on server (sync issue), return local
      if (localGroup) return localGroup;
      throw new Error("رمز الدعوة غير صحيح أو المجموعة غير موجودة");
    }
    
    const groupData = querySnapshot.docs[0].data() as Group;
    
    // CRITICAL FIX: Ensure we use the correct ID with optional chaining for auth
    const currentAuthId = auth?.currentUser?.uid || user.id;
    
    const memberData = { 
      id: currentAuthId,
      name: user.name, 
      email: user.email || '',
      isAdmin: false,
      isGuest: user.isGuest || false,
      userId: currentAuthId, 
      groupId: groupData.id, 
      joinedAt: Date.now() 
    };

    // Save to Firestore
    await setDoc(doc(db, "group_members", `${groupData.id}_${currentAuthId}`), cleanUndefined(memberData));
    
    // Also Force Save to Local Storage to ensure immediate UI update before listener fires
    const members = getLocal(MOCK_STORAGE_KEYS.MEMBERS_DB);
    const existing = members.find((m: any) => m.userId === currentAuthId && m.groupId === groupData.id);
    if (!existing) {
        members.push({ ...memberData, userId: currentAuthId, groupId: groupData.id });
        setLocal(MOCK_STORAGE_KEYS.MEMBERS_DB, members);
    }

    return groupData;
  } catch (error: any) {
    console.error("Error joining group in Firestore:", error);
    // If we have local success, don't block user
    if (localGroup) return localGroup;
    throw new Error("تعذر الانضمام للمجموعة. تأكد من صحة الرمز أو اتصال الإنترنت.");
  }
};

export const leaveGroupInFirestore = async (userId: string, groupId: string) => {
  // 1. Remove from Mock DB
  const members = getLocal(MOCK_STORAGE_KEYS.MEMBERS_DB);
  const newMembers = members.filter((m: any) => !(m.userId === userId && m.groupId === groupId));
  setLocal(MOCK_STORAGE_KEYS.MEMBERS_DB, newMembers);
  
  if (isMockMode) return true;

  // 2. Remove from Real Firestore
  try {
    await deleteDoc(doc(db, "group_members", `${groupId}_${userId}`));
    return true;
  } catch (e) {
    console.error("Error leaving group in Firestore:", e);
    return false;
  }
};

// ==========================================
// REAL-TIME LISTENERS
// ==========================================

export const subscribeToMembers = (groupId: string, callback: (members: User[]) => void) => {
  const fetchLocal = () => {
      const allMembers = getLocal(MOCK_STORAGE_KEYS.MEMBERS_DB);
      const groupMembers = allMembers.filter((m: any) => m.groupId === groupId);
      if (groupMembers.length > 0) callback(groupMembers);
  };

  if (isMockMode) {
    fetchLocal();
    const interval = setInterval(fetchLocal, 3000);
    return () => clearInterval(interval);
  }

  try {
    const q = query(collection(db, "group_members"), where("groupId", "==", groupId));
    return onSnapshot(q, (snapshot) => {
      const members: User[] = [];
      snapshot.forEach((doc) => members.push(doc.data() as User));
      callback(members);
    }, (error) => {
      console.warn("Firestore Members Subscription failed, using local", error);
      fetchLocal();
    });
  } catch (e) {
    fetchLocal();
    return () => {};
  }
};

export const subscribeToLogs = (groupId: string, callback: (logs: ActivityLog[]) => void) => {
  const fetchLocal = () => {
      let allLogs = getLocal(MOCK_STORAGE_KEYS.LOGS_DB);
      if (!Array.isArray(allLogs)) allLogs = [];
      
      const groupLogs = allLogs
        .filter((l: any) => l.groupId === groupId)
        .sort((a: ActivityLog, b: ActivityLog) => b.timestamp - a.timestamp)
        .slice(0, 300); // Increased local limit too
      
      callback(groupLogs);
  };

  if (isMockMode) {
    fetchLocal();
    const interval = setInterval(fetchLocal, 1000);
    return () => clearInterval(interval);
  }

  try {
    const q = query(
      collection(db, "activity_logs"), 
      where("groupId", "==", groupId), 
      orderBy("timestamp", "desc"), 
      limit(300) // INCREASED LIMIT FROM 50 TO 300
    );
    return onSnapshot(q, (snapshot) => {
      const logs: ActivityLog[] = [];
      snapshot.forEach((doc) => logs.push(doc.data() as ActivityLog));
      callback(logs);
    }, (error) => {
      // REMOVED: Aggressive setInterval fallback which caused flickering ("coming and going")
      console.warn("Firestore logs subscription error:", error);
      // Try local once, but don't loop it to avoid race conditions
      fetchLocal();
    });
  } catch (e) {
    fetchLocal();
    return () => {};
  }
};

export const logActivityToFirestore = async (groupId: string, log: ActivityLog) => {
  forceSaveToLocalLog(groupId, log);

  if (isMockMode) return;

  try {
    const logWithGroup = { ...log, groupId };
    await setDoc(doc(db, "activity_logs", log.id), cleanUndefined(logWithGroup));
  } catch (e) {
    console.error("Failed to write log to Firestore. Data saved locally only.", e);
  }
};

export const updateLocationInFirestore = async (groupId: string, point: LocationPoint) => {
  const locs = getLocal(MOCK_STORAGE_KEYS.LOCATIONS_DB);
  const filtered = locs.filter((p: any) => p.userId !== point.userId);
  filtered.push({ ...point, groupId });
  setLocal(MOCK_STORAGE_KEYS.LOCATIONS_DB, filtered);

  if (isMockMode) return;

  try {
    await setDoc(doc(db, "locations", point.userId), { ...point, groupId });
  } catch (e) {
    console.warn("Location update failed remote", e);
  }
};

export const subscribeToLocations = (groupId: string, callback: (points: LocationPoint[]) => void) => {
  const fetchLocal = () => {
      const allLocs = getLocal(MOCK_STORAGE_KEYS.LOCATIONS_DB);
      const groupLocs = allLocs.filter((l: any) => l.groupId === groupId);
      callback(groupLocs);
  };

  if (isMockMode) {
    fetchLocal();
    const interval = setInterval(fetchLocal, 3000);
    return () => clearInterval(interval);
  }

  try {
    const q = query(collection(db, "locations"), where("groupId", "==", groupId));
    return onSnapshot(q, (snapshot) => {
      const points: LocationPoint[] = [];
      snapshot.forEach((doc) => points.push(doc.data() as LocationPoint));
      callback(points);
    }, () => fetchLocal());
  } catch(e) {
    fetchLocal();
    return () => {};
  }
};
