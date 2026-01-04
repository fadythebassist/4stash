# Architecture Overview - 4Later

## Design Principles

1. **Service Layer Pattern**: Abstract storage implementation behind interface
2. **Context API**: Global state management without external dependencies
3. **Component Composition**: Reusable, single-responsibility components
4. **Mobile-First**: Responsive design starting from smallest screens
5. **Progressive Enhancement**: Works offline, enhanced when online

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    User Interface                        │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │   Pages     │  │  Components  │  │    Styles     │  │
│  │ Login       │  │  TopBar      │  │  globals.css  │  │
│  │ Dashboard   │  │  ContentCard │  │  Auth.css     │  │
│  │ ShareTarget │  │  FAB         │  │  Dashboard... │  │
│  └─────────────┘  └──────────────┘  └───────────────┘  │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│                   Context Layer                          │
│  ┌─────────────────┐         ┌──────────────────────┐   │
│  │  AuthContext    │         │   DataContext        │   │
│  │  - user         │         │   - lists            │   │
│  │  - loading      │         │   - items            │   │
│  │  - signIn()     │         │   - createItem()     │   │
│  │  - signOut()    │         │   - deleteItem()     │   │
│  └────────┬────────┘         └──────────┬───────────┘   │
└───────────┼─────────────────────────────┼───────────────┘
            │                             │
┌───────────▼─────────────────────────────▼───────────────┐
│              Service Interface Layer                     │
│  ┌──────────────────────────────────────────────────┐   │
│  │           StorageService Interface                │   │
│  │  - Authentication methods                         │   │
│  │  - List CRUD operations                           │   │
│  │  - Item CRUD operations                           │   │
│  │  - Utility functions                              │   │
│  └────────────────┬─────────────────┬─────────────────┘  │
└───────────────────┼─────────────────┼────────────────────┘
                    │                 │
         ┌──────────▼──────────┐  ┌──▼────────────────────┐
         │ MockStorageService  │  │ FirebaseStorageService│
         │ (localStorage)      │  │ (Cloud Firestore)     │
         └─────────────────────┘  └───────────────────────┘
```

## Data Flow

### Authentication Flow

```
1. User clicks "Sign In with Google"
   ↓
2. AuthContext.signInWithGoogle()
   ↓
3. storageService.signInWithGoogle()
   ↓
4. Mock: Create demo user | Firebase: OAuth popup
   ↓
5. User object returned
   ↓
6. AuthContext updates state
   ↓
7. UI re-renders with authenticated user
   ↓
8. Redirect to Dashboard
```

### Add Item Flow

```
1. User clicks FAB button
   ↓
2. Dashboard opens AddItemModal
   ↓
3. User fills form and submits
   ↓
4. DataContext.createItem(data)
   ↓
5. storageService.createItem(userId, data)
   ↓
6. Auto-detect content type from URL
   ↓
7. Mock: Add to localStorage | Firebase: Add to Firestore
   ↓
8. DataContext.refreshData()
   ↓
9. UI updates with new item
   ↓
10. Modal closes
```

### Web Share Target Flow

```
1. User shares from external app
   ↓
2. PWA opens /share-target?url=...&title=...
   ↓
3. ShareTarget component parses params
   ↓
4. Check if user authenticated
   ↓
   Yes: Show AddItemModal with pre-filled data
   No: Redirect to /login?return=/share-target...
   ↓
5. User selects list and saves
   ↓
6. Redirect to Dashboard
```

## Component Hierarchy

```
App
├── Router
│   ├── PublicRoute
│   │   ├── Login
│   │   └── Register
│   └── ProtectedRoute
│       ├── Dashboard
│       │   ├── Header (glass)
│       │   ├── TopBar (snap scroll)
│       │   ├── ContentGrid
│       │   │   └── ContentCard[] (swipeable)
│       │   ├── FAB
│       │   └── Modals
│       │       ├── AddItemModal
│       │       ├── AddListModal
│       │       └── ItemDetailModal
│       └── ShareTarget
│           └── AddItemModal
```

## State Management

### AuthContext State

```typescript
{
  user: User | null,          // Current authenticated user
  loading: boolean,           // Auth check in progress
  error: string | null,       // Last error message
  signInWithGoogle: () => Promise<void>,
  signInWithEmail: (email, password) => Promise<void>,
  signUpWithEmail: (email, password, name?) => Promise<void>,
  signOut: () => Promise<void>
}
```

### DataContext State

```typescript
{
  lists: List[],              // All user's lists
  items: Item[],              // Filtered items
  selectedListId: string | null,  // Current filter
  loading: boolean,           // Data fetch in progress
  error: string | null,       // Last error message
  selectList: (id) => void,
  createList: (data) => Promise<List>,
  updateList: (data) => Promise<void>,
  deleteList: (id) => Promise<void>,
  createItem: (data) => Promise<Item>,
  updateItem: (data) => Promise<void>,
  deleteItem: (id) => Promise<void>,
  archiveItem: (id) => Promise<void>,
  refreshData: () => Promise<void>
}
```

## Storage Abstraction

### Why Two Implementations?

1. **MockStorageService**: 
   - Development without Firebase setup
   - Instant testing and iteration
   - No network latency
   - Offline-first by default

2. **FirebaseStorageService**:
   - Production-ready backend
   - Cross-device sync
   - Scalable infrastructure
   - Real-time updates (future enhancement)

### Interface Contract

Both services implement the same interface:

```typescript
interface StorageService {
  // Auth
  signInWithGoogle(): Promise<User>
  signInWithEmail(email, password): Promise<User>
  signUpWithEmail(email, password, name?): Promise<User>
  signOut(): Promise<void>
  getCurrentUser(): Promise<User | null>
  
  // Lists
  getLists(userId): Promise<List[]>
  createList(userId, data): Promise<List>
  updateList(data): Promise<void>
  deleteList(listId): Promise<void>
  
  // Items
  getItems(userId, listId?): Promise<Item[]>
  createItem(userId, data): Promise<Item>
  updateItem(data): Promise<void>
  deleteItem(itemId): Promise<void>
  archiveItem(itemId): Promise<void>
  
  // Utility
  detectContentType(url): { type, source? }
}
```

### Swapping Services

To switch from Mock to Firebase:

```typescript
// In AuthContext.tsx and DataContext.tsx

// Before:
import { mockStorageService } from '@/services/MockStorageService';
const storageService: StorageService = mockStorageService;

// After:
import { firebaseStorageService } from '@/services/FirebaseStorageService';
const storageService: StorageService = firebaseStorageService;
```

## Styling Architecture

### CSS Variables

All colors, spacing, and design tokens defined in `:root`:

```css
:root {
  --bg-primary: #0f0f0f;
  --accent-primary: #6366f1;
  --spacing-md: 1rem;
  --radius-lg: 0.75rem;
  --transition-fast: 150ms ease;
}
```

### Component Styles

- Each component has its own CSS file
- Use CSS variables for consistency
- BEM-like naming convention
- Mobile-first media queries

### Global Styles

`globals.css` contains:
- CSS reset
- Global element styles
- Utility classes
- Animation keyframes
- Scrollbar customization

## Performance Optimizations

1. **Code Splitting**: React.lazy for route-based splitting
2. **Image Loading**: lazy loading with native `loading="lazy"`
3. **Debouncing**: Search and filter operations
4. **Virtualization**: Future enhancement for large lists
5. **Service Worker**: PWA caching for offline support

## Security Considerations

1. **Firebase Rules**: Restrict data access by user ID
2. **Environment Variables**: Never commit sensitive config
3. **Input Validation**: Sanitize all user inputs
4. **HTTPS Only**: Enforce secure connections
5. **CSP Headers**: Content Security Policy in production

## Scalability

### Current Limits
- MockStorage: Browser localStorage (~5-10MB)
- Firebase Free Tier:
  - 50K reads/day
  - 20K writes/day
  - 1GB storage

### Future Enhancements
- Pagination for large item lists
- Infinite scroll
- Background sync for offline changes
- Real-time updates with Firestore listeners
- Cloud Functions for advanced features

## Browser Support

- Chrome 90+ (primary target)
- Edge 90+
- Safari 14+
- Firefox 88+

### Progressive Enhancement
- Core features work without:
  - Web Share API
  - Haptic feedback
  - Service worker
- Enhanced experience when available

## Development Workflow

```
1. Design new feature
   ↓
2. Update types in types/index.ts
   ↓
3. Implement in MockStorageService
   ↓
4. Update context if needed
   ↓
5. Create/update components
   ↓
6. Test in browser
   ↓
7. Implement in FirebaseStorageService
   ↓
8. Test with real Firebase
   ↓
9. Deploy
```

## Deployment Architecture

```
┌─────────────────┐
│   Vercel/       │
│   Netlify       │  Static hosting
│   (Frontend)    │
└────────┬────────┘
         │
         │ API calls
         │
┌────────▼────────┐
│   Firebase      │
│   Auth          │  User authentication
└────────┬────────┘
         │
┌────────▼────────┐
│   Cloud         │
│   Firestore     │  Data storage
└─────────────────┘
```

## Future Architecture Considerations

1. **State Management**: Consider Zustand or Redux for complex state
2. **API Layer**: Abstract Firebase calls for easier testing
3. **Caching**: Implement React Query for data caching
4. **Real-time**: Use Firestore real-time listeners
5. **Search**: Integrate Algolia or MeiliSearch
6. **Analytics**: Add Google Analytics or PostHog
7. **Error Tracking**: Implement Sentry
