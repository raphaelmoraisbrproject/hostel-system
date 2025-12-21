import { useState, useEffect } from 'react';
import { Building2, DollarSign, Check, Globe, Users, UserPlus, Copy, Trash2, Clock } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { CURRENCIES } from '../constants/currencies';
import { useCurrency } from '../hooks/useCurrency';
import { supabase } from '../lib/supabase';
import InviteUserModal from '../components/InviteUserModal';

const Organization = () => {
  const { currency, updateCurrency, loading } = useSettings();
  const { formatCurrency } = useCurrency();
  const { user, getInvites, cancelInvite } = useAuth();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [teamMembers, setTeamMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loadingTeam, setLoadingTeam] = useState(true);
  const [copiedInviteId, setCopiedInviteId] = useState(null);
  const [userProfile, setUserProfile] = useState(null);

  useEffect(() => {
    fetchUserProfile();
    fetchTeamData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchUserProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user?.id)
        .single();

      if (error) throw error;
      setUserProfile(data);
    } catch (err) {
      console.error('Error fetching user profile:', err);
    }
  };

  const fetchTeamData = async () => {
    setLoadingTeam(true);
    try {
      // Fetch team members
      const { data: members, error: membersError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (membersError) throw membersError;
      setTeamMembers(members || []);

      // Fetch pending invites
      const invitesData = await getInvites();
      setInvites(invitesData || []);
    } catch (err) {
      console.error('Error fetching team data:', err);
      setMessage({ type: 'error', text: 'Erro ao carregar dados da equipe' });
    } finally {
      setLoadingTeam(false);
    }
  };

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

  const handleCopyInviteUrl = async (token, inviteId) => {
    try {
      const url = `${window.location.origin}/register/${token}`;
      await navigator.clipboard.writeText(url);
      setCopiedInviteId(inviteId);
      setTimeout(() => setCopiedInviteId(null), 2000);
    } catch (err) {
      console.error('Error copying to clipboard:', err);
      setMessage({ type: 'error', text: 'Erro ao copiar URL' });
    }
  };

  const handleCancelInvite = async (inviteId) => {
    if (!confirm('Tem certeza que deseja cancelar este convite?')) {
      return;
    }

    try {
      await cancelInvite(inviteId);
      setMessage({ type: 'success', text: 'Convite cancelado com sucesso!' });
      fetchTeamData();
    } catch (err) {
      console.error('Error canceling invite:', err);
      setMessage({ type: 'error', text: 'Erro ao cancelar convite' });
    }
  };

  const handleInviteSuccess = () => {
    setMessage({ type: 'success', text: 'Convite criado com sucesso!' });
    fetchTeamData();
  };

  const getRoleBadgeColor = (role) => {
    const colors = {
      admin: 'bg-purple-100 text-purple-800',
      manager: 'bg-blue-100 text-blue-800',
      employee: 'bg-green-100 text-green-800',
      volunteer: 'bg-yellow-100 text-yellow-800',
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
  };

  const getRoleLabel = (role) => {
    const labels = {
      admin: 'Administrador',
      manager: 'Gerente',
      employee: 'Funcionário',
      volunteer: 'Voluntário',
    };
    return labels[role] || role;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const isAdmin = userProfile?.role === 'admin';

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
          <Building2 size={24} className="text-emerald-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Organização</h1>
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

      {/* Seção de Equipe - Apenas para Admin */}
      {isAdmin && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users size={20} className="text-gray-600" />
              <div>
                <h2 className="font-semibold text-gray-900">Equipe</h2>
                <p className="text-sm text-gray-500">Gerencie membros e convites da equipe</p>
              </div>
            </div>
            <button
              onClick={() => setIsInviteModalOpen(true)}
              className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors"
            >
              <UserPlus size={18} />
              Convidar Usuário
            </button>
          </div>

          <div className="p-6">
            {loadingTeam ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Lista de Membros */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">
                    Membros da Equipe ({teamMembers.length})
                  </h3>
                  <div className="space-y-2">
                    {teamMembers.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                            <span className="text-emerald-600 font-medium">
                              {member.full_name?.charAt(0)?.toUpperCase() || '?'}
                            </span>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {member.full_name}
                            </div>
                            <div className="text-xs text-gray-500">{member.email}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span
                            className={`px-3 py-1 text-xs font-semibold rounded-full ${getRoleBadgeColor(
                              member.role
                            )}`}
                          >
                            {getRoleLabel(member.role)}
                          </span>
                          <span
                            className={`px-3 py-1 text-xs font-semibold rounded-full ${
                              member.is_active
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {member.is_active ? 'Ativo' : 'Inativo'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Lista de Convites Pendentes */}
                {invites.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">
                      Convites Pendentes ({invites.length})
                    </h3>
                    <div className="space-y-2">
                      {invites.map((invite) => (
                        <div
                          key={invite.id}
                          className="flex items-center justify-between p-4 bg-amber-50 rounded-lg border border-amber-200"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
                              <Clock size={20} className="text-amber-600" />
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {invite.email}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                <span>Expira em: {formatDate(invite.expires_at)}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span
                              className={`px-3 py-1 text-xs font-semibold rounded-full ${getRoleBadgeColor(
                                invite.role
                              )}`}
                            >
                              {getRoleLabel(invite.role)}
                            </span>
                            <button
                              onClick={() => handleCopyInviteUrl(invite.token, invite.id)}
                              className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                              title="Copiar URL do convite"
                            >
                              {copiedInviteId === invite.id ? (
                                <Check size={18} />
                              ) : (
                                <Copy size={18} />
                              )}
                            </button>
                            <button
                              onClick={() => handleCancelInvite(invite.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Cancelar convite"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {teamMembers.length === 0 && invites.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    Nenhum membro ou convite encontrado
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Seção para futuras configurações */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center">
        <p className="text-gray-500">Mais configurações serão adicionadas em breve...</p>
      </div>

      {/* Modal de Convite */}
      <InviteUserModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        onSuccess={handleInviteSuccess}
      />
    </div>
  );
};

export default Organization;
