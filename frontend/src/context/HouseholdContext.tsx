import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiRequest } from '../services/api';
import { useAuth } from './AuthContext';

export interface Household {
  id: number;
  name: string;
  description?: string;
  owner_id: number;
  is_personal: boolean;
}

interface HouseholdContextType {
  households: Household[];
  activeHousehold: Household | null;
  loading: boolean;
  setActiveHouseholdId: (id: number) => void;
  refreshHouseholds: () => Promise<void>;
}

const HouseholdContext = createContext<HouseholdContextType | undefined>(undefined);

export const HouseholdProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [households, setHouseholds] = useState<Household[]>([]);
  const [activeHousehold, setActiveHousehold] = useState<Household | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchHouseholds = async () => {
    if (!user) {
      setHouseholds([]);
      setActiveHousehold(null);
      return;
    }
    setLoading(true);
    try {
      const data = await apiRequest<Household[]>('/households');
      setHouseholds(data);

      const storedId = localStorage.getItem('active_household_id');
      if (storedId) {
        const found = data.find(h => h.id === Number(storedId));
        if (found) {
          setActiveHousehold(found);
          return;
        }
      }
      if (data.length > 0) {
        setActiveHousehold(data[0]);
        localStorage.setItem('active_household_id', String(data[0].id));
      }
    } catch (err) {
      console.warn('Error fetching households:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHouseholds();
  }, [user]);

  const setActiveHouseholdId = (id: number) => {
    const found = households.find(h => h.id === id);
    if (found) {
      setActiveHousehold(found);
      localStorage.setItem('active_household_id', String(id));
    }
  };

  return (
    <HouseholdContext.Provider
      value={{
        households,
        activeHousehold,
        loading,
        setActiveHouseholdId,
        refreshHouseholds: fetchHouseholds
      }}
    >
      {children}
    </HouseholdContext.Provider>
  );
};

export const useHousehold = () => {
  const context = useContext(HouseholdContext);
  if (!context) {
    throw new Error('useHousehold must be used within a HouseholdProvider');
  }
  return context;
};
