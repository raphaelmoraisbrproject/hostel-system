import { useSettings } from '../contexts/SettingsContext';

/**
 * Hook para formatação de moeda usando a configuração global
 *
 * Uso:
 * const { formatCurrency, formatValue, formatInput, parseInput } = useCurrency();
 * formatCurrency(1500) // "R$ 1.500,00" ou "$ 1,500.00" conforme config
 */
export const useCurrency = () => {
  const { currency } = useSettings();

  /**
   * Formata valor para exibição com símbolo da moeda
   * Ex: 1500 -> "R$ 1.500,00" ou "$ 1,500.00"
   */
  const formatCurrency = (value) => {
    return new Intl.NumberFormat(currency.locale, {
      style: 'currency',
      currency: currency.code,
      minimumFractionDigits: currency.decimalPlaces,
      maximumFractionDigits: currency.decimalPlaces
    }).format(value || 0);
  };

  /**
   * Formata valor para exibição SEM símbolo da moeda
   * Ex: 1500 -> "1.500,00" ou "1,500.00"
   */
  const formatValue = (value) => {
    return new Intl.NumberFormat(currency.locale, {
      minimumFractionDigits: currency.decimalPlaces,
      maximumFractionDigits: currency.decimalPlaces
    }).format(value || 0);
  };

  /**
   * Formata input do usuário para exibição no campo
   * O usuário digita apenas números, função formata em tempo real
   */
  const formatInput = (rawValue) => {
    // Remove tudo exceto dígitos
    const digits = String(rawValue).replace(/\D/g, '');
    const numericValue = parseInt(digits || '0', 10);

    // Divide pelo fator de casas decimais
    const divisor = Math.pow(10, currency.decimalPlaces);
    const realValue = numericValue / divisor;

    return new Intl.NumberFormat(currency.locale, {
      minimumFractionDigits: currency.decimalPlaces,
      maximumFractionDigits: currency.decimalPlaces
    }).format(realValue);
  };

  /**
   * Converte string formatada para número
   * Ex: "1.500,00" -> 1500.00 (pt-BR)
   * Ex: "1,500.00" -> 1500.00 (en-US)
   */
  const parseInput = (formattedValue) => {
    if (!formattedValue) return 0;

    // Detecta separadores baseado no locale
    if (currency.locale.startsWith('pt') || currency.locale.startsWith('es')) {
      // pt-BR, es-CL: 1.500,00 -> 1500.00
      const cleaned = String(formattedValue).replace(/\./g, '').replace(',', '.');
      return parseFloat(cleaned) || 0;
    } else {
      // en-US: 1,500.00 -> 1500.00
      const cleaned = String(formattedValue).replace(/,/g, '');
      return parseFloat(cleaned) || 0;
    }
  };

  /**
   * Converte número para formato de input (para edição)
   * Ex: 1500.00 -> "1.500,00" (pt-BR)
   */
  const numberToInput = (num) => {
    if (!num && num !== 0) return '';
    const divisor = Math.pow(10, currency.decimalPlaces);
    const cents = Math.round(parseFloat(num) * divisor);
    return formatInput(cents.toString());
  };

  return {
    currency,
    formatCurrency,
    formatValue,
    formatInput,
    parseInput,
    numberToInput
  };
};

export default useCurrency;
