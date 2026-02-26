import { useState, useMemo } from 'react';
import {
  Steps,
  Button,
  Table,
  Select,
  Radio,
  Typography,
  Space,
  Alert,
  Descriptions,
  Upload,
  App,
} from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import {
  useImportDemandMatrixPreview,
  useImportDemandMatrixApply,
  useRegions,
  useProfessions,
  useFederalOperators,
} from '../../api/hooks';
import type {
  ImportPreviewResult,
  ImportPreviewInvalidRegion,
  ImportPreviewNewProfession,
  Region,
  Profession,
} from '../../types';

const YEAR_OPTIONS = [
  { value: 2024, label: '2024' },
  { value: 2025, label: '2025' },
  { value: 2026, label: '2026' },
];

type WizardStep = 'upload' | 'regions' | 'professions' | 'confirm';

const STEP_ORDER: WizardStep[] = ['upload', 'regions', 'professions', 'confirm'];

function stepIndex(step: WizardStep) {
  return STEP_ORDER.indexOf(step);
}

export default function ImportWizard({ onDone }: { onDone?: () => void }) {
  const { message } = App.useApp();
  const [step, setStep] = useState<WizardStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [importYear, setImportYear] = useState<number>(2026);
  const [operatorId, setOperatorId] = useState<number | null>(null);
  const [previewResult, setPreviewResult] = useState<ImportPreviewResult | null>(null);

  const [regionMapping, setRegionMapping] = useState<Record<string, number>>({});
  const [professionMapping, setProfessionMapping] = useState<Record<string, number | 'new'>>({});

  const previewMutation = useImportDemandMatrixPreview();
  const applyMutation = useImportDemandMatrixApply();
  const { data: regionsData } = useRegions();
  const { data: professionsData } = useProfessions();
  const { data: operatorsData } = useFederalOperators();

  const regionOptions = useMemo(() => {
    if (!regionsData?.results) return [];
    return regionsData.results.map((r: Region) => ({
      value: r.id,
      label: r.name,
    }));
  }, [regionsData]);

  const professionOptions = useMemo(() => {
    if (!professionsData?.results) return [];
    return professionsData.results.map((p: Profession) => ({
      value: p.id,
      label: `${p.number}. ${p.name}`,
    }));
  }, [professionsData]);

  const handleFilePreview = async (selectedFile: File) => {
    if (!operatorId) {
      message.error('Выберите федерального оператора');
      return;
    }
    setFile(selectedFile);
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('import_year', String(importYear));
    formData.append('federal_operator_id', String(operatorId));

    try {
      const result = await previewMutation.mutateAsync(formData);
      setPreviewResult(result);
      setRegionMapping({});
      setProfessionMapping({});

      if (result.invalid_regions.length > 0) {
        setStep('regions');
      } else if (result.new_professions.length > 0) {
        setStep('professions');
      } else {
        setStep('confirm');
      }
    } catch (err: any) {
      const detail = err?.response?.data?.detail || 'Ошибка анализа файла';
      message.error(detail);
    }
  };

  const uploadProps: UploadProps = {
    accept: '.csv,.xlsx',
    showUploadList: false,
    beforeUpload: (f) => {
      handleFilePreview(f);
      return false;
    },
  };

  const goNext = () => {
    if (step === 'regions') {
      if (previewResult && previewResult.new_professions.length > 0) {
        setStep('professions');
      } else {
        setStep('confirm');
      }
    } else if (step === 'professions') {
      setStep('confirm');
    }
  };

  const goBack = () => {
    if (step === 'confirm') {
      if (previewResult && previewResult.new_professions.length > 0) {
        setStep('professions');
      } else if (previewResult && previewResult.invalid_regions.length > 0) {
        setStep('regions');
      } else {
        setStep('upload');
      }
    } else if (step === 'professions') {
      if (previewResult && previewResult.invalid_regions.length > 0) {
        setStep('regions');
      } else {
        setStep('upload');
      }
    } else if (step === 'regions') {
      setStep('upload');
    }
  };

  const handleApply = async () => {
    if (!file || !operatorId) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('import_year', String(importYear));
    formData.append('federal_operator_id', String(operatorId));
    formData.append('region_mapping', JSON.stringify(regionMapping));
    formData.append('profession_mapping', JSON.stringify(professionMapping));

    try {
      const result = await applyMutation.mutateAsync(formData);
      message.success(
        `Импорт завершён: +${result.created_professions} профессий, ` +
        `создано ${result.created_statuses} связей, обновлено ${result.updated_statuses} связей`,
      );
      resetWizard();
      onDone?.();
    } catch (err: any) {
      const detail = err?.response?.data?.detail || 'Ошибка импорта';
      message.error(detail);
    }
  };

  const resetWizard = () => {
    setStep('upload');
    setFile(null);
    setPreviewResult(null);
    setRegionMapping({});
    setProfessionMapping({});
  };

  const currentStepIdx = (() => {
    const steps: WizardStep[] = ['upload'];
    if (previewResult?.invalid_regions?.length) steps.push('regions');
    if (previewResult?.new_professions?.length) steps.push('professions');
    steps.push('confirm');
    return steps.indexOf(step);
  })();

  const stepsItems = useMemo(() => {
    const items: { title: string }[] = [{ title: 'Загрузка файла' }];
    if (previewResult?.invalid_regions?.length) {
      items.push({ title: 'Регионы' });
    }
    if (previewResult?.new_professions?.length) {
      items.push({ title: 'Профессии' });
    }
    items.push({ title: 'Подтверждение' });
    return items;
  }, [previewResult]);

  const regionsAllMapped = useMemo(() => {
    if (!previewResult) return true;
    return previewResult.invalid_regions.every(
      (r) => regionMapping[r.normalized] !== undefined,
    );
  }, [previewResult, regionMapping]);

  const professionsAllMapped = useMemo(() => {
    if (!previewResult) return true;
    return previewResult.new_professions.every(
      (p) => professionMapping[p.normalized] !== undefined,
    );
  }, [previewResult, professionMapping]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Typography.Text strong>Импорт востребованности</Typography.Text>

      {step !== 'upload' && (
        <Steps size="small" current={currentStepIdx} items={stepsItems} />
      )}

      {/* Step 0: Upload */}
      {step === 'upload' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Typography.Text type="secondary" style={{ fontSize: 11 }}>
            Оператор + год + файл CSV/XLSX
          </Typography.Text>
          <Select
            placeholder="ФО для импорта"
            value={operatorId}
            onChange={setOperatorId}
            options={(operatorsData?.results || []).map((op) => ({
              value: op.id,
              label: op.short_name?.trim() || op.name,
            }))}
            allowClear
            size="small"
          />
          <Select
            placeholder="Год импорта"
            value={importYear}
            onChange={setImportYear}
            options={YEAR_OPTIONS}
            style={{ width: 130 }}
            size="small"
          />
          <Upload {...uploadProps}>
            <Button
              icon={<UploadOutlined />}
              loading={previewMutation.isPending}
              type="default"
              disabled={!operatorId}
              block
            >
              Проверить файл
            </Button>
          </Upload>
        </div>
      )}

      {/* Step 1: Regions */}
      {step === 'regions' && previewResult && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Alert
            type="warning"
            showIcon
            message={`Найдено ${previewResult.invalid_regions.length} нераспознанных регионов`}
            description="Выберите соответствие из списка регионов системы для каждого."
          />
          <Table<ImportPreviewInvalidRegion>
            dataSource={previewResult.invalid_regions}
            rowKey="normalized"
            size="small"
            pagination={false}
            columns={[
              {
                title: 'В файле',
                dataIndex: 'raw',
                width: 200,
              },
              {
                title: 'Замена',
                key: 'replacement',
                render: (_, record) => (
                  <Select
                    placeholder="Выберите регион"
                    value={regionMapping[record.normalized]}
                    onChange={(val) =>
                      setRegionMapping((prev) => ({ ...prev, [record.normalized]: val }))
                    }
                    options={regionOptions}
                    showSearch
                    optionFilterProp="label"
                    filterOption={(input, option) =>
                      regionOptions.some(
                        (r) =>
                          r.value === option?.value &&
                          String(r.label).toLowerCase().includes(String(input).toLowerCase())
                      )
                    }
                    allowClear
                    onClear={() =>
                      setRegionMapping((prev) => {
                        const next = { ...prev };
                        delete next[record.normalized];
                        return next;
                      })
                    }
                    style={{ width: '100%' }}
                    size="small"
                  />
                ),
              },
            ]}
          />
          <Space>
            <Button size="small" onClick={goBack}>Назад</Button>
            <Button size="small" type="primary" onClick={goNext} disabled={!regionsAllMapped}>
              Далее
            </Button>
          </Space>
        </div>
      )}

      {/* Step 2: Professions */}
      {step === 'professions' && previewResult && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Alert
            type="info"
            showIcon
            message={`Найдено ${previewResult.new_professions.length} новых профессий`}
            description="Для каждой профессии выберите: добавить как новую или заменить на существующую."
          />
          <Table<ImportPreviewNewProfession>
            dataSource={previewResult.new_professions}
            rowKey="normalized"
            size="small"
            pagination={false}
            columns={[
              {
                title: 'Профессия в файле',
                key: 'name',
                width: 200,
                render: (_, record) => (
                  <span>
                    {record.number != null && <Typography.Text type="secondary">{record.number}. </Typography.Text>}
                    {record.name}
                  </span>
                ),
              },
              {
                title: 'Действие',
                key: 'action',
                render: (_, record) => {
                  const currentVal = professionMapping[record.normalized];
                  const mode = currentVal === 'new' ? 'new' : currentVal !== undefined ? 'replace' : undefined;
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <Radio.Group
                        value={mode}
                        onChange={(e) => {
                          if (e.target.value === 'new') {
                            setProfessionMapping((prev) => ({ ...prev, [record.normalized]: 'new' }));
                          } else {
                            setProfessionMapping((prev) => {
                              const next = { ...prev };
                              delete next[record.normalized];
                              return next;
                            });
                          }
                        }}
                        size="small"
                      >
                        <Radio value="new">Добавить как новую</Radio>
                        <Radio value="replace">Заменить на существующую</Radio>
                      </Radio.Group>
                      {mode === 'replace' && (
                        <Select
                          placeholder="Выберите профессию"
                          value={typeof currentVal === 'number' ? currentVal : undefined}
                          onChange={(val) =>
                            setProfessionMapping((prev) => ({ ...prev, [record.normalized]: val }))
                          }
                          options={professionOptions}
                          showSearch
                          filterOption={(input, option) =>
                            (option?.label as string || '').toLowerCase().includes(input.toLowerCase())
                          }
                          style={{ width: '100%' }}
                          size="small"
                        />
                      )}
                    </div>
                  );
                },
              },
            ]}
          />
          <Space>
            <Button size="small" onClick={goBack}>Назад</Button>
            <Button size="small" type="primary" onClick={goNext} disabled={!professionsAllMapped}>
              Далее
            </Button>
          </Space>
        </div>
      )}

      {/* Step 3: Confirm */}
      {step === 'confirm' && previewResult && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Alert
            type="info"
            showIcon
            message="Подтверждение импорта"
            description="Проверьте сводку изменений и нажмите «Применить» для выполнения импорта."
          />
          <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label="Формат файла">
              {previewResult.preview.format === 'wide_matrix' ? 'Матрица (wide)' : 'Построчный (row)'}
            </Descriptions.Item>
            <Descriptions.Item label="Новых профессий">
              {previewResult.preview.created_professions}
            </Descriptions.Item>
            <Descriptions.Item label="Связей будет создано">
              {previewResult.preview.created_statuses}
            </Descriptions.Item>
            <Descriptions.Item label="Связей будет обновлено">
              {previewResult.preview.updated_statuses}
            </Descriptions.Item>
            <Descriptions.Item label="Пропущено строк">
              {previewResult.preview.skipped_rows}
            </Descriptions.Item>
          </Descriptions>

          {previewResult.invalid_regions.length > 0 && (
            <Descriptions bordered size="small" column={1} title="Замены регионов">
              {previewResult.invalid_regions.map((r) => (
                <Descriptions.Item key={r.normalized} label={r.raw}>
                  {regionMapping[r.normalized]
                    ? regionsData?.results?.find((reg: Region) => reg.id === regionMapping[r.normalized])?.name || `ID ${regionMapping[r.normalized]}`
                    : <Typography.Text type="secondary">Пропущен</Typography.Text>}
                </Descriptions.Item>
              ))}
            </Descriptions>
          )}

          {previewResult.new_professions.length > 0 && (
            <Descriptions bordered size="small" column={1} title="Новые профессии">
              {previewResult.new_professions.map((p) => {
                const val = professionMapping[p.normalized];
                let label: React.ReactNode = <Typography.Text type="secondary">Не задано</Typography.Text>;
                if (val === 'new') {
                  label = 'Будет создана';
                } else if (typeof val === 'number') {
                  const existing = professionsData?.results?.find((pr: Profession) => pr.id === val);
                  label = existing ? `→ ${existing.number}. ${existing.name}` : `→ ID ${val}`;
                }
                return (
                  <Descriptions.Item key={p.normalized} label={p.name}>
                    {label}
                  </Descriptions.Item>
                );
              })}
            </Descriptions>
          )}

          {previewResult.preview.errors.length > 0 && (
            <Alert
              type="warning"
              showIcon
              message={`Предупреждения (${previewResult.preview.errors.length})`}
              description={
                <ul style={{ margin: 0, paddingLeft: 16 }}>
                  {previewResult.preview.errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              }
            />
          )}

          <Space>
            <Button size="small" onClick={goBack}>Назад</Button>
            <Button size="small" onClick={resetWizard}>Отмена</Button>
            <Button
              size="small"
              type="primary"
              onClick={handleApply}
              loading={applyMutation.isPending}
            >
              Применить импорт
            </Button>
          </Space>
        </div>
      )}
    </div>
  );
}
