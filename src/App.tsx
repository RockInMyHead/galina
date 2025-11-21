import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import DocumentAnalysis from "./pages/DocumentAnalysis";
import DocumentFilling from "./pages/DocumentFilling";
import Chat from "./pages/Chat";
import Voice from "./pages/Voice";
import Consultation from "./pages/Consultation";
import Documents from "./pages/Documents";
import Login from "./pages/Login";
import Register from "./pages/Register";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            {/* In production/demo mode, allow access without authentication */}
            {import.meta.env.PROD ? (
              <>
                <Route path="/consultation" element={<Consultation />} />
                <Route path="/documents" element={<Documents />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/document-analysis" element={<DocumentAnalysis />} />
                <Route path="/document-filling" element={<DocumentFilling />} />
                <Route path="/chat" element={<Chat />} />
                <Route path="/voice" element={<Voice />} />
              </>
            ) : (
              <>
                <Route
                  path="/consultation"
                  element={
                    <ProtectedRoute>
                      <Consultation />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/documents"
                  element={
                    <ProtectedRoute>
                      <Documents />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/document-analysis"
                  element={
                    <ProtectedRoute>
                      <DocumentAnalysis />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/document-filling"
                  element={
                    <ProtectedRoute>
                      <DocumentFilling />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/chat"
                  element={
                    <ProtectedRoute>
                      <Chat />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/voice"
                  element={
                    <ProtectedRoute>
                      <Voice />
                    </ProtectedRoute>
                  }
                />
              </>
            )}
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
