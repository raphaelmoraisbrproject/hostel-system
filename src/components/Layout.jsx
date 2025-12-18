import Sidebar from './Sidebar';

const Layout = ({ children }) => {
    return (
        <div className="min-h-screen bg-gray-50">
            <Sidebar />
            <main className="ml-64 p-8">
                {children}
            </main>
        </div>
    );
};

export default Layout;
