import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Form, Input, Button, Typography, message, Space } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useLogin } from '../../api/hooks';

export default function LoginPage() {
  const navigate = useNavigate();
  const login = useLogin();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      await login.mutateAsync(values);
      navigate('/');
    } catch {
      message.error('Неверное имя пользователя или пароль');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    }}>
      <Card style={{ width: 400, boxShadow: '0 8px 40px rgba(0,0,0,0.12)' }}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div style={{ textAlign: 'center' }}>
            <Typography.Title level={3} style={{ marginBottom: 4 }}>
              Матрица потребности
            </Typography.Title>
            <Typography.Text type="secondary">
              Войдите в систему
            </Typography.Text>
          </div>
          <Form onFinish={onFinish} layout="vertical" size="large">
            <Form.Item
              name="username"
              rules={[{ required: true, message: 'Введите логин' }]}
            >
              <Input prefix={<UserOutlined />} placeholder="Логин" />
            </Form.Item>
            <Form.Item
              name="password"
              rules={[{ required: true, message: 'Введите пароль' }]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="Пароль" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loading} block>
                Войти
              </Button>
            </Form.Item>
          </Form>
        </Space>
      </Card>
    </div>
  );
}
