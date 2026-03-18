import { initializeApp, FirebaseApp } from "firebase/app";
import {
  getAuth,
  Auth,
  signInWithPopup,
  GoogleAuthProvider,
  FacebookAuthProvider,
  TwitterAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
} from "firebase/auth";
import {
  getFirestore,
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import {
  Item,
  List,
  User,
  CreateItemDTO,
  UpdateItemDTO,
  CreateListDTO,
  UpdateListDTO,
  AppSettings,
} from "@/types";
import { StorageService } from "./StorageService";

// Helper Functions (Module-level for reusability)
function extractYouTubeThumbnail(url: string): string | undefined {
  try {
    let videoId: string | null = null;

    // Add protocol if missing
    let fullUrl = url;
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      fullUrl = "https://" + url;
    }

    // Extract video ID from various YouTube URL formats
    if (fullUrl.includes("youtube.com/watch")) {
      const urlObj = new URL(fullUrl);
      videoId = urlObj.searchParams.get("v");
    } else if (fullUrl.includes("youtu.be/")) {
      const match = fullUrl.match(/youtu\.be\/([^?&]+)/);
      videoId = match ? match[1] : null;
    } else if (fullUrl.includes("youtube.com/embed/")) {
      const match = fullUrl.match(/embed\/([^?&]+)/);
      videoId = match ? match[1] : null;
    }

    if (videoId) {
      // Return high-quality thumbnail
      return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    }
  } catch (err) {
    console.error("Failed to extract YouTube thumbnail:", err);
  }
  return undefined;
}

function detectContentType(url: string): { type: string; source?: string } {
  const urlLower = url.toLowerCase();

  // YouTube
  if (urlLower.includes("youtube.com") || urlLower.includes("youtu.be")) {
    return { type: "video", source: "youtube" };
  }

  // Twitter/X
  if (urlLower.includes("twitter.com") || urlLower.includes("x.com")) {
    return { type: "text", source: "twitter" };
  }

  // TikTok
  if (urlLower.includes("tiktok.com")) {
    return { type: "video", source: "tiktok" };
  }

  // Instagram
  if (urlLower.includes("instagram.com")) {
    return { type: "image", source: "instagram" };
  }

  // Reddit
  if (urlLower.includes("reddit.com") || urlLower.includes("redd.it")) {
    return { type: "link", source: "reddit" };
  }

  // Facebook
  if (urlLower.includes("facebook.com") || urlLower.includes("fb.watch")) {
    const isVideo =
      urlLower.includes("fb.watch") ||
      urlLower.includes("/watch") ||
      urlLower.includes("/videos") ||
      urlLower.includes("/reel") ||
      urlLower.includes("/share/v/") ||
      urlLower.includes("/share/r/");
    return { type: isVideo ? "video" : "link", source: "facebook" };
  }

  // Image extensions
  if (/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url)) {
    return { type: "image" };
  }

  // Video extensions
  if (/\.(mp4|webm|ogg|mov)$/i.test(url)) {
    return { type: "video" };
  }

  return { type: "link", source: "other" };
}

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Validate Firebase configuration
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error(
    "❌ Firebase configuration is missing! Please add Firebase credentials to your .env file.",
  );
  console.error("Required env variables:");
  console.error("  - VITE_FIREBASE_API_KEY");
  console.error("  - VITE_FIREBASE_AUTH_DOMAIN");
  console.error("  - VITE_FIREBASE_PROJECT_ID");
  console.error("  - VITE_FIREBASE_STORAGE_BUCKET");
  console.error("  - VITE_FIREBASE_MESSAGING_SENDER_ID");
  console.error("  - VITE_FIREBASE_APP_ID");
}

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
  private facebookProvider: FacebookAuthProvider;
  private twitterProvider: TwitterAuthProvider;

  constructor() {
    this.app = initializeApp(firebaseConfig);
    this.auth = getAuth(this.app);
    this.db = getFirestore(this.app);
    this.googleProvider = new GoogleAuthProvider();
    this.facebookProvider = new FacebookAuthProvider();
    this.twitterProvider = new TwitterAuthProvider();
  }

  // Helper Methods
  private async getUserPreferences(
    userId: string,
  ): Promise<{ avatarStyle?: string; settings?: AppSettings }> {
    try {
      const userDoc = await getDoc(doc(this.db, "users", userId));
      if (userDoc.exists()) {
        const data = userDoc.data();
        return {
          avatarStyle: data.avatarStyle,
          settings: data.settings,
        };
      }
    } catch (error) {
      console.error("Failed to get user preferences:", error);
    }
    return {};
  }

  private generateDiceBearUrl(
    userId: string,
    style: string = "lorelei",
  ): string {
    return `https://api.dicebear.com/7.x/${style}/svg?seed=${userId}`;
  }

  // Authentication Methods
  async signInWithGoogle(): Promise<User> {
    console.log("🔐 Starting Google sign-in...");

    try {
      const result = await signInWithPopup(this.auth, this.googleProvider);
      console.log("✅ Google popup authentication successful");

      const firebaseUser = result.user;
      console.log("👤 Firebase user:", firebaseUser.email);

      // Get user preferences (avatar style)
      const prefs = await this.getUserPreferences(firebaseUser.uid);

      // If user has chosen a DiceBear style, use that; otherwise use social photo or default
      const photoURL = prefs.avatarStyle
        ? this.generateDiceBearUrl(firebaseUser.uid, prefs.avatarStyle)
        : firebaseUser.photoURL ||
          this.generateDiceBearUrl(firebaseUser.uid, "lorelei");

      const user: User = {
        id: firebaseUser.uid,
        email: firebaseUser.email!,
        displayName: firebaseUser.displayName || undefined,
        photoURL,
        avatarStyle: prefs.avatarStyle,
        settings: prefs.settings,
        createdAt: new Date(firebaseUser.metadata.creationTime!),
        provider: "google",
      };

      // Create default lists for new users
      console.log("📋 Checking for existing lists...");
      const listsSnapshot = await getDocs(
        query(collection(this.db, "lists"), where("userId", "==", user.id)),
      );

      if (listsSnapshot.empty) {
        console.log("📝 Creating default lists...");
        await this.createList(user.id, { name: "Quick Bin", icon: "📥" });
        console.log("✅ Created Quick Bin list");
        await this.createList(user.id, { name: "Favorites", icon: "⭐" });
        console.log("✅ Created Favorites list");
      } else {
        console.log(`✅ User already has ${listsSnapshot.size} lists`);
      }

      console.log("✅ Sign-in complete, returning user");
      return user;
    } catch (error) {
      console.error("❌ Error during Google sign-in:", error);
      throw error;
    }
  }

  async signInWithFacebook(): Promise<User> {
    const result = await signInWithPopup(this.auth, this.facebookProvider);
    const firebaseUser = result.user;

    // Get user preferences (avatar style)
    const prefs = await this.getUserPreferences(firebaseUser.uid);

    // If user has chosen a DiceBear style, use that; otherwise use social photo or default
    const photoURL = prefs.avatarStyle
      ? this.generateDiceBearUrl(firebaseUser.uid, prefs.avatarStyle)
      : firebaseUser.photoURL ||
        this.generateDiceBearUrl(firebaseUser.uid, "lorelei");

    const user: User = {
      id: firebaseUser.uid,
      email: firebaseUser.email!,
      displayName: firebaseUser.displayName || undefined,
      photoURL,
      avatarStyle: prefs.avatarStyle,
      settings: prefs.settings,
      createdAt: new Date(firebaseUser.metadata.creationTime!),
      provider: "facebook",
    };

    // Create default lists for new users
    const listsSnapshot = await getDocs(
      query(collection(this.db, "lists"), where("userId", "==", user.id)),
    );

    if (listsSnapshot.empty) {
      await this.createList(user.id, { name: "Quick Bin", icon: "📥" });
      await this.createList(user.id, { name: "Favorites", icon: "⭐" });
    }

    return user;
  }

  async signInWithTwitter(): Promise<User> {
    const result = await signInWithPopup(this.auth, this.twitterProvider);
    const firebaseUser = result.user;

    // Get user preferences (avatar style)
    const prefs = await this.getUserPreferences(firebaseUser.uid);

    // If user has chosen a DiceBear style, use that; otherwise use social photo or default
    const photoURL = prefs.avatarStyle
      ? this.generateDiceBearUrl(firebaseUser.uid, prefs.avatarStyle)
      : firebaseUser.photoURL ||
        this.generateDiceBearUrl(firebaseUser.uid, "lorelei");

    const user: User = {
      id: firebaseUser.uid,
      email: firebaseUser.email || `${firebaseUser.uid}@twitter.placeholder`,
      displayName: firebaseUser.displayName || undefined,
      photoURL,
      settings: prefs.settings,
      avatarStyle: prefs.avatarStyle,
      createdAt: new Date(firebaseUser.metadata.creationTime!),
      provider: "twitter",
    };

    // Create default lists for new users
    const listsSnapshot = await getDocs(
      query(collection(this.db, "lists"), where("userId", "==", user.id)),
    );

    if (listsSnapshot.empty) {
      await this.createList(user.id, { name: "Quick Bin", icon: "📥" });
      await this.createList(user.id, { name: "Favorites", icon: "⭐" });
    }

    return user;
  }

  async signInWithEmail(email: string, password: string): Promise<User> {
    const result = await signInWithEmailAndPassword(this.auth, email, password);
    const firebaseUser = result.user;

    // Get user preferences (avatar style)
    const prefs = await this.getUserPreferences(firebaseUser.uid);

    // If user has chosen a DiceBear style, use that; otherwise use default
    const photoURL = prefs.avatarStyle
      ? this.generateDiceBearUrl(firebaseUser.uid, prefs.avatarStyle)
      : firebaseUser.photoURL ||
        this.generateDiceBearUrl(firebaseUser.uid, "lorelei");

    return {
      id: firebaseUser.uid,
      email: firebaseUser.email!,
      displayName: firebaseUser.displayName || undefined,
      photoURL,
      settings: prefs.settings,
      avatarStyle: prefs.avatarStyle,
      createdAt: new Date(firebaseUser.metadata.creationTime!),
      provider: "email",
    };
  }

  async signUpWithEmail(
    email: string,
    password: string,
    displayName?: string,
  ): Promise<User> {
    const result = await createUserWithEmailAndPassword(
      this.auth,
      email,
      password,
    );
    const firebaseUser = result.user;

    if (displayName) {
      await updateProfile(firebaseUser, { displayName });
    }

    const user: User = {
      id: firebaseUser.uid,
      email: firebaseUser.email!,
      displayName: displayName,
      settings: {
        theme: 'light',
        viewDensity: 'comfortable',
        layoutMode: 'grid',
        autoFetchMetadata: true,
        confirmDelete: true,
        thumbnailQuality: 'high',
        itemsPerPage: 24,
        showSourceBadges: true,
        moderationLevel: 'moderate',
        autoArchiveDays: 0,
      },
      photoURL: this.generateDiceBearUrl(firebaseUser.uid, "lorelei"),
      avatarStyle: "lorelei",
      createdAt: new Date(),
      provider: "email",
    };

    // Create default lists
    await this.createList(user.id, { name: "Quick Bin", icon: "📥" });
    await this.createList(user.id, { name: "Favorites", icon: "⭐" });

    return user;
  }

  async signOut(): Promise<void> {
    await firebaseSignOut(this.auth);
  }

  async getCurrentUser(): Promise<User | null> {
    return new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(
        this.auth,
        async (firebaseUser) => {
          unsubscribe();
          if (firebaseUser) {
            // Get user preferences (avatar style)
            const prefs = await this.getUserPreferences(firebaseUser.uid);

            // Get social connections (with fallback if collection doesn't exist yet)
            let socialConnections: import("@/types").SocialConnection[] = [];
            try {
              socialConnections = await this.getSocialConnections(firebaseUser.uid);
            } catch (error) {
              // If socialConnections collection doesn't exist or has permission issues,
              // just continue with empty array. User can set up connections later.
              console.warn("⚠️ Could not load social connections (this is normal if not set up yet):", error instanceof Error ? error.message : error);
            }

            // If user has chosen a DiceBear style, use that; otherwise use social photo or default
            const photoURL = prefs.avatarStyle
              ? this.generateDiceBearUrl(firebaseUser.uid, prefs.avatarStyle)
              : firebaseUser.photoURL ||
                this.generateDiceBearUrl(firebaseUser.uid, "lorelei");

            const user: User = {
              id: firebaseUser.uid,
              email: firebaseUser.email!,
              displayName: firebaseUser.displayName || undefined,
              photoURL,
              avatarStyle: prefs.avatarStyle,
              settings: prefs.settings,
              socialConnections,
              createdAt: new Date(firebaseUser.metadata.creationTime!),
              provider:
                firebaseUser.providerData[0]?.providerId === "google.com"
                  ? ("google" as const)
                  : ("email" as const),
            };
            console.log("👤 Current user:", user);
            resolve(user);
          } else {
            console.log("👤 No user authenticated");
            resolve(null);
          }
        },
      );
    });
  }

  async updateAvatarStyle(userId: string, style: string): Promise<void> {
    try {
      await setDoc(
        doc(this.db, "users", userId),
        { avatarStyle: style },
        { merge: true },
      );
      console.log(`✅ Avatar style updated to: ${style}`);
    } catch (error: unknown) {
      console.error("❌ Failed to update avatar style:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to update avatar style";
      throw new Error(errorMessage);
    }
  }

  async updateUserSettings(userId: string, settings: AppSettings): Promise<void> {
    try {
      await setDoc(
        doc(this.db, "users", userId),
        { settings },
        { merge: true },
      );
      console.log(`✅ User settings updated:`, settings);
    } catch (error: unknown) {
      console.error("❌ Failed to update user settings:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to update user settings";
      throw new Error(errorMessage);
    }
  }

  // Social Connections Methods
  async getSocialConnections(userId: string): Promise<import("@/types").SocialConnection[]> {
    try {
      const q = query(
        collection(this.db, "socialConnections"),
        where("userId", "==", userId)
      );
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          userId: data.userId,
          platform: data.platform,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          expiresAt: data.expiresAt?.toDate?.(),
          platformUserId: data.platformUserId,
          platformUsername: data.platformUsername,
          connectedAt: data.connectedAt?.toDate?.() || new Date(),
          lastRefreshed: data.lastRefreshed?.toDate?.(),
        } as import("@/types").SocialConnection;
      });
    } catch (error: unknown) {
      // If collection doesn't exist or permissions not set up, return empty array
      console.error("❌ Failed to get social connections:", error);
      return []; // Don't throw - return empty array to prevent app crash
    }
  }

  async getSocialConnection(userId: string, platform: string): Promise<import("@/types").SocialConnection | null> {
    try {
      const q = query(
        collection(this.db, "socialConnections"),
        where("userId", "==", userId),
        where("platform", "==", platform)
      );
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      const data = doc.data();
      
      return {
        id: doc.id,
        userId: data.userId,
        platform: data.platform,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        expiresAt: data.expiresAt?.toDate?.(),
        platformUserId: data.platformUserId,
        platformUsername: data.platformUsername,
        connectedAt: data.connectedAt?.toDate?.() || new Date(),
        lastRefreshed: data.lastRefreshed?.toDate?.(),
      } as import("@/types").SocialConnection;
    } catch (error: unknown) {
      console.error("❌ Failed to get social connection:", error);
      throw new Error(error instanceof Error ? error.message : "Failed to get social connection");
    }
  }

  async addSocialConnection(userId: string, connection: Omit<import("@/types").SocialConnection, 'id' | 'userId'>): Promise<import("@/types").SocialConnection> {
    try {
      const connectionData = {
        userId,
        platform: connection.platform,
        accessToken: connection.accessToken,
        refreshToken: connection.refreshToken,
        expiresAt: connection.expiresAt,
        platformUserId: connection.platformUserId,
        platformUsername: connection.platformUsername,
        connectedAt: connection.connectedAt || serverTimestamp(),
        lastRefreshed: connection.lastRefreshed,
      };

      const docRef = await addDoc(collection(this.db, "socialConnections"), connectionData);
      
      console.log(`✅ Social connection added: ${connection.platform}`);
      
      return {
        id: docRef.id,
        userId,
        ...connection,
        connectedAt: connection.connectedAt || new Date(),
      } as import("@/types").SocialConnection;
    } catch (error: unknown) {
      console.error("❌ Failed to add social connection:", error);
      throw new Error(error instanceof Error ? error.message : "Failed to add social connection");
    }
  }

  async updateSocialConnection(connectionId: string, updates: Partial<import("@/types").SocialConnection>): Promise<void> {
    try {
      const updateData: Record<string, unknown> = {};
      
      if (updates.accessToken !== undefined) updateData.accessToken = updates.accessToken;
      if (updates.refreshToken !== undefined) updateData.refreshToken = updates.refreshToken;
      if (updates.expiresAt !== undefined) updateData.expiresAt = updates.expiresAt;
      if (updates.platformUserId !== undefined) updateData.platformUserId = updates.platformUserId;
      if (updates.platformUsername !== undefined) updateData.platformUsername = updates.platformUsername;
      if (updates.lastRefreshed !== undefined) updateData.lastRefreshed = updates.lastRefreshed;

      await updateDoc(doc(this.db, "socialConnections", connectionId), updateData);
      
      console.log(`✅ Social connection updated: ${connectionId}`);
    } catch (error: unknown) {
      console.error("❌ Failed to update social connection:", error);
      throw new Error(error instanceof Error ? error.message : "Failed to update social connection");
    }
  }

  async removeSocialConnection(connectionId: string): Promise<void> {
    try {
      await deleteDoc(doc(this.db, "socialConnections", connectionId));
      console.log(`✅ Social connection removed: ${connectionId}`);
    } catch (error: unknown) {
      console.error("❌ Failed to remove social connection:", error);
      throw new Error(error instanceof Error ? error.message : "Failed to remove social connection");
    }
  }

  // Lists Methods
  async getLists(userId: string): Promise<List[]> {
    console.log("📋 getLists called for userId:", userId);

    try {
      const q = query(
        collection(this.db, "lists"),
        where("userId", "==", userId),
        orderBy("createdAt", "asc"),
      );

      const snapshot = await getDocs(q);
      console.log(`📊 Found ${snapshot.size} lists in Firestore`);

      const lists = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate(),
        updatedAt: doc.data().updatedAt.toDate(),
      })) as List[];

      // Get item counts
      for (const list of lists) {
        const itemsQuery = query(
          collection(this.db, "items"),
          where("userId", "==", userId),
          where("listIds", "array-contains", list.id),
          where("archived", "==", false),
        );
        const itemsSnapshot = await getDocs(itemsQuery);
        list.itemCount = itemsSnapshot.size;
      }

      console.log("✅ Returning lists:", lists);
      return lists;
    } catch (error) {
      console.error("❌ Error in getLists:", error);
      throw error;
    }
  }

  async getList(listId: string): Promise<List | null> {
    const docRef = doc(this.db, "lists", listId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) return null;

    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      createdAt: data.createdAt.toDate(),
      updatedAt: data.updatedAt.toDate(),
    } as List;
  }

  async createList(userId: string, data: CreateListDTO): Promise<List> {
    console.log("📝 Creating list:", { userId, data });

    try {
      // Build listData, only including defined fields (Firestore doesn't accept undefined)
      const listData: any = {
        name: data.name,
        userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      // Only add optional fields if they're defined
      if (data.color !== undefined) {
        listData.color = data.color;
      }
      if (data.icon !== undefined) {
        listData.icon = data.icon;
      }

      console.log("📤 Sending to Firestore:", listData);
      const docRef = await addDoc(collection(this.db, "lists"), listData);
      console.log("✅ Document created with ID:", docRef.id);

      const docSnap = await getDoc(docRef);
      const savedData = docSnap.data()!;

      const newList = {
        id: docRef.id,
        ...savedData,
        createdAt: savedData.createdAt.toDate(),
        updatedAt: savedData.updatedAt.toDate(),
      } as List;

      console.log("✅ List created successfully:", newList);
      return newList;
    } catch (error) {
      console.error("❌ Error creating list:", error);
      if (error instanceof Error) {
        console.error("Error message:", error.message);
        console.error("Error code:", (error as any).code);
      }
      throw error;
    }
  }

  async updateList(data: UpdateListDTO): Promise<void> {
    const docRef = doc(this.db, "lists", data.id);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
  }

  async deleteList(listId: string, userId: string): Promise<void> {
    console.log("🗑️ deleteList called:", { listId, userId });

    try {
      // Find all items that include this listId
      const itemsQuery = query(
        collection(this.db, "items"),
        where("userId", "==", userId),
        where("listIds", "array-contains", listId),
      );
      const itemsSnapshot = await getDocs(itemsQuery);
      console.log(`🗑️ Processing ${itemsSnapshot.size} items from list...`);

      const updateOrDeletePromises = itemsSnapshot.docs.map(async (docSnap) => {
        const data = docSnap.data();
        const remainingListIds = (data.listIds as string[]).filter(
          (id) => id !== listId,
        );
        if (remainingListIds.length === 0) {
          // Item only belonged to this list — delete it
          return deleteDoc(docSnap.ref);
        } else {
          // Item belongs to other lists too — just remove this listId
          return updateDoc(docSnap.ref, { listIds: remainingListIds });
        }
      });
      await Promise.all(updateOrDeletePromises);
      console.log("✅ All items processed");

      // Then delete the list itself
      await deleteDoc(doc(this.db, "lists", listId));
      console.log("✅ List deleted successfully");
    } catch (error) {
      console.error("❌ Error in deleteList:", error);
      throw error;
    }
  }

  // Items Methods
  async getItems(userId: string, listId?: string): Promise<Item[]> {
    let q = query(
      collection(this.db, "items"),
      where("userId", "==", userId),
      where("archived", "==", false),
      orderBy("createdAt", "desc"),
    );

    if (listId) {
      q = query(
        collection(this.db, "items"),
        where("userId", "==", userId),
        where("listIds", "array-contains", listId),
        where("archived", "==", false),
        orderBy("createdAt", "desc"),
      );
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt.toDate(),
      updatedAt: doc.data().updatedAt.toDate(),
    })) as Item[];
  }

  async getItem(itemId: string): Promise<Item | null> {
    const docRef = doc(this.db, "items", itemId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) return null;

    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      createdAt: data.createdAt.toDate(),
      updatedAt: data.updatedAt.toDate(),
    } as Item;
  }

  async createItem(userId: string, data: CreateItemDTO): Promise<Item> {
    // Auto-detect content type and source if URL provided
    let detectedInfo: { type: Item["type"]; source?: Item["source"] } = {
      type: data.type,
      source:
        typeof data.source === "string"
          ? (data.source as Item["source"])
          : undefined,
    };
    let thumbnail = data.thumbnail;

    if (data.url) {
      const detected = detectContentType(data.url);
      detectedInfo = {
        type: detected.type as Item["type"],
        source: detected.source as Item["source"],
      };

      // Extract YouTube thumbnail if not provided
      if (detected.source === "youtube" && !thumbnail) {
        thumbnail = extractYouTubeThumbnail(data.url);
      }
    }

    // Build itemData, only including defined fields (Firestore doesn't accept undefined)
    const itemData: any = {
      type: detectedInfo.type,
      title: data.title,
      listIds: data.listIds,
      userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      tags: data.tags || [],
      archived: false,
    };

    // Only add optional fields if they're defined
    if (data.url !== undefined) {
      itemData.url = data.url;
    }
    if (data.content !== undefined) {
      itemData.content = data.content;
    }
    if (thumbnail !== undefined) {
      itemData.thumbnail = thumbnail;
    }
    if (detectedInfo.source !== undefined) {
      itemData.source = detectedInfo.source;
    }
    if (data.nsfw === true) {
      itemData.nsfw = true;
    }

    const docRef = await addDoc(collection(this.db, "items"), itemData);
    const docSnap = await getDoc(docRef);
    const savedData = docSnap.data()!;

    return {
      id: docRef.id,
      ...savedData,
      createdAt: savedData.createdAt.toDate(),
      updatedAt: savedData.updatedAt.toDate(),
    } as Item;
  }

  async updateItem(data: UpdateItemDTO): Promise<void> {
    const docRef = doc(this.db, "items", data.id);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
  }

  async deleteItem(itemId: string): Promise<void> {
    await deleteDoc(doc(this.db, "items", itemId));
  }

  async archiveItem(itemId: string): Promise<void> {
    const docRef = doc(this.db, "items", itemId);
    await updateDoc(docRef, {
      archived: true,
      updatedAt: serverTimestamp(),
    });
  }

  // Utility Methods (delegates to module-level functions)
  detectContentType(url: string): { type: string; source?: string } {
    return detectContentType(url);
  }
}

// Export singleton instance
export const firebaseStorageService = new FirebaseStorageService();
