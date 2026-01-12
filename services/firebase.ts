
import { db, auth, isMockMode } from "../firebaseConfig";
import { 
  collection, doc, setDoc, getDoc, updateDoc, 
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

// ==========================================
// AUTH SERVICES
// ==========================================

export const observeAuthState = (callback: (user: any | null) => void) => {
  if (isMockMode) {
    // Check session
    const stored = localStorage.getItem(MOCK_STORAGE_KEYS.USER);
    if (stored) {
      try {
        callback(JSON.parse(stored));
      } catch {
        callback(null);
      }
    } else {
      callback(null);
    }
    mockAuthListeners.push(callback);
    return () => {
      mockAuthListeners = mockAuthListeners.filter(l => l !== callback);
    };
  } else {
    // Real Firebase
    return onAuthStateChanged(auth, callback);
  }
};

export const registerUser = async (email: string, pass: string, name: string): Promise<User> => {
  if (isMockMode) {
    const id = 'user_' + Date.now();
    const newUser: User = {
      id,
      name,
      email,
      isAdmin: false,
      privacySettings: { showDetails: false, shareLocation: false }
    };
    
    // Save to DB
    const users = getLocal(MOCK_STORAGE_KEYS.USERS_DB);
    users.push(newUser);
    setLocal(MOCK_STORAGE_KEYS.USERS_DB, users);

    // Save Session
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
      id: fbUser.uid,
      name: name,
      email: email,
      isAdmin: false,
      privacySettings: { showDetails: false, shareLocation: false }
    };
    await setDoc(doc(db, "users", fbUser.uid), newUser);
    return newUser;
  }
  throw new Error("Registration failed");
};

export const loginUser = async (email: string, pass: string): Promise<User> => {
  if (isMockMode) {
    // Simple Mock Login (Accepts any password for existing email)
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
      id: fbUser.uid,
      name: fbUser.displayName || 'مستخدم',
      email: fbUser.email || '',
      isAdmin: false,
      privacySettings: { showDetails: false, shareLocation: false }
    };
  }
};

export const loginGuestUser = async (): Promise<User> => {
  if (isMockMode) {
    const id = 'guest_' + Date.now();
    const name = `زائر ${id.substring(6, 10)}`;
    const newUser: User = {
      id,
      name,
      email: '',
      isAdmin: false,
      privacySettings: { showDetails: false, shareLocation: false }
    };
    
    // Save to DB
    const users = getLocal(MOCK_STORAGE_KEYS.USERS_DB);
    users.push(newUser);
    setLocal(MOCK_STORAGE_KEYS.USERS_DB, users);

    // Save Session
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
      const guestName = `زائر ${fbUser.uid.substring(0, 4)}`;
      try { await updateProfile(fbUser, { displayName: guestName }); } catch(e) {}
      const newUser: User = {
        id: fbUser.uid,
        name: guestName,
        email: '', 
        isAdmin: false,
        privacySettings: { showDetails: false, shareLocation: false }
      };
      const userDoc = await getDoc(doc(db, "users", fbUser.uid));
      if (!userDoc.exists()) {
        await setDoc(doc(db, "users", fbUser.uid), newUser);
        return newUser;
      } else {
        return userDoc.data() as User;
      }
    }
    throw new Error("Guest login failed");
  } catch (error) {
    console.error(error);
    throw error;
  }
};

export const logoutUser = async () => {
  if (isMockMode) {
    localStorage.removeItem(MOCK_STORAGE_KEYS.USER);
    mockNotifyAuth(null);
    return;
  }
  await signOut(auth);
};

export const resetPassword = async (email: string) => {
  if (isMockMode) return;
  await sendPasswordResetEmail(auth, email);
};

export const getUserGroup = async (userId: string): Promise<Group | null> => {
  if (isMockMode) {
    const members = getLocal(MOCK_STORAGE_KEYS.MEMBERS_DB);
    const membership = members.find((m: any) => m.userId === userId);
    if (membership) {
      const groups = getLocal(MOCK_STORAGE_KEYS.GROUPS_DB);
      const group = groups.find((g: Group) => g.id === membership.groupId);
      return group || null;
    }
    return null;
  }

  // Real Firebase
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
  if (isMockMode) {
    // Save Group
    const groups = getLocal(MOCK_STORAGE_KEYS.GROUPS_DB);
    const groupWithAdmin = { ...groupData, adminId: creator.id };
    groups.push(groupWithAdmin);
    setLocal(MOCK_STORAGE_KEYS.GROUPS_DB, groups);

    // Save Member
    const members = getLocal(MOCK_STORAGE_KEYS.MEMBERS_DB);
    const memberData = { ...creator, userId: creator.id, groupId: groupData.id, joinedAt: Date.now() };
    members.push(memberData);
    setLocal(MOCK_STORAGE_KEYS.MEMBERS_DB, members);
    
    return true;
  }

  // Real Firebase
  try {
    const groupWithAdmin = { ...groupData, adminId: creator.id };
    await setDoc(doc(db, "groups", groupData.id), cleanUndefined(groupWithAdmin));
    const memberData = {
      ...creator,
      userId: creator.id, 
      groupId: groupData.id,
      joinedAt: Date.now()
    };
    await setDoc(doc(db, "group_members", `${groupData.id}_${creator.id}`), cleanUndefined(memberData));
    await updateDoc(doc(db, "users", creator.id), { isAdmin: true });
    return true;
  } catch (error) {
    console.error("Error creating group:", error);
    throw error;
  }
};

export const joinGroupInFirestore = async (inviteCode: string, user: User): Promise<Group | null> => {
  if (isMockMode) {
    const groups = getLocal(MOCK_STORAGE_KEYS.GROUPS_DB);
    const group = groups.find((g: Group) => g.inviteCode === inviteCode.trim());
    if (!group) throw new Error("رمز الدعوة غير صحيح");

    const members = getLocal(MOCK_STORAGE_KEYS.MEMBERS_DB);
    const memberData = { ...user, userId: user.id, groupId: group.id, joinedAt: Date.now() };
    members.push(memberData);
    setLocal(MOCK_STORAGE_KEYS.MEMBERS_DB, members);
    return group;
  }

  // Real Firebase
  try {
    const q = query(collection(db, "groups"), where("inviteCode", "==", inviteCode.trim()));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) throw new Error("رمز الدعوة غير صحيح");

    const groupDoc = querySnapshot.docs[0];
    const groupData = groupDoc.data() as Group;

    const memberData = {
      ...user,
      userId: user.id, 
      groupId: groupData.id,
      joinedAt: Date.now()
    };
    await setDoc(doc(db, "group_members", `${groupData.id}_${user.id}`), cleanUndefined(memberData));
    return groupData;
  } catch (error) {
    console.error("Error joining group:", error);
    throw error;
  }
};

// ==========================================
// REAL-TIME LISTENERS
// ==========================================

export const subscribeToMembers = (groupId: string, callback: (members: User[]) => void) => {
  if (isMockMode) {
    const fetch = () => {
      const allMembers = getLocal(MOCK_STORAGE_KEYS.MEMBERS_DB);
      const groupMembers = allMembers.filter((m: any) => m.groupId === groupId);
      callback(groupMembers);
    };
    fetch(); // Immediate call
    const interval = setInterval(fetch, 2000);
    return () => clearInterval(interval);
  }

  // Real Firebase
  const q = query(collection(db, "group_members"), where("groupId", "==", groupId));
  return onSnapshot(q, (snapshot) => {
    const members: User[] = [];
    snapshot.forEach((doc) => members.push(doc.data() as User));
    callback(members);
  });
};

export const subscribeToLogs = (groupId: string, callback: (logs: ActivityLog[]) => void) => {
  if (isMockMode) {
    const fetch = () => {
      let allLogs = getLocal(MOCK_STORAGE_KEYS.LOGS_DB);
      // Safety Check: If data corrupted, reset it
      if (!Array.isArray(allLogs)) {
        allLogs = [];
        setLocal(MOCK_STORAGE_KEYS.LOGS_DB, []);
      }
      
      const groupLogs = allLogs
        .filter((l: any) => l.groupId === groupId)
        .sort((a: ActivityLog, b: ActivityLog) => b.timestamp - a.timestamp)
        .slice(0, 50);
      callback(groupLogs);
    };
    fetch(); // Immediate call
    const interval = setInterval(fetch, 1000);
    return () => clearInterval(interval);
  }

  // Real Firebase
  const q = query(
    collection(db, "activity_logs"), 
    where("groupId", "==", groupId), 
    orderBy("timestamp", "desc"), 
    limit(50)
  );
  return onSnapshot(q, (snapshot) => {
    const logs: ActivityLog[] = [];
    snapshot.forEach((doc) => logs.push(doc.data() as ActivityLog));
    callback(logs);
  });
};

export const logActivityToFirestore = async (groupId: string, log: ActivityLog) => {
  if (isMockMode) {
    let logs = getLocal(MOCK_STORAGE_KEYS.LOGS_DB);
    if (!Array.isArray(logs)) {
      logs = []; // Safety reset
    }
    const logWithGroup = { ...log, groupId };
    logs.push(logWithGroup);
    setLocal(MOCK_STORAGE_KEYS.LOGS_DB, logs);
    return;
  }

  const logWithGroup = { ...log, groupId };
  await setDoc(doc(db, "activity_logs", log.id), cleanUndefined(logWithGroup));
};

export const updateLocationInFirestore = async (groupId: string, point: LocationPoint) => {
  if (isMockMode) {
    const locs = getLocal(MOCK_STORAGE_KEYS.LOCATIONS_DB);
    // Remove old point for user
    const filtered = locs.filter((p: any) => p.userId !== point.userId);
    filtered.push({ ...point, groupId });
    setLocal(MOCK_STORAGE_KEYS.LOCATIONS_DB, filtered);
    return;
  }

  await setDoc(doc(db, "locations", point.userId), {
    ...point,
    groupId
  });
};

export const subscribeToLocations = (groupId: string, callback: (points: LocationPoint[]) => void) => {
  if (isMockMode) {
    const fetch = () => {
      const allLocs = getLocal(MOCK_STORAGE_KEYS.LOCATIONS_DB);
      const groupLocs = allLocs.filter((l: any) => l.groupId === groupId);
      callback(groupLocs);
    };
    fetch(); // Immediate call
    const interval = setInterval(fetch, 2000);
    return () => clearInterval(interval);
  }

  const q = query(collection(db, "locations"), where("groupId", "==", groupId));
  return onSnapshot(q, (snapshot) => {
    const points: LocationPoint[] = [];
    snapshot.forEach((doc) => points.push(doc.data() as LocationPoint));
    callback(points);
  });
};
