import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Button, Typography, Space, Drawer } from 'antd';
import {
  FundProjectionScreenOutlined,
  PlusOutlined,
  TableOutlined,
  EnvironmentOutlined,
  AppstoreOutlined,
  TeamOutlined,
  LogoutOutlined,
  FunnelPlotOutlined,
  ApartmentOutlined,
  HistoryOutlined,
  TagsOutlined,
  ProjectOutlined,
  MenuOutlined,
} from '@ant-design/icons';
import { useMe } from '../api/hooks';
import { useIsMobile } from '../hooks/useResponsive';

const { Header, Content, Sider } = Layout;

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: user } = useMe();
  const isMobile = useIsMobile();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    navigate('/login');
  };

  const selectedMenuKey = (() => {
    if (location.pathname.startsWith('/campaigns/')) return '/campaigns';
    if (location.pathname.startsWith('/workload-dashboard')) return '/workload-dashboard';
    if (location.pathname.startsWith('/subfunnel-workspace')) return '/subfunnel-workspace';
    if (location.pathname.startsWith('/communications/')) return '/communications/history';
    if (location.pathname.startsWith('/contacts/')) return '/contacts';
    if (location.pathname.startsWith('/projects/')) return '/projects';
    if (location.pathname.startsWith('/funnels/')) return '/funnels';
    return location.pathname;
  })();

  const menuItems = [
    {
      key: '/campaigns',
      icon: <FundProjectionScreenOutlined />,
      label: 'Кампании',
    },
    {
      key: '/campaigns/new',
      icon: <PlusOutlined />,
      label: 'Новая кампания',
    },
    {
      key: '/workload-dashboard',
      icon: <FundProjectionScreenOutlined />,
      label: 'Загрузка команд',
    },
    {
      key: '/subfunnel-workspace',
      icon: <FunnelPlotOutlined />,
      label: 'Задачи',
    },
    {
      key: '/funnels',
      icon: <FunnelPlotOutlined />,
      label: 'Воронки',
    },
    {
      key: '/directories',
      icon: <TeamOutlined />,
      label: 'Справочники контрагентов',
      children: [
        {
          key: '/organizations',
          icon: <ApartmentOutlined />,
          label: 'База организаций',
        },
        {
          key: '/contacts',
          icon: <TeamOutlined />,
          label: 'База контактов',
        },
        {
          key: '/projects',
          icon: <ProjectOutlined />,
          label: 'Проекты',
        },
        {
          key: '/communications/history',
          icon: <HistoryOutlined />,
          label: 'История коммуникаций',
        },
        {
          key: '/tags',
          icon: <TagsOutlined />,
          label: 'Теги',
        },
      ],
    },
    {
      key: '/demand-professions',
      icon: <AppstoreOutlined />,
      label: 'Востребованные профессии',
      children: [
        {
          key: '/demand-matrix',
          icon: <TableOutlined />,
          label: 'Матрица востребованности',
        },
        {
          key: '/demand-map',
          icon: <EnvironmentOutlined />,
          label: 'Карта по регионам',
        },
      ],
    },
  ];

  const handleMenuClick = ({ key }: { key: string }) => {
    setMenuOpen(false);
    navigate(key);
  };

  const brand = (
    <div style={{
      padding: '20px 16px 12px',
      borderBottom: '1px solid #f0f0f0',
    }}>
      <Typography.Title level={4} style={{ margin: 0, fontSize: 16 }}>
        Матрица потребности
      </Typography.Title>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        Кампании по сбору потребности
      </Typography.Text>
    </div>
  );

  const menu = (
    <Menu
      mode="inline"
      selectedKeys={[selectedMenuKey]}
      defaultOpenKeys={['/demand-professions', '/directories']}
      items={menuItems}
      onClick={handleMenuClick}
      style={{ borderRight: 0, marginTop: 8 }}
    />
  );

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {!isMobile && (
        <Sider
          width={260}
          theme="light"
          style={{
            borderRight: '1px solid #f0f0f0',
            position: 'fixed',
            left: 0,
            top: 0,
            bottom: 0,
            overflow: 'auto',
          }}
        >
          {brand}
          {menu}
        </Sider>
      )}
      {isMobile && (
        <Drawer
          placement="left"
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          width={280}
          styles={{ body: { padding: 0 } }}
          closable={false}
        >
          {brand}
          {menu}
        </Drawer>
      )}
      <Layout style={{ marginLeft: isMobile ? 0 : 260 }}>
        <Header style={{
          background: '#fff',
          padding: isMobile ? '0 12px' : '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: isMobile ? 'space-between' : 'flex-end',
          borderBottom: '1px solid #f0f0f0',
          height: 48,
          position: isMobile ? 'sticky' : 'static',
          top: 0,
          zIndex: 10,
        }}>
          {isMobile && (
            <Space size={8}>
              <Button
                type="text"
                icon={<MenuOutlined />}
                onClick={() => setMenuOpen(true)}
                aria-label="Открыть меню"
              />
              <Typography.Text strong style={{ fontSize: 14 }}>
                Матрица потребности
              </Typography.Text>
            </Space>
          )}
          <Space>
            {!isMobile && <Typography.Text>{user?.full_name || user?.username}</Typography.Text>}
            <Button
              type="text"
              icon={<LogoutOutlined />}
              onClick={handleLogout}
              size="small"
            >
              {isMobile ? null : 'Выйти'}
            </Button>
          </Space>
        </Header>
        <Content
          className="app-content"
          style={{ padding: 24, background: '#f5f5f5', minHeight: 'calc(100vh - 48px)' }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
