import { Routes, Route, Navigate } from 'react-router-dom';
import { useMe } from './api/hooks';
import AppLayout from './components/AppLayout';
import LoginPage from './pages/auth/LoginPage';
import CampaignListPage from './pages/campaigns/CampaignListPage';
import CampaignCreatePage from './pages/campaigns/CampaignCreatePage';
import CampaignDetailPage from './pages/campaigns/CampaignDetailPage';
import DemandMatrixPage from './pages/campaigns/DemandMatrixPage';
import DemandMapPage from './pages/campaigns/DemandMapPage';
import WorkloadDashboardPage from './pages/campaigns/WorkloadDashboardPage';
import SubfunnelWorkspacePage from './pages/campaigns/SubfunnelWorkspacePage';
import FunnelListPage from './pages/funnels/FunnelListPage';
import FunnelDetailPage from './pages/funnels/FunnelDetailPage';
import LeadDetailPage from './pages/leads/LeadDetailPage';
import OrganizationRegistryPage from './pages/organizations/OrganizationRegistryPage';
import ProjectsRegistryPage from './pages/organizations/ProjectsRegistryPage';
import ContactsRegistryPage from './pages/contacts/ContactsRegistryPage';
import CommunicationHistoryPage from './pages/communications/CommunicationHistoryPage';
import TagsAdminPage from './pages/settings/TagsAdminPage';
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
        <Route path="campaigns/:id/edit" element={<CampaignCreatePage />} />
        <Route path="campaigns/:id" element={<CampaignDetailPage />} />
        <Route path="campaigns/:campaignId/leads/:leadId" element={<LeadDetailPage />} />
        <Route path="workload-dashboard" element={<WorkloadDashboardPage />} />
        <Route path="subfunnel-workspace" element={<SubfunnelWorkspacePage />} />
        <Route path="organizations" element={<OrganizationRegistryPage />} />
        <Route path="projects" element={<ProjectsRegistryPage />} />
        <Route path="contacts" element={<ContactsRegistryPage />} />
        <Route path="communications/history" element={<CommunicationHistoryPage />} />
        <Route path="funnels" element={<FunnelListPage />} />
        <Route path="funnels/:id" element={<FunnelDetailPage />} />
        <Route path="tags" element={<TagsAdminPage />} />
        <Route path="demand-matrix" element={<DemandMatrixPage />} />
        <Route path="demand-map" element={<DemandMapPage />} />
      </Route>
    </Routes>
  );
}
