import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Customers from "./pages/Customers";
import CustomerNew from "./pages/CustomerNew";
import CustomerDetail from "./pages/CustomerDetail";
import CustomerEdit from "./pages/CustomerEdit";
import Quotes from "./pages/Quotes";
import QuoteNew from "./pages/QuoteNew";
import QuoteDetail from "./pages/QuoteDetail";
import QuoteEdit from "./pages/QuoteEdit";
import Jobs from "./pages/Jobs";
import Invoices from "./pages/Invoices";
import InvoiceNew from "./pages/InvoiceNew";
import InvoiceDetail from "./pages/InvoiceDetail";
import InvoiceEdit from "./pages/InvoiceEdit";
import CalendarPage from "./pages/Calendar";
import RoutesPage from "./pages/Routes";
import Payments from "./pages/Payments";
import Team from "./pages/Team";
import Settings from "./pages/Settings";
import Requests from "./pages/Requests";
import NotFound from "./pages/NotFound";
import PublicQuote from "./pages/PublicQuote";
import PublicInvoice from "./pages/PublicInvoice";
import PublicJobTracking from "./pages/PublicJobTracking";
import StripeReturn from "./pages/StripeReturn";
import PaymentSuccess from "./pages/PaymentSuccess";
import PaymentCanceled from "./pages/PaymentCanceled";
import AcceptInvite from "./pages/AcceptInvite";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public routes (no auth required) */}
            <Route path="/quote/:token" element={<PublicQuote />} />
            <Route path="/invoice/:token" element={<PublicInvoice />} />
            <Route path="/track/:token" element={<PublicJobTracking />} />
            <Route path="/invite/:token" element={<AcceptInvite />} />
            <Route path="/stripe/return" element={<StripeReturn />} />
            <Route path="/payment/success" element={<PaymentSuccess />} />
            <Route path="/payment/canceled" element={<PaymentCanceled />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsOfService />} />
            
            {/* Auth routes */}
            <Route path="/auth" element={<Auth />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            
            {/* Protected routes */}
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/customers/new" element={<CustomerNew />} />
              <Route path="/customers/:id" element={<CustomerDetail />} />
              <Route path="/customers/:id/edit" element={<CustomerEdit />} />
              <Route path="/quotes" element={<Quotes />} />
              <Route path="/quotes/new" element={<QuoteNew />} />
              <Route path="/quotes/:id" element={<QuoteDetail />} />
              <Route path="/quotes/:id/edit" element={<QuoteEdit />} />
              <Route path="/jobs" element={<Jobs />} />
              <Route path="/requests" element={<Requests />} />
              <Route path="/invoices" element={<Invoices />} />
              <Route path="/invoices/new" element={<InvoiceNew />} />
              <Route path="/invoices/:id" element={<InvoiceDetail />} />
              <Route path="/invoices/:id/edit" element={<InvoiceEdit />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/routes" element={<RoutesPage />} />
              <Route path="/payments" element={<Payments />} />
              <Route path="/team" element={<Team />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;