import React from 'react';
import { AlertCircle, CheckCircle, AlertTriangle, X } from 'lucide-react';

const AlertModal = ({ isOpen, onClose, title, message, type = 'error' }) => {
    if (!isOpen) return null;

    const getStyles = () => {
        switch (type) {
            case 'error':
                return {
                    iconColor: 'text-red-600 bg-red-100',
                    buttonColor: 'bg-red-600 hover:bg-red-700',
                    Icon: AlertCircle
                };
            case 'warning':
                return {
                    iconColor: 'text-amber-600 bg-amber-100',
                    buttonColor: 'bg-amber-600 hover:bg-amber-700',
                    Icon: AlertTriangle
                };
            case 'success':
            default:
                return {
                    iconColor: 'text-emerald-600 bg-emerald-100',
                    buttonColor: 'bg-emerald-600 hover:bg-emerald-700',
                    Icon: CheckCircle
                };
        }
    };

    const { iconColor, buttonColor, Icon } = getStyles();

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60] animate-in fade-in duration-200">
            <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-xl transform transition-all scale-100">
                <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${iconColor}`}>
                            <Icon size={24} />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900">{title}</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <p className="text-gray-600 mb-6 ml-1 whitespace-pre-line">
                    {message}
                </p>

                <div className="flex justify-end">
                    <button
                        onClick={onClose}
                        className={`px-6 py-2 text-white rounded-lg font-medium shadow-sm transition-colors ${buttonColor}`}
                    >
                        OK
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AlertModal;
