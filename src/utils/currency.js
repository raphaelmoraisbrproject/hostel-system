// Currency formatting utilities
// NOTA: Para novos componentes, use o hook useCurrency() que usa a configuração global
// Estas funções são mantidas para compatibilidade e aceitam configuração opcional

import { DEFAULT_CURRENCY } from '../constants/currencies';

/**
 * Format a raw input value to currency format
 * User types digits, function returns formatted string
 * Example: "10000" -> "100,00" (BRL) or "100.00" (USD)
 */
export const formatCurrencyInput = (value, currency = DEFAULT_CURRENCY) => {
    // Remove everything except digits
    const digits = String(value).replace(/\D/g, '');

    // Convert to number (smallest unit)
    const smallestUnit = parseInt(digits || '0', 10);

    // Convert to main unit with decimal places
    const divisor = Math.pow(10, currency.decimalPlaces);
    const mainUnit = (smallestUnit / divisor).toFixed(currency.decimalPlaces);

    // Format with locale
    return new Intl.NumberFormat(currency.locale, {
        minimumFractionDigits: currency.decimalPlaces,
        maximumFractionDigits: currency.decimalPlaces
    }).format(parseFloat(mainUnit));
};

/**
 * Parse a formatted currency string to a number
 * Example: "1.500,00" -> 1500.00 (pt-BR) or "1,500.00" -> 1500.00 (en-US)
 */
export const parseCurrencyToNumber = (formattedValue, currency = DEFAULT_CURRENCY) => {
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
 * Format a number to currency display (with symbol)
 * Example: 1500 -> "R$ 1.500,00" or "$ 1,500.00"
 */
export const formatCurrency = (value, currency = DEFAULT_CURRENCY) => {
    return new Intl.NumberFormat(currency.locale, {
        style: 'currency',
        currency: currency.code,
        minimumFractionDigits: currency.decimalPlaces,
        maximumFractionDigits: currency.decimalPlaces
    }).format(value || 0);
};

/**
 * Format a number to currency display (without symbol)
 * Example: 1500 -> "1.500,00" or "1,500.00"
 */
export const formatCurrencyValue = (value, currency = DEFAULT_CURRENCY) => {
    return new Intl.NumberFormat(currency.locale, {
        minimumFractionDigits: currency.decimalPlaces,
        maximumFractionDigits: currency.decimalPlaces
    }).format(value || 0);
};

/**
 * Convert a number to formatted input value (for editing existing values)
 * Example: 100.50 -> "100,50" (pt-BR) or "100.50" (en-US)
 */
export const numberToInputFormat = (num, currency = DEFAULT_CURRENCY) => {
    if (!num && num !== 0) return '';
    const multiplier = Math.pow(10, currency.decimalPlaces);
    const smallestUnit = Math.round(parseFloat(num) * multiplier);
    return formatCurrencyInput(smallestUnit.toString(), currency);
};
