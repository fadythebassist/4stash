// Content Types
export type ContentType = 'text' | 'video' | 'image' | 'link' | 'article';

// Item represents a saved piece of content
export interface Item {
  id: string;
  type: ContentType;
  title: string;
  url?: string;
  content?: string;
  thumbnail?: string;
  listId: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  tags?: string[];
  source?: 'youtube' | 'twitter' | 'tiktok' | 'instagram' | 'reddit' | 'facebook' | 'other';
  archived?: boolean;
}

// List represents a collection/category
export interface List {
  id: string;
  name: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  color?: string;
  icon?: string;
  itemCount?: number;
}

// User profile
export interface User {
  id: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  createdAt: Date;
  provider: 'google' | 'email';
}

// Social media connection for accessing private posts
export interface SocialConnection {
  id: string;
  userId: string;
  platform: 'facebook' | 'instagram' | 'twitter' | 'tiktok' | 'pinterest';
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  platformUserId?: string;
  platformUsername?: string;
  connectedAt: Date;
  lastRefreshed?: Date;
}

// User settings including social connections
export interface UserSettings {
  userId: string;
  socialConnections: SocialConnection[];
  preferences?: {
    autoFetchMetadata?: boolean;
    defaultList?: string;
  };
}

// Share target data (from Web Share API)
export interface ShareData {
  title?: string;
  text?: string;
  url?: string;
  files?: File[];
}

// UI State
export interface UIState {
  loading: boolean;
  error: string | null;
  selectedListId: string | null;
}

// Create/Update DTOs
export interface CreateItemDTO {
  type: ContentType;
  title: string;
  url?: string;
  content?: string;
  thumbnail?: string;
  listId: string;
  tags?: string[];
  source?: string;
}

export interface UpdateItemDTO extends Partial<CreateItemDTO> {
  id: string;
}

export interface CreateListDTO {
  name: string;
  color?: string;
  icon?: string;
}

export interface UpdateListDTO extends Partial<CreateListDTO> {
  id: string;
}
