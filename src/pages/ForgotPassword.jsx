import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft } from 'lucide-react';

const ForgotPassword = () => {
    const { resetPassword } = useAuth();

    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setError('');
            setLoading(true);
            await resetPassword(email);
            setSuccess(true);
        } catch (err) {
            setError('Failed to send recovery email: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
                <div className="p-8">
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold text-slate-900">Hostel<span className="text-emerald-600">Manager</span></h1>
                        <p className="text-gray-500 mt-2">Recuperar senha</p>
                    </div>

                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-6 text-sm">
                            {error}
                        </div>
                    )}

                    {success ? (
                        <div className="text-center space-y-4">
                            <div className="bg-emerald-50 text-emerald-600 p-4 rounded-lg mb-6">
                                <p className="font-medium mb-2">Email enviado com sucesso!</p>
                                <p className="text-sm">Verifique sua caixa de entrada para o link de recuperação de senha.</p>
                            </div>
                            <Link
                                to="/login"
                                className="inline-flex items-center gap-2 text-emerald-600 hover:text-emerald-700 font-medium"
                            >
                                <ArrowLeft size={20} />
                                Voltar para o login
                            </Link>
                        </div>
                    ) : (
                        <>
                            <p className="text-gray-600 text-sm mb-6 text-center">
                                Digite seu email e enviaremos um link para redefinir sua senha.
                            </p>

                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                                        <input
                                            type="email"
                                            required
                                            className="w-full pl-11 pr-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                                            placeholder="seu@email.com"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {loading ? 'Enviando...' : 'Enviar link de recuperação'}
                                </button>
                            </form>

                            <div className="mt-6 text-center">
                                <Link
                                    to="/login"
                                    className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm"
                                >
                                    <ArrowLeft size={16} />
                                    Voltar para o login
                                </Link>
                            </div>
                        </>
                    )}
                </div>
                <div className="bg-gray-50 p-4 text-center text-sm text-gray-500 border-t border-gray-100">
                    Precisa de ajuda? Entre em contato com o suporte.
                </div>
            </div>
        </div>
    );
};

export default ForgotPassword;
