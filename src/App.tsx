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
import Subscriptions from "./pages/Subscriptions";
import SubscriptionNew from "./pages/SubscriptionNew";
import SubscriptionDetail from "./pages/SubscriptionDetail";
import CalendarPage from "./pages/Calendar";
import RoutesPage from "./pages/Routes";
import Payments from "./pages/Payments";
import Team from "./pages/Team";
import Settings from "./pages/Settings";
import Requests from "./pages/Requests";
import Inbox from "./pages/Inbox";
import Reviews from "./pages/Reviews";
import Photos from "./pages/Photos";
import GalleryAnalytics from "./pages/GalleryAnalytics";
import OAuthCallback from "./pages/OAuthCallback";
import NotFound from "./pages/NotFound";
import PublicQuote from "./pages/PublicQuote";
import PublicInvoice from "./pages/PublicInvoice";
import PublicJobTracking from "./pages/PublicJobTracking";
import PublicComparison from "./pages/PublicComparison";
import PublicGalleryPage from "./pages/PublicGalleryPage";
import StripeReturn from "./pages/StripeReturn";
import PaymentSuccess from "./pages/PaymentSuccess";
import PaymentCanceled from "./pages/PaymentCanceled";
import AcceptInvite from "./pages/AcceptInvite";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import EmailPreferences from "./pages/EmailPreferences";
import { Templates, TemplateEdit, TemplatePreview, Sequences, SequenceEdit, Campaigns, CampaignEdit, CampaignReport } from "./pages/marketing";
import { PortalLogin, MagicLinkLanding, PortalDashboard, PortalDocuments, PortalQuoteDetail, PortalInvoiceDetail, PortalSchedule, PortalJobDetail, PortalServiceRequest, PortalAccount, PortalSubscriptions } from "./pages/portal";
import { PortalLayout } from "./components/portal";
import { PreviewPortalLayout } from "./components/portal/PreviewPortalLayout";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Portal routes (customer auth, not staff auth) */}
            <Route path="/portal/login" element={<PortalLogin />} />
            <Route path="/portal/magic/:token" element={<MagicLinkLanding />} />
            <Route path="/portal" element={<PortalLayout />}>
              <Route index element={<PortalDashboard />} />
              <Route path="documents" element={<PortalDocuments />} />
              <Route path="quotes/:id" element={<PortalQuoteDetail />} />
              <Route path="invoices/:id" element={<PortalInvoiceDetail />} />
              <Route path="schedule" element={<PortalSchedule />} />
              <Route path="subscriptions" element={<PortalSubscriptions />} />
              <Route path="jobs/:id" element={<PortalJobDetail />} />
              <Route path="request-service" element={<PortalServiceRequest />} />
              <Route path="account" element={<PortalAccount />} />
            </Route>
            
            {/* Portal preview routes (staff viewing as customer) */}
            <Route path="/portal/preview" element={<PreviewPortalLayout />}>
              <Route index element={<PortalDashboard />} />
              <Route path="documents" element={<PortalDocuments />} />
              <Route path="quotes/:id" element={<PortalQuoteDetail />} />
              <Route path="invoices/:id" element={<PortalInvoiceDetail />} />
              <Route path="schedule" element={<PortalSchedule />} />
              <Route path="subscriptions" element={<PortalSubscriptions />} />
              <Route path="jobs/:id" element={<PortalJobDetail />} />
            </Route>
            
            {/* Public routes (no auth required) */}
            <Route path="/quote/:token" element={<PublicQuote />} />
            <Route path="/invoice/:token" element={<PublicInvoice />} />
            <Route path="/track/:token" element={<PublicJobTracking />} />
            <Route path="/compare/:token" element={<PublicComparison />} />
            <Route path="/gallery/:token" element={<PublicGalleryPage />} />
            <Route path="/invite/:token" element={<AcceptInvite />} />
            <Route path="/stripe/return" element={<StripeReturn />} />
            <Route path="/payment/success" element={<PaymentSuccess />} />
            <Route path="/payment/canceled" element={<PaymentCanceled />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsOfService />} />
            <Route path="/email-preferences/:token" element={<EmailPreferences />} />
            <Route path="/oauth/gmail/callback" element={<OAuthCallback />} />
            
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
              <Route path="/inbox" element={<Inbox />} />
              <Route path="/invoices" element={<Invoices />} />
              <Route path="/invoices/new" element={<InvoiceNew />} />
              <Route path="/invoices/:id" element={<InvoiceDetail />} />
              <Route path="/invoices/:id/edit" element={<InvoiceEdit />} />
              <Route path="/subscriptions" element={<Subscriptions />} />
              <Route path="/subscriptions/new" element={<SubscriptionNew />} />
              <Route path="/subscriptions/:id" element={<SubscriptionDetail />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/routes" element={<RoutesPage />} />
              <Route path="/payments" element={<Payments />} />
              <Route path="/team" element={<Team />} />
              <Route path="/reviews" element={<Reviews />} />
              <Route path="/photos" element={<Photos />} />
              <Route path="/gallery-analytics" element={<GalleryAnalytics />} />
              <Route path="/settings" element={<Settings />} />
              {/* Marketing routes */}
              <Route path="/marketing/templates" element={<Templates />} />
              <Route path="/marketing/templates/:id" element={<TemplateEdit />} />
              <Route path="/marketing/templates/:id/preview" element={<TemplatePreview />} />
              <Route path="/marketing/sequences" element={<Sequences />} />
              <Route path="/marketing/sequences/:id" element={<SequenceEdit />} />
              <Route path="/marketing/campaigns" element={<Campaigns />} />
              <Route path="/marketing/campaigns/new" element={<CampaignEdit />} />
              <Route path="/marketing/campaigns/:id" element={<CampaignEdit />} />
              <Route path="/marketing/campaigns/:id/report" element={<CampaignReport />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;