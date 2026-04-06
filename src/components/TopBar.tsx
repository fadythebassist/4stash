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
  onSelectList: (listId: string | null) => void;
  onToggleTag: (tag: string) => void;
  onClearTags: () => void;
  onSourceFilterChange: (source: string | null) => void;
  onAddList: () => void;
  onDeleteList: (listId: string, listName: string) => void;
}

// Returns mouse-drag handlers and a ref for a horizontally scrollable element.
// Wheel-to-scroll is attached as a non-passive native listener so preventDefault works.
function useHorizontalScroll() {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const isDragging = React.useRef(false);
  const startX = React.useRef(0);
  const scrollLeft = React.useRef(0);

  // Attach a non-passive wheel listener so we can call preventDefault() and
  // convert vertical wheel delta into horizontal scroll on desktop.
  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const handleWheel = (e: WheelEvent) => {
      // Only hijack vertical wheel; horizontal wheel (trackpad) works natively.
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      e.preventDefault();
      node.scrollLeft += e.deltaY;
    };
    node.addEventListener("wheel", handleWheel, { passive: false });
    return () => node.removeEventListener("wheel", handleWheel);
  }, []);

  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const node = ref.current;
    if (!node) return;
    isDragging.current = true;
    startX.current = e.pageX - node.offsetLeft;
    scrollLeft.current = node.scrollLeft;
    node.style.cursor = "grabbing";
    node.style.userSelect = "none";
  };

  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    const node = ref.current;
    if (!node) return;
    const x = e.pageX - node.offsetLeft;
    const walk = (x - startX.current) * 1.2;
    node.scrollLeft = scrollLeft.current - walk;
  };

  const onMouseUp = () => {
    isDragging.current = false;
    const node = ref.current;
    if (!node) return;
    node.style.cursor = "grab";
    node.style.userSelect = "";
  };

  const onMouseLeave = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const node = ref.current;
    if (!node) return;
    node.style.cursor = "grab";
    node.style.userSelect = "";
  };

  return { ref, onMouseDown, onMouseMove, onMouseUp, onMouseLeave };
}

const TopBar: React.FC<TopBarProps> = ({
  lists,
  selectedListId,
  availableTags,
  selectedTags,
  sourceOptions,
  selectedSourceFilter,
  onSelectList,
  onToggleTag,
  onClearTags,
  onSourceFilterChange,
  onAddList,
  onDeleteList,
}) => {
  const listsScroll = useHorizontalScroll();
  const tagsScroll = useHorizontalScroll();
  const sourcesScroll = useHorizontalScroll();

  const handleDelete = (
    e: React.MouseEvent,
    listId: string,
    listName: string,
  ) => {
    e.stopPropagation();
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

  const hasSourceOptions = sourceOptions.length > 0;

  return (
    <div className="topbar glass">
      {/* Lists row */}
      <div className="topbar-group">
        <div
          className="topbar-scroll topbar-scroll-grabbable"
          ref={listsScroll.ref}
          onMouseDown={listsScroll.onMouseDown}
          onMouseMove={listsScroll.onMouseMove}
          onMouseUp={listsScroll.onMouseUp}
          onMouseLeave={listsScroll.onMouseLeave}
        >
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
          className="topbar-scroll topbar-scroll-tags topbar-scroll-grabbable"
          ref={tagsScroll.ref}
          onMouseDown={tagsScroll.onMouseDown}
          onMouseMove={tagsScroll.onMouseMove}
          onMouseUp={tagsScroll.onMouseUp}
          onMouseLeave={tagsScroll.onMouseLeave}
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
          <div
          className="topbar-scroll topbar-scroll-sources topbar-scroll-grabbable"
          ref={sourcesScroll.ref}
          onMouseDown={sourcesScroll.onMouseDown}
            onMouseMove={sourcesScroll.onMouseMove}
            onMouseUp={sourcesScroll.onMouseUp}
            onMouseLeave={sourcesScroll.onMouseLeave}
          >
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
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TopBar;
