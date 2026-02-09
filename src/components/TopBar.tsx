import React from "react";
import { List } from "@/types";
import "./TopBar.css";

interface TopBarProps {
  lists: List[];
  selectedListId: string | null;
  onSelectList: (listId: string | null) => void;
  onAddList: () => void;
  onDeleteList: (listId: string, listName: string) => void;
}

const TopBar: React.FC<TopBarProps> = ({
  lists,
  selectedListId,
  onSelectList,
  onAddList,
  onDeleteList,
}) => {
  const handleDelete = (
    e: React.MouseEvent,
    listId: string,
    listName: string,
  ) => {
    e.stopPropagation(); // Prevent selecting the list
    if (window.confirm(`Delete "${listName}" and all its items?`)) {
      onDeleteList(listId, listName);
    }
  };

  return (
    <div className="topbar glass">
      <div className="topbar-scroll">
        <button
          className={`topbar-chip ${selectedListId === null ? "active" : ""}`}
          onClick={() => onSelectList(null)}
        >
          <span>All</span>
        </button>

        {lists.map((list) => (
          <button
            key={list.id}
            className={`topbar-chip ${selectedListId === list.id ? "active" : ""}`}
            onClick={() => onSelectList(list.id)}
          >
            {list.icon && <span className="chip-icon">{list.icon}</span>}
            <span>{list.name}</span>
            {list.itemCount !== undefined && list.itemCount > 0 && (
              <span className="chip-count">{list.itemCount}</span>
            )}
            <span
              className="chip-delete"
              onClick={(e) => handleDelete(e, list.id, list.name)}
              title={`Delete ${list.name}`}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  handleDelete(e as any, list.id, list.name);
                }
              }}
            >
              ×
            </span>
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
