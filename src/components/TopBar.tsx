import React from "react";
import { List } from "@/types";
import "./TopBar.css";

export interface SourceOption {
  id: string;
  label: string;
  count: number;
}

interface TopBarProps {
  lists: List[];
  selectedListId: string | null;
  availableTags: string[];
  selectedTags: string[];
  sourceOptions: SourceOption[];
  selectedSourceFilter: string | null;
  searchQuery: string;
  onSelectList: (listId: string | null) => void;
  onToggleTag: (tag: string) => void;
  onClearTags: () => void;
  onSourceFilterChange: (source: string | null) => void;
  onSearchChange: (query: string) => void;
  onAddList: () => void;
  onDeleteList: (listId: string, listName: string) => void;
}

const TopBar: React.FC<TopBarProps> = ({
  lists,
  selectedListId,
  availableTags,
  selectedTags,
  sourceOptions,
  selectedSourceFilter,
  searchQuery,
  onSelectList,
  onToggleTag,
  onClearTags,
  onSourceFilterChange,
  onSearchChange,
  onAddList,
  onDeleteList,
}) => {
  const tagsScrollRef = React.useRef<HTMLDivElement | null>(null);
  const searchInputRef = React.useRef<HTMLInputElement | null>(null);

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

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      onSearchChange("");
      searchInputRef.current?.blur();
    }
  };

  const hasSourceOptions = sourceOptions.length > 0;

  return (
    <div className="topbar glass">
      {/* Search row */}
      <div className="topbar-group topbar-group-search">
        <div className="topbar-search-wrap">
          <svg
            className="topbar-search-icon"
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={searchInputRef}
            className="topbar-search-input"
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search titles, URLs, notes, tags…"
            aria-label="Search saved items"
          />
          {searchQuery && (
            <button
              className="topbar-search-clear"
              onClick={() => onSearchChange("")}
              aria-label="Clear search"
              type="button"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Lists row */}
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

      {/* Tags row */}
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

      {/* Source filter row */}
      {hasSourceOptions && (
        <div className="topbar-group topbar-group-sources">
          <div className="topbar-scroll topbar-scroll-sources">
            <button
              className={`topbar-chip topbar-chip-source ${selectedSourceFilter === null ? "active" : ""}`}
              onClick={() => onSourceFilterChange(null)}
            >
              <span>All Sources</span>
            </button>

            {sourceOptions.map((opt) => (
              <button
                key={opt.id}
                className={`topbar-chip topbar-chip-source ${selectedSourceFilter === opt.id ? "active" : ""}`}
                onClick={() => onSourceFilterChange(opt.id)}
              >
                <span>{opt.label}</span>
                <span className="chip-count">{opt.count}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TopBar;
