import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Item, List, CreateItemDTO, UpdateItemDTO, CreateListDTO, UpdateListDTO } from '@/types';
import { StorageService } from '@/services/StorageService';
import { mockStorageService } from '@/services/MockStorageService';
import { useAuth } from './AuthContext';

interface DataContextType {
  lists: List[];
  items: Item[];
  selectedListId: string | null;
  loading: boolean;
  error: string | null;
  
  // List operations
  selectList: (listId: string | null) => void;
  createList: (data: CreateListDTO) => Promise<List>;
  updateList: (data: UpdateListDTO) => Promise<void>;
  deleteList: (listId: string) => Promise<void>;
  
  // Item operations
  createItem: (data: CreateItemDTO) => Promise<Item>;
  updateItem: (data: UpdateItemDTO) => Promise<void>;
  deleteItem: (itemId: string) => Promise<void>;
  archiveItem: (itemId: string) => Promise<void>;
  
  // Refresh data
  refreshData: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

// Service instance - can be swapped with Firebase later
const storageService: StorageService = mockStorageService;

interface DataProviderProps {
  children: ReactNode;
}

export const DataProvider: React.FC<DataProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const [lists, setLists] = useState<List[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshData = async () => {
    if (!user) {
      setLists([]);
      setItems([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [fetchedLists, fetchedItems] = await Promise.all([
        storageService.getLists(user.id),
        storageService.getItems(user.id, selectedListId || undefined)
      ]);
      setLists(fetchedLists);
      setItems(fetchedItems);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, [user, selectedListId]);

  const selectList = (listId: string | null) => {
    setSelectedListId(listId);
  };

  const createList = async (data: CreateListDTO): Promise<List> => {
    if (!user) throw new Error('No user logged in');
    
    setError(null);
    try {
      const newList = await storageService.createList(user.id, data);
      await refreshData();
      return newList;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to create list';
      setError(errorMsg);
      throw err;
    }
  };

  const updateList = async (data: UpdateListDTO): Promise<void> => {
    setError(null);
    try {
      await storageService.updateList(data);
      await refreshData();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to update list';
      setError(errorMsg);
      throw err;
    }
  };

  const deleteList = async (listId: string): Promise<void> => {
    setError(null);
    try {
      await storageService.deleteList(listId);
      if (selectedListId === listId) {
        setSelectedListId(null);
      }
      await refreshData();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to delete list';
      setError(errorMsg);
      throw err;
    }
  };

  const createItem = async (data: CreateItemDTO): Promise<Item> => {
    if (!user) throw new Error('No user logged in');
    
    setError(null);
    try {
      const newItem = await storageService.createItem(user.id, data);
      await refreshData();
      return newItem;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to create item';
      setError(errorMsg);
      throw err;
    }
  };

  const updateItem = async (data: UpdateItemDTO): Promise<void> => {
    setError(null);
    try {
      await storageService.updateItem(data);
      await refreshData();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to update item';
      setError(errorMsg);
      throw err;
    }
  };

  const deleteItem = async (itemId: string): Promise<void> => {
    setError(null);
    try {
      await storageService.deleteItem(itemId);
      await refreshData();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to delete item';
      setError(errorMsg);
      throw err;
    }
  };

  const archiveItem = async (itemId: string): Promise<void> => {
    setError(null);
    try {
      await storageService.archiveItem(itemId);
      
      // Haptic feedback if available
      if ('vibrate' in navigator) {
        navigator.vibrate(50);
      }
      
      await refreshData();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to archive item';
      setError(errorMsg);
      throw err;
    }
  };

  return (
    <DataContext.Provider
      value={{
        lists,
        items,
        selectedListId,
        loading,
        error,
        selectList,
        createList,
        updateList,
        deleteList,
        createItem,
        updateItem,
        deleteItem,
        archiveItem,
        refreshData
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};
