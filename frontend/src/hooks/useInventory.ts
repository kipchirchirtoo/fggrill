'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import * as api from '@/api/inventory';
import type { InventoryItem, StockTransfer, ConsumptionRecord } from '@/types/inventory';

export function useInventoryItems(branch: string) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchItems() {
      try {
        const data = await api.getItems(branch);
        setItems(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch items');
        toast.error('Failed to load inventory items');
      } finally {
        setIsLoading(false);
      }
    }

    fetchItems();
  }, [branch]);

  const addItem = async (itemData: Partial<InventoryItem>) => {
    try {
      const newItem = await api.createItem(itemData);
      setItems(prev => [...prev, newItem]);
      toast.success('Item added successfully');
      return newItem;
    } catch (err) {
      toast.error('Failed to add item');
      throw err;
    }
  };

  return { items, isLoading, error, addItem };
}

export function useStockTransfers(branch: string) {
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTransfers() {
      try {
        const data = await api.getTransfers(branch);
        setTransfers(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch transfers');
        toast.error('Failed to load stock transfers');
      } finally {
        setIsLoading(false);
      }
    }

    fetchTransfers();
  }, [branch]);

  const createTransfer = async (transferData: Partial<StockTransfer>) => {
    try {
      const newTransfer = await api.createTransfer(transferData);
      setTransfers(prev => [...prev, newTransfer]);
      toast.success('Transfer created successfully');
      return newTransfer;
    } catch (err) {
      toast.error('Failed to create transfer');
      throw err;
    }
  };

  return { transfers, isLoading, error, createTransfer };
}

export function useConsumptionRecords(branch: string, department?: string) {
  const [records, setRecords] = useState<ConsumptionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRecords() {
      try {
        const data = await api.getConsumptionRecords(branch, department);
        setRecords(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch consumption records');
        toast.error('Failed to load consumption records');
      } finally {
        setIsLoading(false);
      }
    }

    fetchRecords();
  }, [branch, department]);

  const recordConsumption = async (recordData: Partial<ConsumptionRecord>) => {
    try {
      const newRecord = await api.recordConsumption(recordData);
      setRecords(prev => [...prev, newRecord]);
      toast.success('Consumption recorded successfully');
      return newRecord;
    } catch (err) {
      toast.error('Failed to record consumption');
      throw err;
    }
  };

  return { records, isLoading, error, recordConsumption };
}

export function useLowStockAlerts(branch: string) {
  const [alerts, setAlerts] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAlerts() {
      try {
        const data = await api.getLowStockAlerts(branch);
        setAlerts(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch alerts');
        toast.error('Failed to load stock alerts');
      } finally {
        setIsLoading(false);
      }
    }

    fetchAlerts();
  }, [branch]);

  return { alerts, isLoading, error };
}
