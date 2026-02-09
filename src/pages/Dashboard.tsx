import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useData } from "@/contexts/DataContext";
import TopBar from "@/components/TopBar";
import ContentCard from "@/components/ContentCard";
import FAB from "@/components/FAB";
import AddItemModal from "@/components/AddItemModal";
import AddListModal from "@/components/AddListModal";
import ItemDetailModal from "@/components/ItemDetailModal";
import EditItemModal from "@/components/EditItemModal";
import AvatarPickerModal from "@/components/AvatarPickerModal";
import { Item } from "@/types";
import "./Dashboard.css";

const Dashboard: React.FC = () => {
  const { user, signOut } = useAuth();
  const {
    lists,
    items,
    selectedListId,
    selectList,
    deleteList,
    deleteItem,
    archiveItem,
  } = useData();
  const navigate = useNavigate();

  const [showAddItem, setShowAddItem] = useState(false);
  const [showAddList, setShowAddList] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [editingItem, setEditingItem] = useState<Item | null>(null);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const handleDeleteList = async (listId: string, listName: string) => {
    try {
      await deleteList(listId);
      // If the deleted list was selected, switch to "All"
      if (selectedListId === listId) {
        selectList(null);
      }
    } catch (error) {
      console.error("Failed to delete list:", error);
      alert(`Failed to delete "${listName}". Please try again.`);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (confirm("Are you sure you want to delete this item?")) {
      await deleteItem(itemId);
    }
  };

  const handleArchiveItem = async (itemId: string) => {
    await archiveItem(itemId);
  };

  return (
    <div className="dashboard">
      {/* Header */}
      <header className="dashboard-header glass">
        <div className="header-content">
          <h1 className="dashboard-logo">4Later</h1>
          <div className="header-actions">
            <div className="user-info">
              <button
                className="avatar-button"
                onClick={() => setShowAvatarPicker(true)}
                title="Change avatar"
              >
                {user?.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || "User"}
                    className="user-avatar"
                  />
                ) : (
                  <div className="user-avatar-placeholder">
                    {user?.displayName?.[0] || user?.email?.[0] || "U"}
                  </div>
                )}
              </button>
              <span className="user-name">
                {user?.displayName || user?.email}
              </span>
            </div>
            <button
              onClick={handleSignOut}
              className="btn-icon"
              title="Sign out"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Top Bar with Lists */}
      <TopBar
        lists={lists}
        selectedListId={selectedListId}
        onSelectList={selectList}
        onAddList={() => setShowAddList(true)}
        onDeleteList={handleDeleteList}
      />

      {/* Main Content */}
      <main className="dashboard-main">
        <div className="container">
          {items.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📭</div>
              <h2>No items yet</h2>
              <p>
                {selectedListId
                  ? "This list is empty. Add your first item!"
                  : "Start saving content by clicking the + button"}
              </p>
            </div>
          ) : (
            <div className="content-grid">
              {items.map((item) => (
                <ContentCard
                  key={item.id}
                  item={item}
                  onDelete={() => handleDeleteItem(item.id)}
                  onArchive={() => handleArchiveItem(item.id)}
                  onClick={() => setSelectedItem(item)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* FAB */}
      <FAB onClick={() => setShowAddItem(true)} />

      {/* Modals */}
      {showAddItem && (
        <AddItemModal
          onClose={() => setShowAddItem(false)}
          onAddList={() => setShowAddList(true)}
        />
      )}

      {showAddList && <AddListModal onClose={() => setShowAddList(false)} />}

      {selectedItem && (
        <ItemDetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onDelete={() => {
            handleDeleteItem(selectedItem.id);
            setSelectedItem(null);
          }}
          onEdit={() => {
            setEditingItem(selectedItem);
            setSelectedItem(null);
          }}
        />
      )}

      {editingItem && (
        <EditItemModal
          item={editingItem}
          lists={lists}
          onClose={() => setEditingItem(null)}
          onSave={() => {
            setEditingItem(null);
          }}
        />
      )}

      {showAvatarPicker && (
        <AvatarPickerModal onClose={() => setShowAvatarPicker(false)} />
      )}
    </div>
  );
};

export default Dashboard;
