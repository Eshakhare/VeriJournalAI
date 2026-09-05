import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { CapabilitiesResponse } from '../types/contract';
import { useAuth } from './AuthContext';

interface CapabilitiesContextValue {
  capabilities: CapabilitiesResponse['capabilities'] | null;
  loading: boolean;
  error: string | null;
  refreshCapabilities: () => Promise<void>;
  isMaintenanceMode: boolean;
  isAppCheckEnforced: boolean;
}

const defaultCapabilities: CapabilitiesResponse['capabilities'] = {
  textVerification: false,
  urlVerification: false,
  socialVerification: false,
  imageProvenance: false,
  youtubeVideo: false,
  shortVideoUpload: false,
  c2paInspection: false,
  maps: false,
  appCheckEnforced: false,
  maintenanceMode: false,
};

const CapabilitiesContext = createContext<CapabilitiesContextValue | undefined>(undefined);

export const CapabilitiesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { principal, apiClient } = useAuth();
  const [capabilities, setCapabilities] = useState<CapabilitiesResponse['capabilities'] | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCapabilities = useCallback(async () => {
    if (!principal) {
      setCapabilities(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const resp = await apiClient.getCapabilities();
      setCapabilities(resp.capabilities);
    } catch (err) {
      console.warn('Failed to load presentation capabilities; failing closed:', err);
      setError(err instanceof Error ? err.message : 'Failed to negotiate client capabilities');
      // Fail closed: cost-bearing features disabled, maintenance or read-only mode active
      setCapabilities({
        ...defaultCapabilities,
        maintenanceMode: true,
      });
    } finally {
      setLoading(false);
    }
  }, [principal, apiClient]);

  useEffect(() => {
    fetchCapabilities();
  }, [fetchCapabilities]);

  const value: CapabilitiesContextValue = {
    capabilities,
    loading,
    error,
    refreshCapabilities: fetchCapabilities,
    isMaintenanceMode: capabilities?.maintenanceMode ?? false,
    isAppCheckEnforced: capabilities?.appCheckEnforced ?? false,
  };

  return <CapabilitiesContext.Provider value={value}>{children}</CapabilitiesContext.Provider>;
};

export function useCapabilities(): CapabilitiesContextValue {
  const context = useContext(CapabilitiesContext);
  if (!context) {
    throw new Error('useCapabilities must be used within a CapabilitiesProvider');
  }
  return context;
}
