import { useState } from 'react';
import { Settings as SettingsIcon, DollarSign, Check, Globe } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import { CURRENCIES } from '../constants/currencies';
import { useCurrency } from '../hooks/useCurrency';

const Settings = () => {
  const { currency, updateCurrency, loading } = useSettings();
  const { formatCurrency } = useCurrency();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const handleCurrencyChange = async (currencyCode) => {
    setSaving(true);
    setMessage(null);

    const result = await updateCurrency(currencyCode);

    if (result.success) {
      setMessage({ type: 'success', text: 'Moeda atualizada com sucesso!' });
    } else {
      setMessage({ type: 'error', text: 'Erro ao atualizar moeda: ' + result.error });
    }

    setSaving(false);

    // Limpar mensagem após 3 segundos
    setTimeout(() => setMessage(null), 3000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  // Valores de exemplo para preview
  const exampleValues = [100, 1500, 25000.50];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-emerald-100 rounded-lg">
          <SettingsIcon size={24} className="text-emerald-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
          <p className="text-gray-500">Gerencie as configurações do sistema</p>
        </div>
      </div>

      {/* Mensagem de feedback */}
      {message && (
        <div className={`p-4 rounded-lg flex items-center gap-2 ${
          message.type === 'success'
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.type === 'success' ? <Check size={18} /> : null}
          {message.text}
        </div>
      )}

      {/* Seção de Moeda */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
          <DollarSign size={20} className="text-gray-600" />
          <div>
            <h2 className="font-semibold text-gray-900">Moeda</h2>
            <p className="text-sm text-gray-500">Escolha a moeda para exibição de valores</p>
          </div>
        </div>

        <div className="p-6">
          {/* Grid de moedas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {CURRENCIES.map((curr) => (
              <button
                key={curr.code}
                onClick={() => handleCurrencyChange(curr.code)}
                disabled={saving}
                className={`p-4 rounded-xl border-2 transition-all text-left ${
                  currency.code === curr.code
                    ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200'
                    : 'border-gray-200 hover:border-emerald-300 hover:bg-gray-50'
                } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">{curr.flag}</span>
                  {currency.code === curr.code && (
                    <span className="bg-emerald-500 text-white rounded-full p-1">
                      <Check size={14} />
                    </span>
                  )}
                </div>
                <div className="font-bold text-gray-900">{curr.code}</div>
                <div className="text-sm text-gray-500">{curr.name}</div>
                <div className="text-sm text-gray-400 mt-1">
                  Símbolo: {curr.symbol}
                </div>
              </button>
            ))}
          </div>

          {/* Preview de formatação */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Globe size={16} className="text-gray-500" />
              <span className="text-sm font-medium text-gray-600">
                Preview da formatação ({currency.code})
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {exampleValues.map((value, index) => (
                <div key={index} className="bg-white rounded-lg p-3 border border-gray-200">
                  <div className="text-xs text-gray-400 mb-1">Valor: {value}</div>
                  <div className="font-bold text-gray-900">{formatCurrency(value)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Informações adicionais */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-800 mb-2">Sobre a configuração de moeda</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• A moeda selecionada afeta apenas a <strong>exibição</strong> dos valores</li>
          <li>• Os valores armazenados no banco de dados não são convertidos</li>
          <li>• A configuração é aplicada globalmente para todo o sistema</li>
        </ul>
      </div>

      {/* Seção para futuras configurações */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center">
        <p className="text-gray-500">Mais configurações serão adicionadas em breve...</p>
      </div>
    </div>
  );
};

export default Settings;
