import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { MainLayout } from "@/components/layout/MainLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Vehicles from "./pages/Vehicles";
import CatalogControl from "./pages/CatalogControl";
import Organization from "./pages/Organization";
import Contracts from "./pages/Contracts";
import Sales from "./pages/Sales";
import ExternalSales from "./pages/ExternalSales";
import Consignments from "./pages/Consignments";
import Payroll from "./pages/Payroll";
import MotoInvoices from "./pages/MotoInvoices";
import Financing from "./pages/Financing";
import Reports from "./pages/Reports";
import Ads from "./pages/Ads";
import Settings from "./pages/Settings";
import AdminMaster from "./pages/AdminMaster";
import Spreadsheets from "./pages/Spreadsheets";
import Inspections from "./pages/Inspections";
import Logistics from "./pages/Logistics";
import InboundCargo from "./pages/InboundCargo";
import NotFound from "./pages/NotFound";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { ConcurrentSessionModal } from "@/components/security/ConcurrentSessionModal";
import { ConfirmationProvider } from "@/contexts/ConfirmationContext";
import { DateFilterProvider } from "@/contexts/DateFilterContext";
import { queryClient } from "@/lib/queryClient";

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider>
          <ConfirmationProvider>
            <DateFilterProvider>
              <Toaster />
              <Sonner />
              <ConcurrentSessionModal />
              <BrowserRouter>
              <ErrorBoundary
                fallbackTitle="Erro na aplicação"
                fallbackDescription="Ocorreu um erro ao carregar esta página. Você pode tentar recarregar sem perder a sessão."
              >
                <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <MainLayout>
                      <Index />
                    </MainLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/vehicles"
                element={
                  <ProtectedRoute permission="page.vehicles">
                    <MainLayout>
                      <Vehicles />
                    </MainLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/catalog-control"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'gerente']} permission="page.catalog">
                    <MainLayout>
                      <CatalogControl />
                    </MainLayout>
                  </ProtectedRoute>
                }
              />
              <Route path="/catalog-sync" element={<Navigate to="/catalog-control" replace />} />
              <Route path="/catalogo" element={<Navigate to="/catalog-control" replace />} />
              <Route
                path="/inspections"
                element={
                  <ProtectedRoute>
                    <MainLayout>
                      <Inspections />
                    </MainLayout>
                  </ProtectedRoute>
                }
              />
              <Route path="/laudos" element={<Navigate to="/inspections" replace />} />
              <Route
                path="/organization"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'gerente']} permission="page.organization">
                    <MainLayout>
                      <Organization />
                    </MainLayout>
                  </ProtectedRoute>
                }
              />
              <Route path="/stores" element={<Navigate to="/organization?tab=lojas" replace />} />
              <Route path="/sellers" element={<Navigate to="/organization?tab=vendedores" replace />} />
              <Route path="/resellers" element={<Navigate to="/organization?tab=revendedores" replace />} />
              <Route
                path="/contracts"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'gerente']} permission="page.contracts">
                    <MainLayout>
                      <Contracts />
                    </MainLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/sales"
                element={
                  <ProtectedRoute>
                    <MainLayout>
                      <Sales />
                    </MainLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/logistics"
                element={
                  <ProtectedRoute>
                    <MainLayout>
                      <Logistics />
                    </MainLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/inbound-cargo"
                element={<Navigate to="/vehicles?tab=entrada" replace />}
              />
              <Route
                path="/external-sales"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'gerente']} permission="page.external_sales">
                    <MainLayout>
                      <ExternalSales />
                    </MainLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/consignments"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'gerente']} permission="page.consignments">
                    <MainLayout>
                      <Consignments />
                    </MainLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/payroll"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'gerente']} permission="page.payroll">
                    <MainLayout>
                      <Payroll />
                    </MainLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/moto-invoices"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'gerente']} permission="page.moto_invoices">
                    <MainLayout>
                      <MotoInvoices />
                    </MainLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/financing"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'gerente']} permission="page.financing">
                    <MainLayout>
                      <Financing />
                    </MainLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/reports"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'gerente']} permission="page.reports">
                    <MainLayout>
                      <Reports />
                    </MainLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/ads"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'gerente']} permission="page.ads">
                    <MainLayout>
                      <Ads />
                    </MainLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/spreadsheets"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'gerente']} permission="page.spreadsheets">
                    <MainLayout>
                      <Spreadsheets />
                    </MainLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'gerente']} permission="page.admin">
                    <MainLayout>
                      <AdminMaster />
                    </MainLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <MainLayout>
                      <Settings />
                    </MainLayout>
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </ErrorBoundary>
        </BrowserRouter>
            </DateFilterProvider>
          </ConfirmationProvider>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
