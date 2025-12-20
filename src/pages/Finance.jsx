import { useState, useEffect } from 'react';
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
import { formatCurrencyInput, parseCurrencyToNumber, numberToInputFormat } from '../utils/currency';
import { useCurrency } from '../hooks/useCurrency';

const Finance = () => {
    const { formatCurrency } = useCurrency();
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
        displayAmount: '', // Formatted display value
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

        // Find the transaction to get booking_id and amount before deleting
        const transactionToRemove = transactions.find(t => t.id === id);

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

            // If transaction was linked to a booking and was Income, subtract from paid_amount
            if (transactionToRemove?.booking_id && transactionToRemove?.type === 'Income') {
                const amount = parseFloat(transactionToRemove.amount) || 0;
                if (amount > 0) {
                    // Get current booking paid_amount
                    const { data: booking } = await supabase
                        .from('bookings')
                        .select('paid_amount')
                        .eq('id', transactionToRemove.booking_id)
                        .single();

                    if (booking) {
                        const currentPaid = parseFloat(booking.paid_amount) || 0;
                        const newPaid = Math.max(0, currentPaid - amount); // Never go below 0

                        await supabase
                            .from('bookings')
                            .update({ paid_amount: newPaid })
                            .eq('id', transactionToRemove.booking_id);
                    }
                }
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
        const amount = parseFloat(transaction.amount) || 0;
        setFormData({
            type: transaction.type,
            date: transaction.date,
            category: transaction.category,
            amount: amount,
            displayAmount: numberToInputFormat(amount),
            payment_method: transaction.payment_method || 'Cash'
        });
        setIsModalOpen(true);
    };

    const openNewModal = (type = 'Income') => {
        setEditingTransaction(null);
        setFormData({
            type: type,
            date: new Date().toISOString().split('T')[0],
            category: '',
            amount: '',
            displayAmount: '',
            payment_method: 'Cash'
        });
        setIsModalOpen(true);
    };

    const handleAmountChange = (e) => {
        const inputValue = e.target.value;
        const formatted = formatCurrencyInput(inputValue);
        const numericValue = parseCurrencyToNumber(formatted);

        setFormData({
            ...formData,
            displayAmount: formatted,
            amount: numericValue
        });
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
                    <h1 className="text-2xl font-bold text-gray-900">Finanças</h1>
                    <p className="text-gray-500">Controle de receitas, despesas e fluxo de caixa</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => openNewModal('Income')}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
                    >
                        <Plus size={18} />
                        Nova Receita
                    </button>
                    <button
                        onClick={() => openNewModal('Expense')}
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
                    >
                        <Plus size={18} />
                        Nova Despesa
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-emerald-100 text-emerald-600 rounded-lg">
                            <TrendingUp size={24} />
                        </div>
                        <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full flex items-center gap-1">
                            <ArrowUpRight size={12} /> Receita
                        </span>
                    </div>
                    <h3 className="text-3xl font-bold text-gray-900">{formatCurrency(summary.income)}</h3>
                    <p className="text-sm text-gray-500 mt-1">Total de Receitas</p>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-red-100 text-red-600 rounded-lg">
                            <TrendingDown size={24} />
                        </div>
                        <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded-full flex items-center gap-1">
                            <ArrowDownRight size={12} /> Despesa
                        </span>
                    </div>
                    <h3 className="text-3xl font-bold text-gray-900">{formatCurrency(summary.expense)}</h3>
                    <p className="text-sm text-gray-500 mt-1">Total de Despesas</p>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
                            <DollarSign size={24} />
                        </div>
                        <span className="text-xs font-medium text-gray-500 bg-gray-50 px-2 py-1 rounded-full">
                            Saldo
                        </span>
                    </div>
                    <h3 className={`text-3xl font-bold ${summary.balance >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                        {formatCurrency(summary.balance)}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">Fluxo de Caixa Atual</p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2 text-gray-500">
                    <Filter size={20} />
                    <span className="font-medium">Filtros:</span>
                </div>

                <select
                    className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                >
                    <option value="All">Todos os Tipos</option>
                    <option value="Income">Receita</option>
                    <option value="Expense">Despesa</option>
                </select>

                <select
                    className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                    value={filterMethod}
                    onChange={(e) => setFilterMethod(e.target.value)}
                >
                    <option value="All">Todos os Métodos</option>
                    <option value="Cash">Dinheiro</option>
                    <option value="Credit Card">Cartão de Crédito</option>
                    <option value="Debit Card">Cartão de Débito</option>
                    <option value="Transfer">Transferência</option>
                    <option value="Pix">Pix</option>
                </select>
            </div>

            {/* Transactions List */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                    <h2 className="font-bold text-gray-900">Transações Recentes</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase text-gray-500 font-semibold">
                                <th className="px-6 py-4">Data</th>
                                <th className="px-6 py-4">Descrição / Categoria</th>
                                <th className="px-6 py-4">Tipo</th>
                                <th className="px-6 py-4">Método</th>
                                <th className="px-6 py-4 text-right">Valor</th>
                                <th className="px-6 py-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr><td colSpan="6" className="text-center py-8 text-gray-500">Carregando transações...</td></tr>
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
                                            {t.type === 'Income' ? 'Receita' : 'Despesa'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-600">
                                        {t.payment_method === 'Cash' ? 'Dinheiro' :
                                         t.payment_method === 'Credit Card' ? 'Cartão de Crédito' :
                                         t.payment_method === 'Debit Card' ? 'Cartão de Débito' :
                                         t.payment_method === 'Transfer' ? 'Transferência' :
                                         t.payment_method || '-'}
                                    </td>
                                    <td className={`px-6 py-4 text-right font-bold ${t.type === 'Income' ? 'text-emerald-600' : 'text-red-600'
                                        }`}>
                                        {t.type === 'Income' ? '+' : '-'}{formatCurrency(parseFloat(t.amount))}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => openEditModal(t)}
                                                className="p-1 text-gray-400 hover:text-emerald-600 transition-colors"
                                                title="Editar"
                                            >
                                                <Pencil size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteClick(t.id)}
                                                className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                                title="Excluir"
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
                        Nenhuma transação encontrada com os filtros aplicados.
                    </div>
                )}
            </div>

            {/* Add/Edit Transaction Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl max-w-md w-full overflow-hidden">
                        <div className={`px-6 py-4 ${formData.type === 'Income' ? 'bg-emerald-600' : 'bg-red-600'}`}>
                            <h2 className="text-xl font-bold text-white">
                                {editingTransaction
                                    ? `Editar ${formData.type === 'Income' ? 'Receita' : 'Despesa'}`
                                    : `Nova ${formData.type === 'Income' ? 'Receita' : 'Despesa'}`
                                }
                            </h2>
                        </div>

                        <form
                            onSubmit={handleSaveTransaction}
                            className="p-6 space-y-4"
                        >

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
                                <input
                                    type="date"
                                    required
                                    value={formData.date}
                                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 outline-none ${formData.type === 'Income' ? 'focus:ring-emerald-500' : 'focus:ring-red-500'}`}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Categoria / Descrição</label>
                                <input
                                    required
                                    value={formData.category}
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 outline-none ${formData.type === 'Income' ? 'focus:ring-emerald-500' : 'focus:ring-red-500'}`}
                                    placeholder={formData.type === 'Income' ? 'Ex: Pagamento de Reserva, Diária' : 'Ex: Conta de Luz, Manutenção'}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Valor (R$)</label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        required
                                        value={formData.displayAmount}
                                        onChange={handleAmountChange}
                                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 outline-none ${formData.type === 'Income' ? 'focus:ring-emerald-500' : 'focus:ring-red-500'}`}
                                        placeholder="0,00"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Método de Pagamento</label>
                                    <select
                                        value={formData.payment_method}
                                        onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 outline-none ${formData.type === 'Income' ? 'focus:ring-emerald-500' : 'focus:ring-red-500'}`}
                                    >
                                        <option value="Cash">Dinheiro</option>
                                        <option value="Credit Card">Cartão de Crédito</option>
                                        <option value="Debit Card">Cartão de Débito</option>
                                        <option value="Transfer">Transferência</option>
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
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className={`px-4 py-2 text-white rounded-lg font-medium shadow-sm ${
                                        formData.type === 'Income'
                                            ? 'bg-emerald-600 hover:bg-emerald-700'
                                            : 'bg-red-600 hover:bg-red-700'
                                    }`}
                                >
                                    {editingTransaction ? 'Salvar Alterações' : `Salvar ${formData.type === 'Income' ? 'Receita' : 'Despesa'}`}
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
                title="Excluir Transação"
                message="Tem certeza que deseja excluir esta transação? Esta ação não pode ser desfeita."
                confirmText="Excluir"
                isDanger={true}
            />
        </div>
    );
};

export default Finance;
