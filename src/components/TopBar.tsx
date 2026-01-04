import React from 'react';
import { List } from '@/types';
import './TopBar.css';

interface TopBarProps {
  lists: List[];
  selectedListId: string | null;
  onSelectList: (listId: string | null) => void;
  onAddList: () => void;
}

const TopBar: React.FC<TopBarProps> = ({ lists, selectedListId, onSelectList, onAddList }) => {
  return (
    <div className="topbar glass">
      <div className="topbar-scroll">
        <button
          className={`topbar-chip ${selectedListId === null ? 'active' : ''}`}
          onClick={() => onSelectList(null)}
        >
          <span>All</span>
        </button>
        
        {lists.map((list) => (
          <button
            key={list.id}
            className={`topbar-chip ${selectedListId === list.id ? 'active' : ''}`}
            onClick={() => onSelectList(list.id)}
          >
            {list.icon && <span className="chip-icon">{list.icon}</span>}
            <span>{list.name}</span>
            {list.itemCount !== undefined && list.itemCount > 0 && (
              <span className="chip-count">{list.itemCount}</span>
            )}
          </button>
        ))}
        
        <button className="topbar-chip add-chip" onClick={onAddList}>
          <span>+</span>
        </button>
      </div>
    </div>
  );
};

export default TopBar;
