// Currency formatting utilities for Brazilian Real (BRL)

/**
 * Format a raw input value to Brazilian currency format
 * User types digits, function returns formatted string
 * Example: "10000" -> "100,00"
 */
export const formatCurrencyInput = (value) => {
    // Remove everything except digits
    const digits = String(value).replace(/\D/g, '');

    // Convert to number (in cents)
    const cents = parseInt(digits || '0', 10);

    // Convert to reais with 2 decimal places
    const reais = (cents / 100).toFixed(2);

    // Format with Brazilian locale
    return new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(parseFloat(reais));
};

/**
 * Parse a formatted Brazilian currency string to a number
 * Example: "1.500,00" -> 1500.00
 */
export const parseCurrencyToNumber = (formattedValue) => {
    if (!formattedValue) return 0;
    // Remove dots (thousands separator) and replace comma with dot (decimal)
    const cleaned = String(formattedValue).replace(/\./g, '').replace(',', '.');
    return parseFloat(cleaned) || 0;
};

/**
 * Format a number to Brazilian currency display (with R$ symbol)
 * Example: 1500 -> "R$ 1.500,00"
 */
export const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value || 0);
};

/**
 * Format a number to Brazilian currency display (without R$ symbol)
 * Example: 1500 -> "1.500,00"
 */
export const formatCurrencyValue = (value) => {
    return new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(value || 0);
};

/**
 * Convert a number to formatted input value (for editing existing values)
 * Example: 100.50 -> "100,50"
 */
export const numberToInputFormat = (num) => {
    if (!num && num !== 0) return '';
    const cents = Math.round(parseFloat(num) * 100);
    return formatCurrencyInput(cents.toString());
};
