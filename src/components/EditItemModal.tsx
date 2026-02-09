import React, { useState } from "react";
import { Item, List } from "@/types";
import { useData } from "@/contexts/DataContext";
import "./Modal.css";

interface EditItemModalProps {
  item: Item;
  lists: List[];
  onClose: () => void;
  onSave: () => void;
}

const EditItemModal: React.FC<EditItemModalProps> = ({
  item,
  lists,
  onClose,
  onSave,
}) => {
  const { updateItem } = useData();
  const [title, setTitle] = useState(item.title);
  const [content, setContent] = useState(item.content || "");
  const [listId, setListId] = useState(item.listId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentList = lists.find((l) => l.id === item.listId);
  const newList = lists.find((l) => l.id === listId);
  const isMoving = listId !== item.listId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await updateItem({
        id: item.id,
        title: title.trim() || item.title,
        content: content.trim() || undefined,
        listId,
      });
      onSave();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content slide-in-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>Edit Item</h2>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label htmlFor="title">Title</label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Item title"
              disabled={loading}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="content">Notes</label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Add any notes or description..."
              rows={4}
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="list">
              List
              {isMoving && (
                <span
                  style={{
                    color: "var(--accent-primary)",
                    marginLeft: "0.5rem",
                    fontSize: "0.85rem",
                  }}
                >
                  (Moving from {currentList?.name || "Unknown"})
                </span>
              )}
            </label>
            <select
              id="list"
              value={listId}
              onChange={(e) => setListId(e.target.value)}
              disabled={loading}
            >
              {lists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.icon} {list.name}
                </option>
              ))}
            </select>
            {isMoving && (
              <div
                style={{
                  marginTop: "0.5rem",
                  padding: "0.75rem",
                  background: "var(--bg-tertiary)",
                  borderRadius: "var(--radius-md)",
                  fontSize: "0.875rem",
                  color: "var(--text-secondary)",
                }}
              >
                This item will be moved to <strong>{newList?.name}</strong>
              </div>
            )}
          </div>

          {error && (
            <div
              style={{
                padding: "0.75rem",
                background: "rgba(239, 68, 68, 0.1)",
                color: "var(--error)",
                borderRadius: "var(--radius-md)",
                fontSize: "0.875rem",
              }}
            >
              {error}
            </div>
          )}

          <div className="modal-actions">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? "Saving..." : isMoving ? "Move Item" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditItemModal;
