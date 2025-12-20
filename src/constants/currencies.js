// Moedas suportadas pelo sistema
// Para adicionar nova moeda, basta adicionar um objeto neste array

export const CURRENCIES = [
  {
    code: 'BRL',
    symbol: 'R$',
    locale: 'pt-BR',
    name: 'Real Brasileiro',
    flag: '🇧🇷',
    decimalPlaces: 2
  },
  {
    code: 'USD',
    symbol: '$',
    locale: 'en-US',
    name: 'Dólar Americano',
    flag: '🇺🇸',
    decimalPlaces: 2
  },
  {
    code: 'CLP',
    symbol: '$',
    locale: 'es-CL',
    name: 'Peso Chileno',
    flag: '🇨🇱',
    decimalPlaces: 0  // Peso chileno não usa centavos
  },
];

// Moeda padrão
export const DEFAULT_CURRENCY = CURRENCIES[0]; // BRL

// Helper para encontrar moeda por código
export const getCurrencyByCode = (code) => {
  return CURRENCIES.find(c => c.code === code) || DEFAULT_CURRENCY;
};
