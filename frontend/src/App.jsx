import { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { useToast } from './hooks/useToast';
import AppRoutes from './router';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 60_000 } },
});

function PermissionAlert() {
  const toast = useToast();
  useEffect(() => {
    function handle() {
      toast.error(
        "You don't have permission to do this. — آپ کو یہ کام کرنے کی اجازت نہیں ہے",
        { duration: 6000 },
      );
    }
    window.addEventListener('api:forbidden', handle);
    return () => window.removeEventListener('api:forbidden', handle);
  }, [toast]);
  return null;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <PermissionAlert />
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
