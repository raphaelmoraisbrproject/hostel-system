import { COUNTRIES } from './countries';

// Popular countries shown first in the dropdown
export const POPULAR_COUNTRIES = ['BR', 'AR', 'US', 'PT', 'ES', 'FR', 'DE', 'GB', 'IT', 'CL', 'CO', 'MX', 'UY', 'PY'];

// Country options formatted for react-select with grouped options
export const countryOptions = [
    {
        label: 'Mais comuns',
        options: COUNTRIES
            .filter(c => POPULAR_COUNTRIES.includes(c.code))
            .sort((a, b) => POPULAR_COUNTRIES.indexOf(a.code) - POPULAR_COUNTRIES.indexOf(b.code))
            .map(c => ({ value: c.name, label: c.name }))
    },
    {
        label: 'Todos os países',
        options: COUNTRIES.map(c => ({ value: c.name, label: c.name }))
    }
];
