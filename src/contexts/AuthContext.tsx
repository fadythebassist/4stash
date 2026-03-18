import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { User, AppSettings, SocialConnection } from "@/types";
import { StorageService } from "@/services/StorageService";
import { firebaseStorageService } from "@/services/FirebaseStorageService";
import { mockStorageService } from "@/services/MockStorageService";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithFacebook: () => Promise<void>;
  signInWithTwitter: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (
    email: string,
    password: string,
    displayName?: string,
  ) => Promise<void>;
  signOut: () => Promise<void>;
  updateUserSettings?: (settings: AppSettings) => Promise<void>;
  // Social Connections
  getSocialConnection: (platform: string) => SocialConnection | null;
  addSocialConnection: (connection: Omit<SocialConnection, 'id' | 'userId'>) => Promise<void>;
  removeSocialConnection: (platform: string) => Promise<void>;
  hasThreadsConnection: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Service instance — swap to mock when VITE_USE_MOCK is set (e.g. in Playwright tests)
const storageService: StorageService =
  import.meta.env.VITE_USE_MOCK === "true"
    ? mockStorageService
    : firebaseStorageService;

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if user is already logged in
    const checkAuth = async () => {
      try {
        const currentUser = await storageService.getCurrentUser();
        setUser(currentUser);
      } catch (err) {
        console.error("Auth check failed:", err);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const signInWithGoogle = async () => {
    setLoading(true);
    setError(null);
    try {
      const user = await storageService.signInWithGoogle();
      setUser(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign in");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signInWithFacebook = async () => {
    setLoading(true);
    setError(null);
    try {
      const user = await storageService.signInWithFacebook();
      setUser(user);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to sign in with Facebook",
      );
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signInWithTwitter = async () => {
    setLoading(true);
    setError(null);
    try {
      const user = await storageService.signInWithTwitter();
      setUser(user);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to sign in with Twitter",
      );
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const user = await storageService.signInWithEmail(email, password);
      setUser(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign in");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signUpWithEmail = async (
    email: string,
    password: string,
    displayName?: string,
  ) => {
    setLoading(true);
    setError(null);
    try {
      const user = await storageService.signUpWithEmail(
        email,
        password,
        displayName,
      );
      setUser(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign up");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    setError(null);
    try {
      await storageService.signOut();
      setUser(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign out");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateUserSettings = async (settings: AppSettings) => {
    if (!user) {
      throw new Error("No user logged in");
    }
    try {
      await storageService.updateUserSettings(user.id, settings);
      setUser({ ...user, settings });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update settings");
      throw err;
    }
  };

  // Social Connection Methods
  const getSocialConnection = (platform: string) => {
    if (!user || !user.socialConnections) return null;
    return user.socialConnections.find(conn => conn.platform === platform) || null;
  };

  const addSocialConnection = async (connection: Omit<SocialConnection, 'id' | 'userId'>) => {
    if (!user) {
      throw new Error("No user logged in");
    }
    try {
      const newConnection = await storageService.addSocialConnection(user.id, connection);
      const updatedConnections = [...(user.socialConnections || []), newConnection];
      setUser({ ...user, socialConnections: updatedConnections });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add social connection");
      throw err;
    }
  };

  const removeSocialConnection = async (platform: string) => {
    if (!user || !user.socialConnections) {
      throw new Error("No user logged in or no connections");
    }
    try {
      const connection = user.socialConnections.find(conn => conn.platform === platform);
      if (!connection) {
        throw new Error(`No connection found for platform: ${platform}`);
      }
      await storageService.removeSocialConnection(connection.id);
      const updatedConnections = user.socialConnections.filter(conn => conn.platform !== platform);
      setUser({ ...user, socialConnections: updatedConnections });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove social connection");
      throw err;
    }
  };

  const hasThreadsConnection = () => {
    return getSocialConnection('threads') !== null;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        signInWithGoogle,
        signInWithFacebook,
        signInWithTwitter,
        signInWithEmail,
        signUpWithEmail,
        signOut,
        updateUserSettings,
        getSocialConnection,
        addSocialConnection,
        removeSocialConnection,
        hasThreadsConnection,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
