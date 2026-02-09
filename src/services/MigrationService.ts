import { firebaseStorageService } from "./FirebaseStorageService";

/**
 * Migrate data from localStorage (MockStorageService) to Firebase (FirebaseStorageService)
 *
 * Usage:
 * 1. Make sure you're logged into Firebase with the account you want to migrate to
 * 2. Open browser console on your app
 * 3. Run: await window.migrateToFirebase()
 * 4. Check Firebase Console → Firestore Database to verify
 */

interface MockData {
  users: any[];
  lists: any[];
  items: any[];
  currentUserId: string | null;
}

export async function migrateLocalStorageToFirebase(): Promise<void> {
  console.log("🔄 Starting migration from localStorage to Firebase...");

  // Step 1: Get current Firebase user
  const firebaseUser = await firebaseStorageService.getCurrentUser();
  if (!firebaseUser) {
    throw new Error("❌ No Firebase user logged in. Please sign in first.");
  }
  console.log("✅ Firebase user:", firebaseUser.email);

  // Step 2: Load data from localStorage
  const stored = localStorage.getItem("4later_mock_data");
  if (!stored) {
    console.log("⚠️  No localStorage data found to migrate");
    return;
  }

  const mockData: MockData = JSON.parse(stored);
  console.log(
    `📦 Found ${mockData.lists.length} lists and ${mockData.items.length} items in localStorage`,
  );

  // Step 3: Find the user's data in mock storage
  let currentUserId = mockData.currentUserId;

  if (!currentUserId && mockData.users.length > 0) {
    // If no current user, use the first user
    currentUserId = mockData.users[0].id;
    console.log(
      `⚠️  No current user set, using first user: ${mockData.users[0].email}`,
    );
  }

  if (!currentUserId) {
    console.log("❌ No user data found in localStorage");
    return;
  }

  // Step 4: Get user's lists and items
  const userLists = mockData.lists.filter(
    (list) => list.userId === currentUserId,
  );
  const userItems = mockData.items.filter(
    (item) => item.userId === currentUserId,
  );

  console.log(`👤 Migrating data for user: ${currentUserId}`);
  console.log(`📋 Lists to migrate: ${userLists.length}`);
  console.log(`📄 Items to migrate: ${userItems.length}`);

  // Step 5: Create a mapping from old list IDs to new Firebase list IDs
  const listIdMapping: Record<string, string> = {};

  try {
    // Step 6: Migrate lists
    console.log("\n📋 Migrating lists...");
    for (const oldList of userLists) {
      const newList = await firebaseStorageService.createList(firebaseUser.id, {
        name: oldList.name,
        icon: oldList.icon,
        color: oldList.color,
      });
      listIdMapping[oldList.id] = newList.id;
      console.log(`  ✅ ${oldList.name} (${oldList.id} → ${newList.id})`);
    }

    // Step 7: Migrate items
    console.log("\n📄 Migrating items...");
    let successCount = 0;
    let errorCount = 0;

    for (const oldItem of userItems) {
      try {
        // Map old listId to new Firebase listId
        const newListId = listIdMapping[oldItem.listId];
        if (!newListId) {
          console.warn(
            `  ⚠️  Skipping item "${oldItem.title}" - list not found`,
          );
          errorCount++;
          continue;
        }

        await firebaseStorageService.createItem(firebaseUser.id, {
          type: oldItem.type,
          title: oldItem.title,
          url: oldItem.url,
          content: oldItem.content,
          thumbnail: oldItem.thumbnail,
          listId: newListId,
          tags: oldItem.tags || [],
          source: oldItem.source,
        });

        successCount++;
        console.log(`  ✅ ${oldItem.title}`);
      } catch (err: any) {
        console.error(
          `  ❌ Failed to migrate "${oldItem.title}":`,
          err.message,
        );
        errorCount++;
      }
    }

    console.log("\n✨ Migration complete!");
    console.log(`  ✅ Successfully migrated: ${successCount} items`);
    if (errorCount > 0) {
      console.log(`  ⚠️  Failed: ${errorCount} items`);
    }

    // Step 8: Backup localStorage data before clearing
    const backup = {
      timestamp: new Date().toISOString(),
      data: mockData,
    };
    localStorage.setItem("4later_mock_data_backup", JSON.stringify(backup));
    console.log(
      '\n💾 Backup saved to localStorage as "4later_mock_data_backup"',
    );

    // Optional: Clear old data (commented out for safety)
    // localStorage.removeItem('4later_mock_data');
    // console.log('🗑️  Cleared old localStorage data');

    console.log(
      "\n🎉 All done! Check Firebase Console → Firestore to verify your data.",
    );
    console.log(
      '💡 Tip: You can now delete "4later_mock_data" from localStorage if everything looks good.',
    );
  } catch (err: any) {
    console.error("\n❌ Migration failed:", err.message);
    throw err;
  }
}

// Make it available globally in browser console
if (typeof window !== "undefined") {
  (window as any).migrateToFirebase = migrateLocalStorageToFirebase;
}

export default migrateLocalStorageToFirebase;
