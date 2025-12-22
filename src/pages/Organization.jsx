import { useState, useEffect } from 'react';
import { Building2, DollarSign, Check, Globe, Users, UserPlus, Copy, Trash2, Clock, User, Mail, Lock, Edit2, X } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { CURRENCIES } from '../constants/currencies';
import { useCurrency } from '../hooks/useCurrency';
import { supabase } from '../lib/supabase';
import InviteUserModal from '../components/InviteUserModal';
import ConfirmModal from '../components/ConfirmModal';

const Organization = () => {
  const { currency, updateCurrency, loading } = useSettings();
  const { formatCurrency } = useCurrency();
  const { user, getInvites, cancelInvite, deleteUser, updateEmail, updatePassword, updateUserProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [teamMembers, setTeamMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loadingTeam, setLoadingTeam] = useState(true);
  const [copiedInviteId, setCopiedInviteId] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    loading: false,
  });
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);
  const [profileFormData, setProfileFormData] = useState({
    fullName: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [profileFormLoading, setProfileFormLoading] = useState(false);

  useEffect(() => {
    if (user?.id) {
      fetchUserProfile();
      fetchTeamData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const fetchUserProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role, full_name, email')
        .eq('id', user?.id)
        .single();

      if (error) throw error;
      setUserProfile(data);
      // Initialize form data with current values
      setProfileFormData({
        fullName: data.full_name || '',
        email: data.email || '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (err) {
      console.error('Error fetching user profile:', err);
    }
  };

  const fetchTeamData = async () => {
    setLoadingTeam(true);
    try {
      // Fetch team members - only show active users
      const { data: members, error: membersError } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_active', true)
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
    setConfirmModal({
      isOpen: true,
      title: 'Cancelar Convite',
      message: 'Tem certeza que deseja cancelar este convite?',
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, loading: true }));
        try {
          await cancelInvite(inviteId);
          setMessage({ type: 'success', text: 'Convite cancelado com sucesso!' });
          fetchTeamData();
          setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: () => {}, loading: false });
        } catch (err) {
          console.error('Error canceling invite:', err);
          setMessage({ type: 'error', text: 'Erro ao cancelar convite' });
          setConfirmModal((prev) => ({ ...prev, loading: false }));
        }
      },
      loading: false,
    });
  };

  const handleInviteSuccess = () => {
    setMessage({ type: 'success', text: 'Convite criado com sucesso!' });
    fetchTeamData();
  };

  const handleDeleteUser = async (userId, userName) => {
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Usuário',
      message: `Tem certeza que deseja excluir ${userName} da equipe? Esta ação não pode ser desfeita.`,
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, loading: true }));
        try {
          const result = await deleteUser(userId);
          setMessage({
            type: 'success',
            text: result.message || 'Usuário excluído com sucesso!'
          });
          fetchTeamData();
          setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: () => {}, loading: false });
        } catch (err) {
          console.error('Error deleting user:', err);
          setMessage({
            type: 'error',
            text: err.message || 'Erro ao excluir usuário'
          });
          setConfirmModal((prev) => ({ ...prev, loading: false }));
        }
      },
      loading: false,
    });
  };

  const handleEditProfile = () => {
    setIsEditProfileModalOpen(true);
  };

  const handleCloseProfileModal = () => {
    setIsEditProfileModalOpen(false);
    // Reset password fields
    setProfileFormData((prev) => ({
      ...prev,
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    }));
  };

  const handleProfileFormChange = (field, value) => {
    setProfileFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setProfileFormLoading(true);
    setMessage(null);

    try {
      let hasChanges = false;

      // Update full name if changed
      if (profileFormData.fullName !== userProfile.full_name) {
        await updateUserProfile(profileFormData.fullName);
        hasChanges = true;
      }

      // Update email if changed
      if (profileFormData.email !== userProfile.email) {
        await updateEmail(profileFormData.email);
        hasChanges = true;
      }

      // Update password if provided
      if (profileFormData.newPassword) {
        if (profileFormData.newPassword !== profileFormData.confirmPassword) {
          throw new Error('As senhas não coincidem');
        }
        if (profileFormData.newPassword.length < 6) {
          throw new Error('A senha deve ter pelo menos 6 caracteres');
        }
        await updatePassword(profileFormData.newPassword);
        hasChanges = true;
      }

      if (hasChanges) {
        setMessage({ type: 'success', text: 'Perfil atualizado com sucesso!' });
        await fetchUserProfile();
        handleCloseProfileModal();
      } else {
        setMessage({ type: 'error', text: 'Nenhuma alteração foi feita' });
      }
    } catch (err) {
      console.error('Error updating profile:', err);
      setMessage({ type: 'error', text: err.message || 'Erro ao atualizar perfil' });
    } finally {
      setProfileFormLoading(false);
    }
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

      {/* Seção de Perfil do Usuário */}
      {userProfile && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
            <User size={20} className="text-gray-600" />
            <div>
              <h2 className="font-semibold text-gray-900">Meu Perfil</h2>
              <p className="text-sm text-gray-500">Gerencie suas informações pessoais</p>
            </div>
          </div>

          <div className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {/* Avatar */}
                <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center">
                  <span className="text-emerald-600 font-bold text-2xl">
                    {userProfile.full_name?.charAt(0)?.toUpperCase() || '?'}
                  </span>
                </div>

                {/* User Info */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {userProfile.full_name || 'Usuário'}
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                    <Mail size={14} />
                    <span>{userProfile.email}</span>
                  </div>
                  <div className="mt-2">
                    <span
                      className={`px-3 py-1 text-xs font-semibold rounded-full ${getRoleBadgeColor(
                        userProfile.role
                      )}`}
                    >
                      {getRoleLabel(userProfile.role)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Edit Button */}
              <button
                onClick={handleEditProfile}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
              >
                <Edit2 size={18} />
                Editar Perfil
              </button>
            </div>
          </div>
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
                          {member.id !== user?.id && (
                            <button
                              onClick={() => handleDeleteUser(member.id, member.full_name)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Excluir usuário"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
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

      {/* Modal de Confirmação */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: () => {}, loading: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText="Confirmar"
        cancelText="Cancelar"
        confirmButtonColor="red"
        loading={confirmModal.loading}
      />

      {/* Modal de Edição de Perfil */}
      {isEditProfileModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-gray-100 sticky top-0 bg-white">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <User size={20} className="text-emerald-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">Editar Perfil</h2>
              </div>
              <button
                onClick={handleCloseProfileModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                disabled={profileFormLoading}
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="p-6">
              <div className="space-y-4">
                {/* Full Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome Completo *
                  </label>
                  <div className="relative">
                    <User size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={profileFormData.fullName}
                      onChange={(e) => handleProfileFormChange('fullName', e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      placeholder="Seu nome completo"
                      required
                      disabled={profileFormLoading}
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email *
                  </label>
                  <div className="relative">
                    <Mail size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="email"
                      value={profileFormData.email}
                      onChange={(e) => handleProfileFormChange('email', e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      placeholder="seu@email.com"
                      required
                      disabled={profileFormLoading}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Você receberá um email de confirmação se alterar o endereço
                  </p>
                </div>

                {/* Divider */}
                <div className="border-t border-gray-200 my-6"></div>

                {/* Change Password Section */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Lock size={16} />
                    Alterar Senha (Opcional)
                  </h3>

                  <div className="space-y-3">
                    {/* New Password */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nova Senha
                      </label>
                      <div className="relative">
                        <Lock size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                          type="password"
                          value={profileFormData.newPassword}
                          onChange={(e) => handleProfileFormChange('newPassword', e.target.value)}
                          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                          placeholder="Mínimo 6 caracteres"
                          disabled={profileFormLoading}
                          minLength={6}
                        />
                      </div>
                    </div>

                    {/* Confirm Password */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Confirmar Nova Senha
                      </label>
                      <div className="relative">
                        <Lock size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <input
                          type="password"
                          value={profileFormData.confirmPassword}
                          onChange={(e) => handleProfileFormChange('confirmPassword', e.target.value)}
                          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                          placeholder="Confirme a nova senha"
                          disabled={profileFormLoading}
                          minLength={6}
                        />
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-gray-500 mt-2">
                    Deixe em branco se não quiser alterar a senha
                  </p>
                </div>

                {/* Info Box */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-700">
                    Suas alterações serão aplicadas imediatamente após salvar.
                  </p>
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex justify-end gap-3 pt-6 mt-6 border-t border-gray-100">
                <button
                  type="button"
                  onClick={handleCloseProfileModal}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  disabled={profileFormLoading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={profileFormLoading}
                >
                  {profileFormLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Check size={18} />
                      Salvar Alterações
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Organization;
