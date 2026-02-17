import { Routes, Route, Navigate } from 'react-router-dom';
import { useMe } from './api/hooks';
import AppLayout from './components/AppLayout';
import LoginPage from './pages/auth/LoginPage';
import CampaignListPage from './pages/campaigns/CampaignListPage';
import CampaignCreatePage from './pages/campaigns/CampaignCreatePage';
import CampaignDetailPage from './pages/campaigns/CampaignDetailPage';
import DemandMatrixPage from './pages/campaigns/DemandMatrixPage';
import DemandMapPage from './pages/campaigns/DemandMapPage';
import { Spin } from 'antd';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { data, isLoading, isError } = useMe();
  if (isLoading) return <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 200 }}><Spin size="large" /></div>;
  if (isError || !data) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={
        <ProtectedRoute>
          <AppLayout />
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="/campaigns" replace />} />
        <Route path="campaigns" element={<CampaignListPage />} />
        <Route path="campaigns/new" element={<CampaignCreatePage />} />
        <Route path="campaigns/:id" element={<CampaignDetailPage />} />
        <Route path="demand-matrix" element={<DemandMatrixPage />} />
        <Route path="demand-map" element={<DemandMapPage />} />
      </Route>
    </Routes>
  );
}
