import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import {
    Plus,
    Filter,
    TrendingUp,
    TrendingDown,
    DollarSign,
    Calendar as CalendarIcon,
    ArrowUpRight,
    ArrowDownRight,
    Pencil,
    Trash2
} from 'lucide-react';
import ConfirmationModal from '../components/ConfirmationModal';

const Finance = () => {
    const { t } = useTranslation();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState({ income: 0, expense: 0, balance: 0 });
    const [filterType, setFilterType] = useState('All');
    const [filterMethod, setFilterMethod] = useState('All');
    const [editingTransaction, setEditingTransaction] = useState(null);

    // Delete Confirmation State
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [transactionToDelete, setTransactionToDelete] = useState(null);

    const [formData, setFormData] = useState({
        type: 'Income',
        date: new Date().toISOString().split('T')[0],
        category: '',
        amount: '',
        payment_method: 'Cash'
    });

    useEffect(() => {
        fetchTransactions();
    }, []);

    const fetchTransactions = async () => {
        try {
            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .order('date', { ascending: false });

            if (error) throw error;
            setTransactions(data);
            calculateSummary(data);
        } catch (error) {
            console.error('Error fetching transactions:', error.message);
        } finally {
            setLoading(false);
        }
    };

    const calculateSummary = (data) => {
        const income = data
            .filter(t => t.type === 'Income')
            .reduce((acc, curr) => acc + parseFloat(curr.amount), 0);

        const expense = data
            .filter(t => t.type === 'Expense')
            .reduce((acc, curr) => acc + parseFloat(curr.amount), 0);

        setSummary({
            income,
            expense,
            balance: income - expense
        });
    };

    const handleSaveTransaction = async (e) => {
        e.preventDefault();
        try {
            const transactionData = {
                type: formData.type,
                category: formData.category,
                amount: parseFloat(formData.amount),
                payment_method: formData.payment_method,
                date: formData.date,
            };

            if (editingTransaction) {
                const { data, error } = await supabase
                    .from('transactions')
                    .update(transactionData)
                    .eq('id', editingTransaction.id)
                    .select();

                if (error) throw error;

                if (data.length === 0) {
                    alert('Update failed. Please check database permissions.');
                }
            } else {
                const { error } = await supabase
                    .from('transactions')
                    .insert([transactionData]);
                if (error) throw error;
            }

            fetchTransactions();
            closeModal();
        } catch (error) {
            alert('Error saving transaction: ' + error.message);
        }
    };

    const handleDeleteClick = (id) => {
        setTransactionToDelete(id);
        setIsDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!transactionToDelete) return;

        const id = transactionToDelete;

        // Optimistic update
        setTransactions(prev => prev.filter(t => t.id !== id));
        setIsDeleteModalOpen(false); // Close modal immediately

        try {
            const { data, error } = await supabase
                .from('transactions')
                .delete()
                .eq('id', id)
                .select();

            if (error) {
                console.error('Supabase delete error:', error);
                fetchTransactions(); // Revert
                throw error;
            }

            if (data.length === 0) {
                alert('Could not delete transaction. Please check database permissions (RLS policies).');
                fetchTransactions(); // Revert
                return;
            }

            fetchTransactions();
        } catch (error) {
            alert('Error deleting transaction: ' + error.message);
        } finally {
            setTransactionToDelete(null);
        }
    };

    const openEditModal = (transaction) => {
        setEditingTransaction(transaction);
        setFormData({
            type: transaction.type,
            date: transaction.date,
            category: transaction.category,
            amount: transaction.amount,
            payment_method: transaction.payment_method || 'Cash'
        });
        setIsModalOpen(true);
    };

    const openNewModal = () => {
        setEditingTransaction(null);
        setFormData({
            type: 'Income',
            date: new Date().toISOString().split('T')[0],
            category: '',
            amount: '',
            payment_method: 'Cash'
        });
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setEditingTransaction(null);
        setIsModalOpen(false);
    };

    const filteredTransactions = transactions.filter(t => {
        const matchesType = filterType === 'All' || t.type === filterType;
        const matchesMethod = filterMethod === 'All' || t.payment_method === filterMethod;
        return matchesType && matchesMethod;
    });

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Finance</h1>
                    <p className="text-gray-500">Track income, expenses, and cash flow</p>
                </div>
                <button
                    onClick={openNewModal}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
                >
                    <Plus size={20} />
                    New Transaction
                </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-emerald-100 text-emerald-600 rounded-lg">
                            <TrendingUp size={24} />
                        </div>
                        <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full flex items-center gap-1">
                            <ArrowUpRight size={12} /> Income
                        </span>
                    </div>
                    <h3 className="text-3xl font-bold text-gray-900">${summary.income.toFixed(2)}</h3>
                    <p className="text-sm text-gray-500 mt-1">Total Revenue</p>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-red-100 text-red-600 rounded-lg">
                            <TrendingDown size={24} />
                        </div>
                        <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded-full flex items-center gap-1">
                            <ArrowDownRight size={12} /> Expense
                        </span>
                    </div>
                    <h3 className="text-3xl font-bold text-gray-900">${summary.expense.toFixed(2)}</h3>
                    <p className="text-sm text-gray-500 mt-1">Total Expenses</p>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
                            <DollarSign size={24} />
                        </div>
                        <span className="text-xs font-medium text-gray-500 bg-gray-50 px-2 py-1 rounded-full">
                            Net Balance
                        </span>
                    </div>
                    <h3 className={`text-3xl font-bold ${summary.balance >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                        ${summary.balance.toFixed(2)}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">Current Cash Flow</p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2 text-gray-500">
                    <Filter size={20} />
                    <span className="font-medium">Filters:</span>
                </div>

                <select
                    className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                >
                    <option value="All">All Types</option>
                    <option value="Income">Income</option>
                    <option value="Expense">Expense</option>
                </select>

                <select
                    className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                    value={filterMethod}
                    onChange={(e) => setFilterMethod(e.target.value)}
                >
                    <option value="All">All Methods</option>
                    <option value="Cash">Cash</option>
                    <option value="Credit Card">Credit Card</option>
                    <option value="Debit Card">Debit Card</option>
                    <option value="Transfer">Transfer</option>
                    <option value="Pix">Pix</option>
                </select>
            </div>

            {/* Transactions List */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                    <h2 className="font-bold text-gray-900">Recent Transactions</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500 font-semibold">
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4">Description / Category</th>
                                <th className="px-6 py-4">Type</th>
                                <th className="px-6 py-4">Method</th>
                                <th className="px-6 py-4 text-right">Amount</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr><td colSpan="6" className="text-center py-8 text-gray-500">Loading transactions...</td></tr>
                            ) : filteredTransactions.map((t) => (
                                <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 text-sm text-gray-600">
                                        <div className="flex items-center gap-2">
                                            <CalendarIcon size={14} className="text-gray-400" />
                                            {new Date(t.date).toLocaleDateString()}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="font-medium text-gray-900">{t.category}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${t.type === 'Income' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                                            }`}>
                                            {t.type}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600">
                                        {t.payment_method || '-'}
                                    </td>
                                    <td className={`px-6 py-4 text-right font-bold ${t.type === 'Income' ? 'text-emerald-600' : 'text-red-600'
                                        }`}>
                                        {t.type === 'Income' ? '+' : '-'}${parseFloat(t.amount).toFixed(2)}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => openEditModal(t)}
                                                className="p-1 text-gray-400 hover:text-emerald-600 transition-colors"
                                                title="Edit"
                                            >
                                                <Pencil size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteClick(t.id)}
                                                className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {!loading && filteredTransactions.length === 0 && (
                    <div className="p-8 text-center text-gray-500">
                        No transactions found matching your filters.
                    </div>
                )}
            </div>

            {/* Add/Edit Transaction Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl max-w-md w-full p-6">
                        <h2 className="text-xl font-bold mb-4">
                            {editingTransaction ? 'Edit Transaction' : 'New Transaction'}
                        </h2>

                        <form
                            onSubmit={handleSaveTransaction}
                            className="space-y-4"
                        >

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                                    <select
                                        value={formData.type}
                                        onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                    >
                                        <option value="Income">Income</option>
                                        <option value="Expense">Expense</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                                    <input
                                        type="date"
                                        required
                                        value={formData.date}
                                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Category / Description</label>
                                <input
                                    required
                                    value={formData.category}
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                    placeholder="e.g. Booking Payment, Electricity Bill"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Amount ($)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        min="0"
                                        value={formData.amount}
                                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                        placeholder="0.00"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                                    <select
                                        value={formData.payment_method}
                                        onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                    >
                                        <option value="Cash">Cash</option>
                                        <option value="Credit Card">Credit Card</option>
                                        <option value="Debit Card">Debit Card</option>
                                        <option value="Transfer">Transfer</option>
                                        <option value="Pix">Pix</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                                >
                                    Cancel
                                </button>
                                <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium shadow-sm">
                                    {editingTransaction ? 'Save Changes' : 'Save Transaction'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            <ConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={confirmDelete}
                title="Delete Transaction"
                message="Are you sure you want to delete this transaction? This action cannot be undone."
                confirmText="Delete"
                isDanger={true}
            />
        </div>
    );
};

export default Finance;
