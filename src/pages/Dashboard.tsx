import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import TopBar from '@/components/TopBar';
import SourceFilter from '@/components/SourceFilter';
import ContentCard from '@/components/ContentCard';
import FAB from '@/components/FAB';
import AddItemModal from '@/components/AddItemModal';
import AddListModal from '@/components/AddListModal';
import ItemDetailModal from '@/components/ItemDetailModal';
import EditItemModal from '@/components/EditItemModal';
import { Item } from '@/types';
import './Dashboard.css';

const Dashboard: React.FC = () => {
  const { user, signOut } = useAuth();
  const { lists, items, selectedListId, selectList, deleteItem, archiveItem } = useData();
  const navigate = useNavigate();
  
  const [showAddItem, setShowAddItem] = useState(false);
  const [showAddList, setShowAddList] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const handleDeleteItem = async (itemId: string) => {
    if (confirm('Are you sure you want to delete this item?')) {
      await deleteItem(itemId);
    }
  };

  const handleArchiveItem = async (itemId: string) => {
    await archiveItem(itemId);
  };

  // Get filter options by domain and media type
  const getFilterOptions = () => {
    const filterMap = new Map<string, { label: string; count: number; type: 'domain' | 'media' }>();

    // Count by media type
    const mediaTypes = new Map<string, number>();
    mediaTypes.set('link', 0);
    mediaTypes.set('text', 0);
    mediaTypes.set('image', 0);
    mediaTypes.set('video', 0);
    mediaTypes.set('article', 0);

    // Count by domain
    const domains = new Map<string, number>();

    items.forEach((item) => {
      // Count by type
      const type = item.type || 'link';
      mediaTypes.set(type, (mediaTypes.get(type) || 0) + 1);

      // Count by domain
      if (item.url) {
        try {
          const url = new URL(item.url.startsWith('http') ? item.url : `https://${item.url}`);
          const domain = url.hostname.replace('www.', '');
          domains.set(domain, (domains.get(domain) || 0) + 1);
        } catch {
          // Fallback for invalid URLs
          domains.set('unknown', (domains.get('unknown') || 0) + 1);
        }
      }
    });

    // Add media type filters
    const mediaTypeLabels: Record<string, string> = {
      link: 'Links',
      text: 'Text',
      image: 'Images',
      video: 'Videos',
      article: 'Articles'
    };

    mediaTypes.forEach((count, type) => {
      if (count > 0) {
        filterMap.set(`media-${type}`, {
          label: mediaTypeLabels[type] || type,
          count,
          type: 'media'
        });
      }
    });

    // Add domain filters
    domains.forEach((count, domain) => {
      filterMap.set(`domain-${domain}`, {
        label: domain,
        count,
        type: 'domain'
      });
    });

    return Array.from(filterMap.entries()).map(([id, data]) => ({
      id,
      ...data
    }));
  };

  // Filter items based on selected filter
  const filteredItems = selectedSource
    ? items.filter((item) => {
        if (selectedSource.startsWith('media-')) {
          const mediaType = selectedSource.replace('media-', '');
          return (item.type || 'link') === mediaType;
        } else if (selectedSource.startsWith('domain-')) {
          const domain = selectedSource.replace('domain-', '');
          if (!item.url) return false;
          try {
            const url = new URL(item.url.startsWith('http') ? item.url : `https://${item.url}`);
            const itemDomain = url.hostname.replace('www.', '');
            return itemDomain === domain;
          } catch {
            return domain === 'unknown';
          }
        }
        return false;
      })
    : items;

  return (
    <div className="dashboard">
      {/* Header */}
      <header className="dashboard-header glass">
        <div className="header-content">
          <h1 className="dashboard-logo">4Later</h1>
          <div className="header-actions">
            <div className="user-info">
              {user?.photoURL ? (
                <img src={user.photoURL} alt={user.displayName || 'User'} className="user-avatar" />
              ) : (
                <div className="user-avatar-placeholder">
                  {user?.displayName?.[0] || user?.email?.[0] || 'U'}
                </div>
              )}
              <span className="user-name">{user?.displayName || user?.email}</span>
            </div>
            <button onClick={handleSignOut} className="btn-icon" title="Sign out">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
      />

      {/* Source Filter */}
      {items.length > 0 && (
        <SourceFilter
          options={getFilterOptions()}
          selectedFilter={selectedSource}
          onFilterChange={setSelectedSource}
        />
      )}

      {/* Main Content */}
      <main className="dashboard-main">
        <div className="container">
          {filteredItems.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📭</div>
              <h2>No items found</h2>
              <p>
                {selectedSource 
                  ? `No items match the selected filter. Try selecting a different filter.`
                  : selectedListId 
                  ? 'This list is empty. Add your first item!' 
                  : 'Start saving content by clicking the + button'}
              </p>
              {selectedSource && (
                <button 
                  className="btn-primary"
                  onClick={() => setSelectedSource(null)}
                  style={{ marginTop: 'var(--spacing-md)' }}
                >
                  Clear Filter
                </button>
              )}
            </div>
          ) : (
            <div className="content-grid">
              {filteredItems.map((item) => (
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
        <AddItemModal onClose={() => setShowAddItem(false)} />
      )}
      
      {showAddList && (
        <AddListModal onClose={() => setShowAddList(false)} />
      )}
      
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
    </div>
  );
};

export default Dashboard;
