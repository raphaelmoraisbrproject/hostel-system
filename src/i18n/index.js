import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
    en: {
        translation: {
            "welcome": "Welcome to Hostel Manager",
            "dashboard": "Dashboard",
            "guests": "Guests",
            "rooms": "Rooms",
            "finance": "Finance",
            "settings": "Settings",
            "organization": "Organization",
            "login": "Login",
            "logout": "Logout"
        }
    },
    pt: {
        translation: {
            "welcome": "Bem-vindo ao Gerenciador de Hostel",
            "dashboard": "Painel",
            "guests": "Hóspedes",
            "rooms": "Quartos",
            "finance": "Financeiro",
            "settings": "Configurações",
            "organization": "Organização",
            "login": "Entrar",
            "logout": "Sair"
        }
    },
    es: {
        translation: {
            "welcome": "Bienvenido al Gestor de Hostal",
            "dashboard": "Panel",
            "guests": "Huéspedes",
            "rooms": "Habitaciones",
            "finance": "Finanzas",
            "settings": "Ajustes",
            "organization": "Organización",
            "login": "Entrar",
            "logout": "Salir"
        }
    }
};

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources,
        fallbackLng: 'en',
        interpolation: {
            escapeValue: false
        }
    });

export default i18n;
