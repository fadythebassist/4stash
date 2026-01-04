import { initializeApp, FirebaseApp } from 'firebase/app';
import { 
  getAuth, 
  Auth, 
  signInWithPopup, 
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import { 
  getFirestore, 
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { Item, List, User, CreateItemDTO, UpdateItemDTO, CreateListDTO, UpdateListDTO } from '@/types';
import { StorageService } from './StorageService';

// Helper Functions (Module-level for reusability)
function extractYouTubeThumbnail(url: string): string | undefined {
  try {
    let videoId: string | null = null;
    
    // Add protocol if missing
    let fullUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      fullUrl = 'https://' + url;
    }
    
    // Extract video ID from various YouTube URL formats
    if (fullUrl.includes('youtube.com/watch')) {
      const urlObj = new URL(fullUrl);
      videoId = urlObj.searchParams.get('v');
    } else if (fullUrl.includes('youtu.be/')) {
      const match = fullUrl.match(/youtu\.be\/([^?&]+)/);
      videoId = match ? match[1] : null;
    } else if (fullUrl.includes('youtube.com/embed/')) {
      const match = fullUrl.match(/embed\/([^?&]+)/);
      videoId = match ? match[1] : null;
    }
    
    if (videoId) {
      // Return high-quality thumbnail
      return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    }
  } catch (err) {
    console.error('Failed to extract YouTube thumbnail:', err);
  }
  return undefined;
}

function detectContentType(url: string): { type: string; source?: string } {
  const urlLower = url.toLowerCase();
  
  // YouTube
  if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) {
    return { type: 'video', source: 'youtube' };
  }
  
  // Twitter/X
  if (urlLower.includes('twitter.com') || urlLower.includes('x.com')) {
    return { type: 'text', source: 'twitter' };
  }
  
  // TikTok
  if (urlLower.includes('tiktok.com')) {
    return { type: 'video', source: 'tiktok' };
  }
  
  // Instagram
  if (urlLower.includes('instagram.com')) {
    return { type: 'image', source: 'instagram' };
  }

  // Reddit
  if (urlLower.includes('reddit.com') || urlLower.includes('redd.it')) {
    return { type: 'link', source: 'reddit' };
  }

  // Facebook
  if (urlLower.includes('facebook.com') || urlLower.includes('fb.watch')) {
    const isVideo =
      urlLower.includes('fb.watch') ||
      urlLower.includes('/watch') ||
      urlLower.includes('/videos') ||
      urlLower.includes('/reel') ||
      urlLower.includes('/share/v/') ||
      urlLower.includes('/share/r/');
    return { type: isVideo ? 'video' : 'link', source: 'facebook' };
  }
  
  // Image extensions
  if (/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url)) {
    return { type: 'image' };
  }
  
  // Video extensions
  if (/\.(mp4|webm|ogg|mov)$/i.test(url)) {
    return { type: 'video' };
  }
  
  return { type: 'link', source: 'other' };
}

// Firebase configuration - Replace with your actual config
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

/**
 * FirebaseStorageService - Production storage implementation
 * To use this instead of MockStorageService:
 * 1. Add your Firebase config above
 * 2. In AuthContext.tsx and DataContext.tsx, change the import:
 *    from: import { mockStorageService } from '@/services/MockStorageService';
 *    to: import { firebaseStorageService } from '@/services/FirebaseStorageService';
 * 3. Change: const storageService: StorageService = mockStorageService;
 *    to: const storageService: StorageService = firebaseStorageService;
 */
export class FirebaseStorageService implements StorageService {
  private app: FirebaseApp;
  private auth: Auth;
  private db: Firestore;
  private googleProvider: GoogleAuthProvider;

  constructor() {
    this.app = initializeApp(firebaseConfig);
    this.auth = getAuth(this.app);
    this.db = getFirestore(this.app);
    this.googleProvider = new GoogleAuthProvider();
  }

  // Authentication Methods
  async signInWithGoogle(): Promise<User> {
    const result = await signInWithPopup(this.auth, this.googleProvider);
    const firebaseUser = result.user;
    
    const user: User = {
      id: firebaseUser.uid,
      email: firebaseUser.email!,
      displayName: firebaseUser.displayName || undefined,
      photoURL: firebaseUser.photoURL || undefined,
      createdAt: new Date(firebaseUser.metadata.creationTime!),
      provider: 'google'
    };

    // Create default lists for new users
    const listsSnapshot = await getDocs(
      query(collection(this.db, 'lists'), where('userId', '==', user.id))
    );
    
    if (listsSnapshot.empty) {
      await this.createList(user.id, { name: 'Quick Bin', icon: '📥' });
      await this.createList(user.id, { name: 'Favorites', icon: '⭐' });
    }

    return user;
  }

  async signInWithEmail(email: string, password: string): Promise<User> {
    const result = await signInWithEmailAndPassword(this.auth, email, password);
    const firebaseUser = result.user;
    
    return {
      id: firebaseUser.uid,
      email: firebaseUser.email!,
      displayName: firebaseUser.displayName || undefined,
      photoURL: firebaseUser.photoURL || undefined,
      createdAt: new Date(firebaseUser.metadata.creationTime!),
      provider: 'email'
    };
  }

  async signUpWithEmail(email: string, password: string, displayName?: string): Promise<User> {
    const result = await createUserWithEmailAndPassword(this.auth, email, password);
    const firebaseUser = result.user;
    
    if (displayName) {
      await updateProfile(firebaseUser, { displayName });
    }

    const user: User = {
      id: firebaseUser.uid,
      email: firebaseUser.email!,
      displayName: displayName,
      createdAt: new Date(),
      provider: 'email'
    };

    // Create default lists
    await this.createList(user.id, { name: 'Quick Bin', icon: '📥' });
    await this.createList(user.id, { name: 'Favorites', icon: '⭐' });

    return user;
  }

  async signOut(): Promise<void> {
    await firebaseSignOut(this.auth);
  }

  async getCurrentUser(): Promise<User | null> {
    return new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(this.auth, (firebaseUser) => {
        unsubscribe();
        if (firebaseUser) {
          resolve({
            id: firebaseUser.uid,
            email: firebaseUser.email!,
            displayName: firebaseUser.displayName || undefined,
            photoURL: firebaseUser.photoURL || undefined,
            createdAt: new Date(firebaseUser.metadata.creationTime!),
            provider: firebaseUser.providerData[0]?.providerId === 'google.com' ? 'google' : 'email'
          });
        } else {
          resolve(null);
        }
      });
    });
  }

  // Lists Methods
  async getLists(userId: string): Promise<List[]> {
    const q = query(
      collection(this.db, 'lists'),
      where('userId', '==', userId),
      orderBy('createdAt', 'asc')
    );
    
    const snapshot = await getDocs(q);
    const lists = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt.toDate(),
      updatedAt: doc.data().updatedAt.toDate()
    })) as List[];

    // Get item counts
    for (const list of lists) {
      const itemsQuery = query(
        collection(this.db, 'items'),
        where('listId', '==', list.id),
        where('archived', '==', false)
      );
      const itemsSnapshot = await getDocs(itemsQuery);
      list.itemCount = itemsSnapshot.size;
    }

    return lists;
  }

  async getList(listId: string): Promise<List | null> {
    const docRef = doc(this.db, 'lists', listId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) return null;
    
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      createdAt: data.createdAt.toDate(),
      updatedAt: data.updatedAt.toDate()
    } as List;
  }

  async createList(userId: string, data: CreateListDTO): Promise<List> {
    const listData = {
      name: data.name,
      userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      color: data.color,
      icon: data.icon
    };

    const docRef = await addDoc(collection(this.db, 'lists'), listData);
    const docSnap = await getDoc(docRef);
    const savedData = docSnap.data()!;

    return {
      id: docRef.id,
      ...savedData,
      createdAt: savedData.createdAt.toDate(),
      updatedAt: savedData.updatedAt.toDate()
    } as List;
  }

  async updateList(data: UpdateListDTO): Promise<void> {
    const docRef = doc(this.db, 'lists', data.id);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp()
    });
  }

  async deleteList(listId: string): Promise<void> {
    // Delete the list
    await deleteDoc(doc(this.db, 'lists', listId));
    
    // Delete all items in the list
    const itemsQuery = query(
      collection(this.db, 'items'),
      where('listId', '==', listId)
    );
    const itemsSnapshot = await getDocs(itemsQuery);
    
    const deletePromises = itemsSnapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
  }

  // Items Methods
  async getItems(userId: string, listId?: string): Promise<Item[]> {
    let q = query(
      collection(this.db, 'items'),
      where('userId', '==', userId),
      where('archived', '==', false),
      orderBy('createdAt', 'desc')
    );

    if (listId) {
      q = query(
        collection(this.db, 'items'),
        where('userId', '==', userId),
        where('listId', '==', listId),
        where('archived', '==', false),
        orderBy('createdAt', 'desc')
      );
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt.toDate(),
      updatedAt: doc.data().updatedAt.toDate()
    })) as Item[];
  }

  async getItem(itemId: string): Promise<Item | null> {
    const docRef = doc(this.db, 'items', itemId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) return null;
    
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      createdAt: data.createdAt.toDate(),
      updatedAt: data.updatedAt.toDate()
    } as Item;
  }

  async createItem(userId: string, data: CreateItemDTO): Promise<Item> {
    // Auto-detect content type and source if URL provided
    let detectedInfo: { type: Item['type']; source?: Item['source'] } = {
      type: data.type,
      source: typeof data.source === 'string' ? (data.source as Item['source']) : undefined
    };
    let thumbnail = data.thumbnail;
    
    if (data.url) {
      const detected = detectContentType(data.url);
      detectedInfo = {
        type: detected.type as Item['type'],
        source: detected.source as Item['source']
      };
      
      // Extract YouTube thumbnail if not provided
      if (detected.source === 'youtube' && !thumbnail) {
        thumbnail = extractYouTubeThumbnail(data.url);
      }
    }

    const itemData = {
      type: detectedInfo.type,
      title: data.title,
      url: data.url,
      content: data.content,
      thumbnail: thumbnail,
      listId: data.listId,
      userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      tags: data.tags || [],
      source: detectedInfo.source,
      archived: false
    };

    const docRef = await addDoc(collection(this.db, 'items'), itemData);
    const docSnap = await getDoc(docRef);
    const savedData = docSnap.data()!;

    return {
      id: docRef.id,
      ...savedData,
      createdAt: savedData.createdAt.toDate(),
      updatedAt: savedData.updatedAt.toDate()
    } as Item;
  }

  async updateItem(data: UpdateItemDTO): Promise<void> {
    const docRef = doc(this.db, 'items', data.id);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp()
    });
  }

  async deleteItem(itemId: string): Promise<void> {
    await deleteDoc(doc(this.db, 'items', itemId));
  }

  async archiveItem(itemId: string): Promise<void> {
    const docRef = doc(this.db, 'items', itemId);
    await updateDoc(docRef, {
      archived: true,
      updatedAt: serverTimestamp()
    });
  }

  // Utility Methods (delegates to module-level functions)
  detectContentType(url: string): { type: string; source?: string } {
    return detectContentType(url);
  }
}

// Export singleton instance
export const firebaseStorageService = new FirebaseStorageService();
