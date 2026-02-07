# Social Media Authentication Plan

## Overview
Enable users to connect their social media accounts to access private posts they have permission to view.

## Platforms to Support
1. **Facebook** ✓ (App ID/Secret already set up)
2. **Instagram** (uses Facebook OAuth)
3. **X (Twitter)**
4. **TikTok**
5. **Pinterest**

---

## Implementation Steps

### Phase 1: Infrastructure Setup

#### 1.1 Create Settings Page
**File**: `src/pages/Settings.tsx`
- Display connected accounts
- "Connect" buttons for each platform
- "Disconnect" buttons for connected accounts
- Show connection status (active/expired)

#### 1.2 Create OAuth Service
**File**: `src/services/OAuthService.ts`
- Handle OAuth flow initiation
- Process OAuth callbacks
- Store/retrieve tokens securely
- Refresh expired tokens

#### 1.3 Update Storage Service
**File**: `src/services/StorageService.ts` (interface)
**File**: `src/services/FirebaseStorageService.ts` (implementation)
- Add methods for social connections:
  - `saveSocialConnection(connection: SocialConnection)`
  - `getSocialConnections(userId: string)`
  - `removeSocialConnection(userId: string, platform: string)`
  - `updateSocialConnection(connection: SocialConnection)`

---

### Phase 2: Platform-Specific Setup

#### 2.1 Facebook / Instagram

**Prerequisites:**
- ✓ Facebook App already created
- ✓ App ID and Secret in `.env`

**Additional Setup:**
1. Add OAuth redirect URI to Facebook App settings:
   - `http://localhost:5174/auth/facebook/callback` (dev)
   - `https://yourdomain.com/auth/facebook/callback` (prod)

2. Request permissions:
   - `user_posts` - Access user's posts
   - `instagram_basic` - Basic Instagram access
   - `instagram_content_publish` - Instagram content

3. Add to `.env`:
   ```env
   VITE_FACEBOOK_APP_ID=1386216603247526
   VITE_FACEBOOK_APP_SECRET=2561d685a6a44a2f82a6429a09e4a4d6
   VITE_FACEBOOK_REDIRECT_URI=http://localhost:5174/auth/facebook/callback
   ```

**Implementation:**
```typescript
// OAuth URL
const facebookAuthUrl = `https://www.facebook.com/v19.0/dialog/oauth?
  client_id=${FACEBOOK_APP_ID}
  &redirect_uri=${REDIRECT_URI}
  &scope=user_posts,instagram_basic
  &response_type=code`;

// Exchange code for token
POST https://graph.facebook.com/v19.0/oauth/access_token
  ?client_id={app-id}
  &redirect_uri={redirect-uri}
  &client_secret={app-secret}
  &code={code-from-callback}

// Fetch private post
GET https://graph.facebook.com/v19.0/{post-id}
  ?fields=message,created_time,full_picture,permalink_url
  &access_token={user-access-token}
```

---

#### 2.2 X (Twitter)

**Setup:**
1. Create Twitter/X Developer Account: https://developer.twitter.com/
2. Create an App in the Developer Portal
3. Get API Key, API Secret, Bearer Token
4. Enable OAuth 2.0 with PKCE

**Add to `.env`:**
```env
VITE_TWITTER_CLIENT_ID=your_client_id
VITE_TWITTER_CLIENT_SECRET=your_client_secret
VITE_TWITTER_REDIRECT_URI=http://localhost:5174/auth/twitter/callback
```

**OAuth 2.0 with PKCE:**
```typescript
// Generate code challenge
const codeVerifier = generateRandomString(128);
const codeChallenge = await sha256(codeVerifier);

// Auth URL
const twitterAuthUrl = `https://twitter.com/i/oauth2/authorize?
  response_type=code
  &client_id=${CLIENT_ID}
  &redirect_uri=${REDIRECT_URI}
  &scope=tweet.read users.read offline.access
  &state=${state}
  &code_challenge=${codeChallenge}
  &code_challenge_method=S256`;

// Exchange code for token
POST https://api.twitter.com/2/oauth2/token
  Content-Type: application/x-www-form-urlencoded
  
  code={authorization-code}
  &grant_type=authorization_code
  &client_id={client-id}
  &redirect_uri={redirect-uri}
  &code_verifier={code-verifier}
```

---

#### 2.3 TikTok

**Setup:**
1. Register at TikTok for Developers: https://developers.tiktok.com/
2. Create an App
3. Get Client Key and Client Secret
4. Add callback URL

**Add to `.env`:**
```env
VITE_TIKTOK_CLIENT_KEY=your_client_key
VITE_TIKTOK_CLIENT_SECRET=your_client_secret
VITE_TIKTOK_REDIRECT_URI=http://localhost:5174/auth/tiktok/callback
```

**OAuth Flow:**
```typescript
// Auth URL
const tiktokAuthUrl = `https://www.tiktok.com/v2/auth/authorize?
  client_key=${CLIENT_KEY}
  &scope=user.info.basic,video.list
  &response_type=code
  &redirect_uri=${REDIRECT_URI}
  &state=${state}`;

// Exchange code for token
POST https://open.tiktokapis.com/v2/oauth/token/
  Content-Type: application/x-www-form-urlencoded
  
  client_key={client-key}
  &client_secret={client-secret}
  &code={authorization-code}
  &grant_type=authorization_code
  &redirect_uri={redirect-uri}
```

---

#### 2.4 Pinterest

**Setup:**
1. Create Pinterest App: https://developers.pinterest.com/
2. Get App ID and App Secret
3. Add callback URL

**Add to `.env`:**
```env
VITE_PINTEREST_APP_ID=your_app_id
VITE_PINTEREST_APP_SECRET=your_app_secret
VITE_PINTEREST_REDIRECT_URI=http://localhost:5174/auth/pinterest/callback
```

**OAuth Flow:**
```typescript
// Auth URL
const pinterestAuthUrl = `https://www.pinterest.com/oauth/?
  client_id=${APP_ID}
  &redirect_uri=${REDIRECT_URI}
  &response_type=code
  &scope=boards:read,pins:read
  &state=${state}`;

// Exchange code for token
POST https://api.pinterest.com/v5/oauth/token
  Content-Type: application/x-www-form-urlencoded
  
  grant_type=authorization_code
  &code={authorization-code}
  &redirect_uri={redirect-uri}
```

---

### Phase 3: Implementation Files

#### 3.1 OAuth Service
**File**: `src/services/OAuthService.ts`
```typescript
export class OAuthService {
  // Initiate OAuth flow
  static async connectPlatform(platform: Platform): Promise<void>
  
  // Handle OAuth callback
  static async handleCallback(platform: Platform, code: string): Promise<SocialConnection>
  
  // Refresh expired token
  static async refreshToken(connection: SocialConnection): Promise<SocialConnection>
  
  // Fetch private post with user's token
  static async fetchPrivatePost(url: string, connection: SocialConnection): Promise<PostMetadata>
}
```

#### 3.2 Settings Page
**File**: `src/pages/Settings.tsx`
- Display all platforms with connection status
- Connect/Disconnect buttons
- Handle OAuth redirect flows

#### 3.3 OAuth Callback Handler
**Files**: 
- `src/pages/auth/FacebookCallback.tsx`
- `src/pages/auth/TwitterCallback.tsx`
- `src/pages/auth/TikTokCallback.tsx`
- `src/pages/auth/PinterestCallback.tsx`

Each handles the OAuth callback for its respective platform.

#### 3.4 Update Router
**File**: `src/main.tsx`
Add OAuth callback routes:
```typescript
{
  path: '/auth/facebook/callback',
  element: <FacebookCallback />
},
{
  path: '/auth/twitter/callback',
  element: <TwitterCallback />
},
// etc...
```

---

### Phase 4: Security Considerations

#### 4.1 Token Storage
- **Development**: Use encrypted localStorage with user-specific key
- **Production**: Store in Firestore with security rules:
  ```javascript
  match /socialConnections/{userId} {
    allow read, write: if request.auth.uid == userId;
  }
  ```

#### 4.2 Token Encryption
```typescript
// Encrypt token before storage
const encryptToken = (token: string, userId: string): string => {
  // Use Web Crypto API
  const key = await deriveKey(userId);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(token)
  );
  return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
};
```

#### 4.3 HTTPS Only
- OAuth callbacks must use HTTPS in production
- Set secure cookie flags
- Use state parameter to prevent CSRF

---

### Phase 5: Enhanced Metadata Fetching

Update `vite.config.ts` unfurl endpoint to check for social connections:

```typescript
// If user has connected their Facebook account
if (isFacebook && userHasFacebookToken) {
  // Use Graph API with user's token
  const post = await fetch(
    `https://graph.facebook.com/v19.0/${postId}?access_token=${userToken}`
  );
  // Can now access private posts!
}
```

---

## Migration Path

### Step 1: Start with Facebook/Instagram (Easiest)
- Already have App ID/Secret
- Largest user base
- Most requested feature

### Step 2: Add Twitter/X
- Second most popular
- Straightforward OAuth 2.0

### Step 3: Add TikTok
- Growing platform
- Good API documentation

### Step 4: Add Pinterest
- Niche use case
- Can be done last

---

## User Flow

1. **User goes to Settings**
2. **Clicks "Connect Facebook"**
3. **Redirects to Facebook OAuth**
4. **User authorizes app**
5. **Redirects back with code**
6. **Exchange code for token**
7. **Save encrypted token to storage**
8. **Show "Connected" status**
9. **When sharing private post:**
   - Check if user has active token
   - Use token to fetch metadata
   - Display private post content

---

## Testing Checklist

- [ ] OAuth flow works for each platform
- [ ] Tokens stored securely
- [ ] Tokens refresh automatically when expired
- [ ] Private posts fetch correctly
- [ ] Disconnect removes tokens
- [ ] Errors handled gracefully
- [ ] Works in production environment

---

## Estimated Timeline

- **Phase 1** (Infrastructure): 2-3 days
- **Phase 2** (Facebook/Instagram): 1-2 days
- **Phase 3** (Twitter/X): 1 day
- **Phase 4** (TikTok): 1 day
- **Phase 5** (Pinterest): 1 day
- **Testing & Polish**: 2 days

**Total**: ~2 weeks

---

## Next Immediate Steps

1. **Review this plan** - Make sure you're comfortable with the scope
2. **Start with Settings page** - Create UI for connecting accounts
3. **Implement Facebook OAuth first** - Since you already have credentials
4. **Test with your own Facebook account**
5. **Expand to other platforms**

Would you like me to start implementing any specific part of this plan?
