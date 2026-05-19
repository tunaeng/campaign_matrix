import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Button, Typography, Space } from 'antd';
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
} from '@ant-design/icons';
import { useMe } from '../api/hooks';

const { Header, Content, Sider } = Layout;

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: user } = useMe();

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

  return (
    <Layout style={{ minHeight: '100vh' }}>
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
        <Menu
          mode="inline"
          selectedKeys={[selectedMenuKey]}
          defaultOpenKeys={['/demand-professions', '/directories']}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderRight: 0, marginTop: 8 }}
        />
      </Sider>
      <Layout style={{ marginLeft: 260 }}>
        <Header style={{
          background: '#fff',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          borderBottom: '1px solid #f0f0f0',
          height: 48,
        }}>
          <Space>
            <Typography.Text>{user?.full_name || user?.username}</Typography.Text>
            <Button
              type="text"
              icon={<LogoutOutlined />}
              onClick={handleLogout}
              size="small"
            >
              Выйти
            </Button>
          </Space>
        </Header>
        <Content style={{ padding: 24, background: '#f5f5f5', minHeight: 'calc(100vh - 48px)' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
