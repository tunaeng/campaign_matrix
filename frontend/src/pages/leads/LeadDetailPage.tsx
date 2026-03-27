import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Typography, Button, Space, Spin, Steps, Tag, Checkbox,
  Input, Upload, Select, Form, Modal, Timeline, Descriptions, App, Progress,
  DatePicker, Popconfirm, Segmented, InputNumber, Row, Col,
} from 'antd';
import {
  ArrowLeftOutlined, PlusOutlined, UploadOutlined, StopOutlined, UserOutlined, RollbackOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  useLead, useUpdateLead, useToggleChecklistItem, useCreateChecklistValue,
  useUpdateChecklistValue,
  useCreateLeadInteraction, useAdvanceLeadStage, useRetreatLeadStage, useRejectLead, useLeadTimeline,
  useContactsByOrganization,
} from '../../api/hooks';
import type { LeadTimelineItem } from '../../types';
import type { LeadChecklistValue, LeadStageDeadline } from '../../types';
import ContactSelector from '../../components/ContactSelector';
import LeadContactsTab from './LeadContactsTab';
import DemandQuotaPreview, { leadToDemandBreakdown } from '../../components/DemandQuotaPreview';

const channelOptions = [
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Телефон' },
  { value: 'meeting', label: 'Встреча' },
  { value: 'messenger', label: 'Мессенджер' },
  { value: 'letter', label: 'Письмо' },
  { value: 'other', label: 'Другое' },
];

export default function LeadDetailPage() {
  const { message } = App.useApp();
  const { campaignId, leadId } = useParams<{ campaignId: string; leadId: string }>();
  const navigate = useNavigate();
  const { data: lead, isLoading } = useLead(leadId!);
  const updateLead = useUpdateLead(leadId!);
  const [demandModalOpen, setDemandModalOpen] = useState(false);
  const [demandForm] = Form.useForm();
  const [historyKind, setHistoryKind] = useState<string>('');
  const [historyContactId, setHistoryContactId] = useState<number | null>(null);
  const [leadWorkPanel, setLeadWorkPanel] = useState<'checklist' | 'contacts'>('checklist');
  const { data: contactsForHistory, isLoading: loadingOrgContacts } = useContactsByOrganization(lead?.organization_name);
  const historyContactOptions = useMemo(() => {
    if (!contactsForHistory?.length) return [];
    return contactsForHistory.map((c) => ({
      value: c.id,
      label: c.type === 'person'
        ? `${c.full_name}${c.position ? ` — ${c.position}` : ''}`
        : `[${c.type_display}] ${c.department_name || c.full_name}`,
    }));
  }, [contactsForHistory]);

  const { data: timeline } = useLeadTimeline(leadId!, {
    kind: historyKind || undefined,
    contact: historyContactId,
  });
  const toggleItem = useToggleChecklistItem(leadId!);
  const createValue = useCreateChecklistValue(leadId!);
  const updateValue = useUpdateChecklistValue(leadId!);
  const createInteraction = useCreateLeadInteraction(leadId!);
  const advanceStage = useAdvanceLeadStage(leadId!);
  const retreatStage = useRetreatLeadStage(leadId!);
  const rejectLead = useRejectLead(leadId!);

  const [interactionModalOpen, setInteractionModalOpen] = useState(false);
  const [interactionForm] = Form.useForm();
  const [contactMode, setContactMode] = useState<'select' | 'manual'>('select');

  if (isLoading) return <div style={{ textAlign: 'center', paddingTop: 100 }}><Spin size="large" /></div>;
  if (!lead) return <Typography.Text>Лид не найден</Typography.Text>;

  const stageDeadlines = lead.stage_deadlines || [];
  const normalStages = stageDeadlines.filter(s => !s.is_rejection);
  const isRejected = lead.current_stage_is_rejection;
  const currentStageIdx = normalStages.findIndex(s => s.stage_id === lead.current_stage);
  const isLastNormalStage = currentStageIdx === normalStages.length - 1;

  const stageItems = normalStages.map((sd: LeadStageDeadline) => ({
    title: sd.stage_name,
    description: sd.deadline_date
      ? `Дедлайн: ${new Date(sd.deadline_date).toLocaleDateString('ru-RU')} (${sd.deadline_days} раб. дн.)`
      : sd.deadline_days ? `${sd.deadline_days} раб. дн.` : undefined,
  }));

  const allChecklistForCurrentStage = lead.current_stage
    ? (lead.checklist_values || []).filter(v => v.stage_id === lead.current_stage)
    : [];

  const currentStageDeadline = normalStages.find((s) => s.stage_id === lead.current_stage);
  const currentOrder = currentStageDeadline?.order;

  const stagesToShowChronological =
    !isRejected && currentOrder != null
      ? [...normalStages]
        .filter((sd) => sd.order <= currentOrder)
        .sort((a, b) => a.order - b.order)
      : [];

  const visibleChecklistItems = isRejected
    ? allChecklistForCurrentStage
    : stagesToShowChronological.flatMap((sd) =>
        (lead.checklist_values || []).filter((v) => v.stage_id === sd.stage_id),
      );

  const completedCount = visibleChecklistItems.filter((v) => v.is_completed).length;
  const totalCount = visibleChecklistItems.length;

  const handleToggle = async (value: LeadChecklistValue) => {
    try {
      await toggleItem.mutateAsync(value.id);
    } catch {
      message.error('Ошибка при обновлении');
    }
  };

  const handleAdvance = async () => {
    try {
      await advanceStage.mutateAsync();
      message.success('Стадия обновлена');
    } catch (err: any) {
      message.error(err.response?.data?.detail || 'Ошибка');
    }
  };

  const handleReject = async () => {
    try {
      await rejectLead.mutateAsync();
      message.success('Лид переведён в отказ');
    } catch (err: any) {
      message.error(err.response?.data?.detail || 'Ошибка');
    }
  };

  const handleRetreat = async () => {
    try {
      await retreatStage.mutateAsync();
      message.success('Возврат на предыдущую стадию');
    } catch (err: any) {
      message.error(err.response?.data?.detail || 'Ошибка');
    }
  };

  const handleSaveDemand = async () => {
    try {
      const v = await demandForm.validateFields();
      await updateLead.mutateAsync({
        forecast_demand: v.forecast_demand ?? null,
        demand_quota_declared: v.demand_quota_declared ?? 0,
        demand_quota_list: v.demand_quota_list ?? 0,
        demand_collected_declared: v.demand_collected_declared ?? 0,
        demand_collected_list: v.demand_collected_list ?? 0,
        demand_count: v.demand_count ?? 0,
      });
      message.success('Потребность сохранена');
      setDemandModalOpen(false);
    } catch { /* validation */ }
  };

  const handleCreateInteraction = async () => {
    try {
      const values = await interactionForm.validateFields();
      const payload: any = {
        date: values.date.toISOString(),
        channel: values.channel,
        result: values.result || '',
      };
      if (contactMode === 'select' && values.contact) {
        payload.contact = values.contact;
        payload.contact_person = values.contact_person_auto || values.contact_person || '';
        payload.contact_position = values.contact_position_auto || values.contact_position || '';
      } else {
        payload.contact_person = values.contact_person || '';
        payload.contact_position = values.contact_position || '';
      }
      await createInteraction.mutateAsync(payload);
      message.success('Взаимодействие добавлено');
      setInteractionModalOpen(false);
      interactionForm.resetFields();
      setContactMode('select');
    } catch { /* validation */ }
  };

  const handleUpdateField = async (valueId: number, field: string, val: string | number | null) => {
    try {
      await updateValue.mutateAsync({ valueId, [field]: val });
    } catch {
      message.error('Ошибка при сохранении');
    }
  };

  const renderConfirmationField = (value: LeadChecklistValue, readOnly = false) => {
    if (readOnly) {
      switch (value.confirmation_type) {
        case 'text':
          return (
            <Typography.Text type="secondary" style={{ marginLeft: 8 }}>
              {value.text_value?.trim() ? value.text_value : '—'}
            </Typography.Text>
          );
        case 'file':
          return value.file_value ? (
            <a href={value.file_value} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 8 }}>
              Файл
            </a>
          ) : (
            <Typography.Text type="secondary" style={{ marginLeft: 8 }}>—</Typography.Text>
          );
        case 'select':
          return (
            <Tag style={{ marginLeft: 8 }}>{value.select_value || '—'}</Tag>
          );
        case 'contact':
          return (
            <Typography.Text style={{ marginLeft: 8 }}>
              {value.contact_full_name || value.contact_name || '—'}
            </Typography.Text>
          );
        default:
          return null;
      }
    }
    switch (value.confirmation_type) {
      case 'text':
        return (
          <Input
            size="small"
            style={{ marginLeft: 8, flex: 1, maxWidth: 400 }}
            placeholder="Введите текст подтверждения"
            defaultValue={value.text_value}
            onBlur={(e) => handleUpdateField(value.id, 'text_value', e.target.value)}
            onPressEnter={(e) => handleUpdateField(value.id, 'text_value', (e.target as HTMLInputElement).value)}
          />
        );
      case 'file':
        return value.file_value ? (
          <a href={value.file_value} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 8 }}>
            Файл
          </a>
        ) : (
          <Upload
            action={`/api/leads/${leadId}/checklist/${value.id}/update/`}
            method="PATCH"
            style={{ marginLeft: 8 }}
          >
            <Button size="small" icon={<UploadOutlined />} style={{ marginLeft: 8 }}>
              Загрузить
            </Button>
          </Upload>
        );
      case 'select':
        return (
          <Select
            size="small"
            style={{ marginLeft: 8, minWidth: 180 }}
            placeholder="Выберите"
            value={value.select_value || undefined}
            onChange={(v) => handleUpdateField(value.id, 'select_value', v)}
            options={(value.options || []).map(o => ({ value: o, label: o }))}
            allowClear
          />
        );
      case 'contact':
        return (
          <div style={{ marginLeft: 8 }}>
            <ContactSelector
              organizationId={lead.organization}
              organizationName={lead.organization_name}
              value={value.contact}
              size="small"
              style={{ minWidth: 300 }}
              onChange={(contactId) => {
                handleUpdateField(value.id, 'contact', contactId);
              }}
              onContactDetails={(details) => {
                updateValue.mutateAsync({
                  valueId: value.id,
                  contact_name: details.contact_person,
                  contact_position: details.contact_position,
                  contact_phone: details.contact_phone,
                  contact_email: details.contact_email,
                  contact_messenger: details.contact_messenger,
                });
              }}
            />
          </div>
        );
      default:
        return null;
    }
  };

  const renderChecklistItem = (value: LeadChecklistValue, readOnly: boolean) => (
    <div
      key={value.id}
      style={{
        padding: '10px 0',
        borderBottom: '1px solid #f5f5f5',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <Checkbox
          checked={value.is_completed}
          disabled={readOnly}
          onChange={() => handleToggle(value)}
        >
          {value.checklist_item_text}
        </Checkbox>
      </div>
      {value.confirmation_type && value.confirmation_type !== 'none' && (
        <div style={{ marginLeft: 24, marginTop: 6, display: 'flex', alignItems: 'center' }}>
          {renderConfirmationField(value, readOnly)}
        </div>
      )}
    </div>
  );

  const renderTimelineEntry = (item: LeadTimelineItem) => {
    const when = new Date(item.at).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    if (item.kind === 'interaction') {
      const i = item.data;
      return (
        <div>
          <Space wrap>
            <Tag color="blue">Взаимодействие</Tag>
            <Typography.Text strong>{i.contact_person}</Typography.Text>
            {i.contact_position && (
              <Typography.Text type="secondary">({i.contact_position})</Typography.Text>
            )}
            <Tag>{i.channel_display}</Tag>
            <Typography.Text type="secondary">{when}</Typography.Text>
          </Space>
          {i.result && (
            <Typography.Paragraph style={{ marginTop: 4, marginBottom: 0 }}>
              {i.result}
            </Typography.Paragraph>
          )}
          {i.created_by_name && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              — {i.created_by_name}
            </Typography.Text>
          )}
        </div>
      );
    }
    if (item.kind === 'stage') {
      return (
        <div>
          <Space wrap>
            <Tag color="purple">Стадия</Tag>
            <Typography.Text>{item.summary}</Typography.Text>
            <Typography.Text type="secondary">{when}</Typography.Text>
          </Space>
          {item.created_by_name && (
            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
              {item.created_by_name}
            </Typography.Text>
          )}
        </div>
      );
    }
    return (
      <div>
        <Space wrap>
          <Tag color="green">Чек-лист</Tag>
          <Typography.Text>{item.summary}</Typography.Text>
          <Typography.Text type="secondary">{when}</Typography.Text>
        </Space>
        {item.created_by_name && (
          <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
            {item.created_by_name}
          </Typography.Text>
        )}
      </div>
    );
  };

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`/campaigns/${campaignId}`)}>
          Назад к кампании
        </Button>
      </Space>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <Typography.Title level={4} style={{ marginBottom: 4 }}>
              {lead.organization_name}
            </Typography.Title>
            <Space>
              <Tag color="blue">{lead.funnel_name}</Tag>
              {lead.current_stage_name && (
                <Tag color={isRejected ? 'red' : 'processing'}>
                  {lead.current_stage_name}
                </Tag>
              )}
              {lead.queue_name && <Tag>{lead.queue_name}</Tag>}
            </Space>
          </div>
          <div style={{ textAlign: 'right' }}>
            {lead.manager_name && (
              <Typography.Text>Менеджер: <strong>{lead.manager_name}</strong></Typography.Text>
            )}
          </div>
        </div>

        <Descriptions column={1} style={{ marginTop: 16 }} size="small">
          <Descriptions.Item label="Регион">{lead.organization_region || '—'}</Descriptions.Item>
        </Descriptions>
        <div style={{ marginTop: 8 }}>
          <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
            План и квоты (чел.)
          </Typography.Text>
          <DemandQuotaPreview breakdown={leadToDemandBreakdown(lead)} />
          <Button
            type="link"
            size="small"
            style={{ paddingLeft: 0, marginTop: 4 }}
            onClick={() => {
              demandForm.setFieldsValue({
                forecast_demand: lead.forecast_demand,
                demand_quota_declared: lead.demand_quota_declared ?? 0,
                demand_quota_list: lead.demand_quota_list ?? 0,
                demand_collected_declared: lead.demand_collected_declared ?? 0,
                demand_collected_list: lead.demand_collected_list ?? 0,
                demand_count: lead.demand_count,
              });
              setDemandModalOpen(true);
            }}
          >
            Изменить
          </Button>
        </div>
      </Card>

      <Modal
        title="План, квоты и собрано"
        open={demandModalOpen}
        onOk={handleSaveDemand}
        onCancel={() => setDemandModalOpen(false)}
        okText="Сохранить"
        confirmLoading={updateLead.isPending}
        width={560}
        destroyOnClose
      >
        <Form form={demandForm} layout="vertical">
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="forecast_demand" label="План (прогноз)">
                <InputNumber min={0} style={{ width: '100%' }} placeholder="чел." />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="demand_count" label="Факт. потребность (наслед.)">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Typography.Text strong>Квота</Typography.Text>
          <Row gutter={12} style={{ marginTop: 8 }}>
            <Col span={12}>
              <Form.Item name="demand_quota_declared" label="Заявленная">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="demand_quota_list" label="Списочная">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Typography.Text strong>Собрано</Typography.Text>
          <Row gutter={12} style={{ marginTop: 8 }}>
            <Col span={12}>
              <Form.Item name="demand_collected_declared" label="По заявленной квоте">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="demand_collected_list" label="По списочной квоте">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {stageItems.length > 0 && (
        <Card title="Прогресс стадий" style={{ marginBottom: 16 }}>
          {isRejected && (
            <Tag color="red" style={{ marginBottom: 12, fontSize: 14, padding: '4px 12px' }}>
              Отказ
            </Tag>
          )}
          <Steps
            current={isRejected ? undefined : (currentStageIdx >= 0 ? currentStageIdx : 0)}
            status={isRejected ? 'error' : undefined}
            items={stageItems}
            size="small"
          />
          <div style={{ marginTop: 16, textAlign: 'right' }}>
            <Space wrap>
              {!isRejected && currentStageIdx > 0 && (
                <Popconfirm
                  title="Вернуться на предыдущую стадию?"
                  description="Текущая стадия изменится; отмеченные пункты сохранятся."
                  onConfirm={handleRetreat}
                  okText="Да"
                  cancelText="Нет"
                >
                  <Button
                    icon={<RollbackOutlined />}
                    loading={retreatStage.isPending}
                  >
                    Шаг назад
                  </Button>
                </Popconfirm>
              )}
              {!isRejected && !isLastNormalStage && (
                <Button
                  type="primary"
                  onClick={handleAdvance}
                  loading={advanceStage.isPending}
                >
                  Перейти на следующую стадию
                </Button>
              )}
              {isRejected && (
                <Button
                  type="primary"
                  onClick={handleAdvance}
                  loading={advanceStage.isPending}
                >
                  Вернуть в работу
                </Button>
              )}
              {!isRejected && (
                <Popconfirm
                  title="Перевести в отказ?"
                  description="Лид будет переведён на стадию «Отказ»."
                  onConfirm={handleReject}
                  okText="Да"
                  cancelText="Нет"
                >
                  <Button
                    danger
                    icon={<StopOutlined />}
                    loading={rejectLead.isPending}
                  >
                    Отказ
                  </Button>
                </Popconfirm>
              )}
            </Space>
          </div>
        </Card>
      )}

      <Card
        title={leadWorkPanel === 'checklist' ? 'Чек-лист' : 'Контакты организации'}
        extra={
          <Segmented
            value={leadWorkPanel}
            onChange={(v) => setLeadWorkPanel(v as 'checklist' | 'contacts')}
            options={[
              { label: 'Чек-лист', value: 'checklist' },
              { label: 'Контакты', value: 'contacts' },
            ]}
          />
        }
        style={{ marginBottom: 16 }}
      >
        {leadWorkPanel === 'contacts' ? (
          <LeadContactsTab
            leadId={lead.id}
            organizationId={lead.organization}
            organizationName={lead.organization_name}
            contacts={contactsForHistory}
            loading={loadingOrgContacts}
            primaryContactId={lead.primary_contact?.id ?? null}
          />
        ) : (
          <>
            {totalCount > 0 && (
              <Progress
                percent={totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0}
                style={{ marginBottom: 16 }}
                format={() => `${completedCount}/${totalCount}`}
              />
            )}
            {isRejected && (
              <>
                {allChecklistForCurrentStage.length === 0 ? (
                  <Typography.Text type="secondary">
                    Нет пунктов чек-листа для текущей стадии
                  </Typography.Text>
                ) : (
                  allChecklistForCurrentStage.map((value) => renderChecklistItem(value, false))
                )}
              </>
            )}
            {!isRejected && stagesToShowChronological.length === 0 && (
              <Typography.Text type="secondary">
                Нет пунктов чек-листа для текущей стадии
              </Typography.Text>
            )}
            {!isRejected && stagesToShowChronological.length > 0 && totalCount === 0 && (
              <Typography.Text type="secondary">
                Нет пунктов чек-листа для доступных стадий
              </Typography.Text>
            )}
            {!isRejected && stagesToShowChronological.length > 0 && totalCount > 0 && (
              <div>
                {stagesToShowChronological.map((sd) => {
                  const items = (lead.checklist_values || []).filter((v) => v.stage_id === sd.stage_id);
                  const isPastStage = sd.stage_id !== lead.current_stage;
                  if (items.length === 0) return null;
                  return (
                    <div key={sd.stage_id} style={{ marginBottom: 20 }}>
                      <Space align="center" style={{ marginBottom: 8 }}>
                        <Typography.Text strong>{sd.stage_name}</Typography.Text>
                        {!isPastStage && (
                          <Tag color="processing">текущая</Tag>
                        )}
                        {isPastStage && (
                          <Tag>пройдено</Tag>
                        )}
                      </Space>
                      {items.map((value) => renderChecklistItem(value, isPastStage))}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </Card>

      <Card
        title="История: взаимодействия и изменения"
        extra={
          <Button
            type="primary" size="small" icon={<PlusOutlined />}
            onClick={() => {
              interactionForm.setFieldsValue({ date: dayjs() });
              setInteractionModalOpen(true);
            }}
          >
            Добавить взаимодействие
          </Button>
        }
      >
        <Space wrap style={{ marginBottom: 16 }} align="center">
          <Typography.Text type="secondary">Фильтр:</Typography.Text>
          <Select
            allowClear
            placeholder="Все типы"
            style={{ minWidth: 160 }}
            value={historyKind || undefined}
            onChange={(v) => setHistoryKind(v ?? '')}
            options={[
              { value: 'interaction', label: 'Взаимодействие' },
              { value: 'stage', label: 'Стадия' },
              { value: 'checklist', label: 'Чек-лист' },
            ]}
          />
          <Select
            allowClear
            placeholder="Все контакты"
            style={{ minWidth: 260 }}
            showSearch
            optionFilterProp="label"
            value={historyContactId ?? undefined}
            onChange={(v) => setHistoryContactId(typeof v === 'number' ? v : null)}
            options={historyContactOptions}
            disabled={!lead.organization_name}
          />
        </Space>
        {!timeline || timeline.length === 0 ? (
          <Typography.Text type="secondary">Нет записей</Typography.Text>
        ) : (
          <Timeline
            items={timeline.map((item) => ({
              key: `${item.kind}-${item.id}`,
              children: renderTimelineEntry(item),
            }))}
          />
        )}
      </Card>

      <Modal
        title="Новое взаимодействие"
        open={interactionModalOpen}
        onOk={handleCreateInteraction}
        onCancel={() => { setInteractionModalOpen(false); interactionForm.resetFields(); setContactMode('select'); }}
        okText="Добавить"
        cancelText="Отмена"
        confirmLoading={createInteraction.isPending}
        width={560}
      >
        <Form form={interactionForm} layout="vertical">
          <Form.Item label="Контактное лицо">
            <Segmented
              size="small"
              value={contactMode}
              onChange={(v) => setContactMode(v as 'select' | 'manual')}
              options={[
                { value: 'select', label: 'Из справочника' },
                { value: 'manual', label: 'Ввести вручную' },
              ]}
              style={{ marginBottom: 8 }}
            />
            {contactMode === 'select' ? (
              <Form.Item name="contact" noStyle rules={[{ required: true, message: 'Выберите контакт' }]}>
                <ContactSelector
                  organizationId={lead.organization}
                  organizationName={lead.organization_name}
                  size="middle"
                  style={{ width: '100%' }}
                  onChange={(contactId, contact) => {
                    interactionForm.setFieldValue('contact', contactId);
                    if (contact) {
                      interactionForm.setFieldsValue({
                        contact_person_auto: contact.full_name || `${contact.last_name} ${contact.first_name}`.trim(),
                        contact_position_auto: contact.position,
                      });
                    }
                  }}
                />
              </Form.Item>
            ) : (
              <Space direction="vertical" style={{ width: '100%' }}>
                <Form.Item name="contact_person" noStyle rules={[{ required: true, message: 'Обязательно' }]}>
                  <Input placeholder="ФИО контактного лица" prefix={<UserOutlined />} />
                </Form.Item>
                <Form.Item name="contact_position" noStyle>
                  <Input placeholder="Должность" />
                </Form.Item>
              </Space>
            )}
          </Form.Item>
          <Form.Item name="contact_person_auto" hidden><Input /></Form.Item>
          <Form.Item name="contact_position_auto" hidden><Input /></Form.Item>
          <Form.Item name="date" label="Дата" rules={[{ required: true, message: 'Обязательно' }]}>
            <DatePicker showTime format="DD.MM.YYYY HH:mm" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="channel" label="Канал" initialValue="phone">
            <Select options={channelOptions} />
          </Form.Item>
          <Form.Item name="result" label="Результат">
            <Input.TextArea rows={3} placeholder="Краткие итоги коммуникации" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
