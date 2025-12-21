import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import { UserPlus } from 'lucide-react';

const Register = () => {
    const { validateInvite, signUpWithInvite } = useAuth();
    const navigate = useNavigate();
    const { token } = useParams();

    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [validatingToken, setValidatingToken] = useState(true);
    const [inviteValid, setInviteValid] = useState(false);

    useEffect(() => {
        const checkToken = async () => {
            try {
                setValidatingToken(true);
                const inviteData = await validateInvite(token);

                if (inviteData.valid) {
                    setInviteValid(true);
                    setEmail(inviteData.email);
                } else {
                    setError('Invalid or expired invite token');
                    setInviteValid(false);
                }
            } catch (err) {
                setError('Failed to validate invite: ' + err.message);
                setInviteValid(false);
            } finally {
                setValidatingToken(false);
            }
        };

        if (token) {
            checkToken();
        } else {
            setError('No invite token provided');
            setValidatingToken(false);
        }
    }, [token, validateInvite]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters long');
            return;
        }

        try {
            setError('');
            setLoading(true);
            await signUpWithInvite(token, password, fullName);
            navigate('/');
        } catch (err) {
            setError('Failed to create account: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    if (validatingToken) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
                    <div className="p-8">
                        <div className="text-center">
                            <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 rounded-full mb-4">
                                <UserPlus className="text-emerald-600" size={32} />
                            </div>
                            <h1 className="text-2xl font-bold text-slate-900 mb-2">Validating Invite</h1>
                            <p className="text-gray-500">Please wait...</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (!inviteValid) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
                    <div className="p-8">
                        <div className="text-center">
                            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
                                <UserPlus className="text-red-600" size={32} />
                            </div>
                            <h1 className="text-2xl font-bold text-slate-900 mb-2">Invalid Invite</h1>
                            <p className="text-gray-500 mb-6">{error || 'This invite link is invalid or has expired.'}</p>
                            <button
                                onClick={() => navigate('/login')}
                                className="text-emerald-600 hover:text-emerald-700 font-medium"
                            >
                                Return to Login
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
                <div className="p-8">
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold text-slate-900">Hostel<span className="text-emerald-600">Manager</span></h1>
                        <p className="text-gray-500 mt-2">Create your account</p>
                    </div>

                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-6 text-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                            <input
                                type="text"
                                required
                                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                                placeholder="John Doe"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                            <input
                                type="email"
                                required
                                readOnly
                                className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-gray-50 text-gray-600 cursor-not-allowed outline-none"
                                value={email}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                            <input
                                type="password"
                                required
                                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Confirm Password</label>
                            <input
                                type="password"
                                required
                                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                                placeholder="••••••••"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Creating Account...' : (
                                <>
                                    <UserPlus size={20} />
                                    Create Account
                                </>
                            )}
                        </button>
                    </form>
                </div>
                <div className="bg-gray-50 p-4 text-center text-sm text-gray-500 border-t border-gray-100">
                    Already have an account? <button onClick={() => navigate('/login')} className="text-emerald-600 hover:text-emerald-700 font-medium">Sign in</button>
                </div>
            </div>
        </div>
    );
};

export default Register;
