import React from "react";
import { List } from "@/types";
import "./TopBar.css";

interface TopBarProps {
  lists: List[];
  selectedListId: string | null;
  availableTags: string[];
  selectedTags: string[];
  onSelectList: (listId: string | null) => void;
  onToggleTag: (tag: string) => void;
  onClearTags: () => void;
  onAddList: () => void;
  onDeleteList: (listId: string, listName: string) => void;
}

const TopBar: React.FC<TopBarProps> = ({
  lists,
  selectedListId,
  availableTags,
  selectedTags,
  onSelectList,
  onToggleTag,
  onClearTags,
  onAddList,
  onDeleteList,
}) => {
  const tagsScrollRef = React.useRef<HTMLDivElement | null>(null);

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

  const orderedTags = React.useMemo(() => {
    const selectedSet = new Set(selectedTags);
    const selectedFirst = availableTags.filter((tag) => selectedSet.has(tag));
    const remaining = availableTags.filter((tag) => !selectedSet.has(tag));
    return [...selectedFirst, ...remaining];
  }, [availableTags, selectedTags]);

  const handleTagsWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const node = tagsScrollRef.current;
    if (!node) return;
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;

    e.preventDefault();
    node.scrollLeft += e.deltaY;
  };

  return (
    <div className="topbar glass">
      <div className="topbar-group">
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
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

      <div className="topbar-group topbar-group-tags">
        <div
          className="topbar-scroll topbar-scroll-tags"
          ref={tagsScrollRef}
          onWheel={handleTagsWheel}
        >
          <button
            className={`topbar-chip topbar-chip-tag ${selectedTags.length === 0 ? "active" : ""}`}
            onClick={onClearTags}
          >
            <span>All Tags</span>
          </button>

          {orderedTags.map((tag) => (
            <button
              key={tag}
              className={`topbar-chip topbar-chip-tag ${selectedTags.includes(tag) ? "active" : ""}`}
              onClick={() => onToggleTag(tag)}
            >
              <span>#{tag}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TopBar;
