import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Table, Button, Space, Typography, Tag, Modal, Form, Input, App } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useFunnels, useCreateFunnel, useDeleteFunnel } from '../../api/hooks';
import type { Funnel } from '../../types';

export default function FunnelListPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { data: funnels, isLoading } = useFunnels();
  const createFunnel = useCreateFunnel();
  const deleteFunnel = useDeleteFunnel();
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      const result = await createFunnel.mutateAsync(values);
      message.success('Воронка создана');
      setModalOpen(false);
      form.resetFields();
      navigate(`/funnels/${result.id}`);
    } catch {
      // validation error
    }
  };

  const handleDelete = (id: number) => {
    Modal.confirm({
      title: 'Удалить воронку?',
      content: 'Это действие нельзя отменить.',
      okText: 'Удалить',
      okType: 'danger',
      cancelText: 'Отмена',
      onOk: async () => {
        await deleteFunnel.mutateAsync(id);
        message.success('Воронка удалена');
      },
    });
  };

  const columns = [
    {
      title: 'Название',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: Funnel) => (
        <a onClick={() => navigate(`/funnels/${record.id}`)}>{text}</a>
      ),
    },
    {
      title: 'Описание',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: 'Стадий',
      dataIndex: 'stages_count',
      key: 'stages_count',
      width: 100,
      align: 'center' as const,
    },
    {
      title: 'Статус',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 120,
      render: (active: boolean) => (
        <Tag color={active ? 'green' : 'default'}>{active ? 'Активна' : 'Неактивна'}</Tag>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 80,
      render: (_: any, record: Funnel) => (
        <Button type="link" danger size="small" onClick={() => handleDelete(record.id)}>
          Удалить
        </Button>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Воронки (сценарии)</Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
          Создать воронку
        </Button>
      </Space>

      <Card>
        <Table
          dataSource={funnels?.results || []}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={false}
        />
      </Card>

      <Modal
        title="Новая воронка"
        open={modalOpen}
        onOk={handleCreate}
        onCancel={() => { setModalOpen(false); form.resetFields(); }}
        okText="Создать"
        cancelText="Отмена"
        confirmLoading={createFunnel.isPending}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Название" rules={[{ required: true, message: 'Укажите название' }]}>
            <Input placeholder='Например: "РОИВ (базовый)"' />
          </Form.Item>
          <Form.Item name="description" label="Описание">
            <Input.TextArea rows={3} placeholder="Краткое описание сценария" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
