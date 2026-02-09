# Testing Guide for 4Later

## Testing in Mock Mode

The app runs in Mock Mode by default, which simulates Firebase using localStorage.

### 1. User Authentication

#### Test Google Sign-In (Mock)
1. Click "Continue with Google"
2. Automatically creates demo user: `demo@4later.app`
3. Redirects to dashboard
4. Data persists across page refreshes

#### Test Email Sign-Up
1. Click "Sign up"
2. Fill in:
   - Name: "Test User"
   - Email: "test@example.com"
   - Password: "password123"
3. Click "Create Account"
4. Should redirect to dashboard
5. Two default lists created: "Quick Bin" and "Favorites"

#### Test Email Sign-In
1. Sign out
2. Click "Sign In"
3. Use credentials from sign-up
4. Should log in successfully

### 2. Lists Management

#### Create a New List
1. Click "+" button in top bar
2. Enter name: "Watch Later"
3. Select an icon: 📺
4. Click "Create List"
5. New list appears in top bar

#### Filter by List
1. Click "All" to see all items
2. Click a specific list name to filter
3. Only items from that list should show

#### Delete a List
1. Create a test list
2. Add items to it
3. Delete the list (via edit button)
4. Items should be deleted too

### 3. Items Management

#### Add a Text Item
1. Click FAB (+) button
2. Fill in:
   - Title: "My Note"
   - Notes: "This is a test note"
   - List: "Quick Bin"
3. Click "Add Item"
4. Item appears in grid

#### Add a Link Item
1. Click FAB
2. Fill in:
   - Title: "Interesting Article"
   - URL: "https://example.com/article"
   - List: "Quick Bin"
3. Click "Add Item"
4. Card shows domain name

#### Add YouTube Video
1. Click FAB
2. Fill in:
   - Title: "Tutorial Video"
   - URL: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
   - List: "Favorites"
3. Should auto-detect as video type
4. YouTube badge appears

#### View Item Details
1. Click on any item card
2. Modal opens with full details
3. Can see all metadata
4. Links open in new tab

#### Delete an Item
1. Click item to open details
2. Click "Delete" button
3. Confirm deletion
4. Item removed from list

### 4. Swipe Gestures (Mobile)

#### Archive an Item
1. On touch device or mobile browser
2. Swipe left on any card
3. "Archive" indicator appears
4. Complete swipe to archive
5. Haptic feedback triggers (if supported)
6. Item removed from view

### 5. Web Share Target (Requires HTTPS)

#### Test Sharing from Another App
1. Build and serve over HTTPS: `npm run build && npm run preview`
2. Or deploy to hosting service
3. Install as PWA
4. Open Twitter/Chrome/any app
5. Click share button
6. Select "4Later"
7. Add item modal opens with pre-filled data

### 6. UI States

#### Empty State
1. Create a new list
2. Don't add any items
3. Filter to that list
4. Should show empty state with icon

#### Loading State
1. Open DevTools
2. Throttle network to "Slow 3G"
3. Perform actions
4. Should see loading indicators

#### Error State
1. Modify localStorage to corrupt data
2. Try to load dashboard
3. Should handle errors gracefully

### 7. Responsive Design

#### Mobile View (360px - 450px)
1. Open DevTools
2. Toggle device toolbar
3. Select iPhone SE or similar
4. Test:
   - Top bar scrolls horizontally
   - Cards stack vertically
   - FAB positioned correctly
   - Modals fill screen

#### Tablet View (768px - 1024px)
1. Resize to tablet width
2. Cards should show in 2-column grid
3. User name appears in header

#### Desktop View (1024px+)
1. Resize to desktop width
2. Cards show in 3-column grid
3. Maximum width container applies

### 8. Data Persistence

#### Refresh Test
1. Add several items and lists
2. Refresh the page (F5)
3. All data should persist
4. Selected list filter maintained

#### Multiple Tabs
1. Open app in two tabs
2. Add item in tab 1
3. Refresh tab 2
4. New item should appear

### 9. Performance

#### Load Time
1. Open DevTools > Network
2. Hard refresh (Ctrl+Shift+R)
3. Check performance:
   - Initial bundle size < 300KB
   - First Contentful Paint < 1.5s
   - Time to Interactive < 3s

#### Animation Performance
1. Open DevTools > Performance
2. Record while:
   - Opening modals
   - Scrolling list
   - Swiping cards
3. Check for 60fps animations

## Testing Firebase Integration

Once you've set up Firebase (see FIREBASE_SETUP.md):

### 1. Authentication
1. Test real Google Sign-In
2. Verify user appears in Firebase Console > Authentication
3. Test email sign-up with verification

### 2. Data Sync
1. Add items on device 1
2. Sign in on device 2 with same account
3. Data should sync automatically

### 3. Offline Behavior
1. Add item while online
2. Disconnect internet
3. Try to add another item
4. Should show appropriate error

### 4. Security Rules
1. Try to access another user's data
2. Should be denied by Firestore rules
3. Check Firebase Console > Firestore > Rules

## Common Issues

### Mock Data Not Persisting
- Check localStorage isn't disabled
- Clear cache: DevTools > Application > Clear storage

### Swipe Gesture Not Working
- Ensure touch events are enabled
- Try on actual mobile device
- Check for JavaScript errors

### Web Share Not Available
- Requires HTTPS
- Only works on supported browsers (Chrome, Edge)
- Must be installed as PWA

### Firebase Connection Issues
- Verify config in FirebaseStorageService.ts
- Check network tab for errors
- Ensure Firestore rules are set

## Automated Testing (Future)

Consider adding:
- Unit tests with Vitest
- Component tests with React Testing Library
- E2E tests with Playwright
- Visual regression tests

## Test Checklist

Before deploying:
- [ ] All authentication flows work
- [ ] CRUD operations for lists and items
- [ ] Swipe gestures function properly
- [ ] Web Share Target receives data
- [ ] Responsive on all screen sizes
- [ ] Data persists across refreshes
- [ ] No console errors
- [ ] Performance metrics acceptable
- [ ] Accessible (keyboard navigation works)
- [ ] Works on Chrome, Firefox, Safari
