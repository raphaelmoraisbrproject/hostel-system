import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { DEFAULT_CURRENCY, getCurrencyByCode } from '../constants/currencies';

const SettingsContext = createContext(null);

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

export const SettingsProvider = ({ children }) => {
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [loading, setLoading] = useState(true);

  // Buscar configurações do banco
  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('key, value')
        .is('organization_id', null); // Global settings

      if (error) throw error;

      // Processar configurações
      data?.forEach(setting => {
        if (setting.key === 'currency') {
          const currencyConfig = setting.value;
          setCurrency(currencyConfig);
        }
      });
    } catch (error) {
      console.error('Error fetching settings:', error);
      // Usa configuração padrão em caso de erro
    } finally {
      setLoading(false);
    }
  };

  // Atualizar moeda
  const updateCurrency = async (currencyCode) => {
    const newCurrency = getCurrencyByCode(currencyCode);

    try {
      const { error } = await supabase
        .from('settings')
        .update({ value: newCurrency })
        .eq('key', 'currency')
        .is('organization_id', null);

      if (error) throw error;

      setCurrency(newCurrency);
      return { success: true };
    } catch (error) {
      console.error('Error updating currency:', error);
      return { success: false, error: error.message };
    }
  };

  const value = {
    currency,
    updateCurrency,
    loading,
    refetch: fetchSettings
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};
