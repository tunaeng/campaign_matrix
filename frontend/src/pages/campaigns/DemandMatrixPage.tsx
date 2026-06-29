import { useState, useMemo, useEffect } from 'react';
import {
  Card,
  Typography,
  Table,
  Switch,
  Space,
  Input,
  Tag,
  Spin,
  Row,
  Col,
  Statistic,
  Select,
  Segmented,
  Cascader,
  Button,
  Tooltip,
  Modal,
} from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { useDemandMatrix, useFederalDistricts, useFederalOperators, useRegions } from '../../api/hooks';
import type { DefaultOptionType } from 'antd/es/cascader';
import ImportWizard from './ImportWizard';

type ViewMode = 'professions-x-regions' | 'regions-x-professions';
type DemandHistoryEntry = {
  id: number;
  source?: string;
  demand_import_id?: number;
  federal_operator_id: number | null;
  federal_operator_name: string;
  previous_is_demanded: boolean | null;
  new_is_demanded: boolean;
  changed_at: string;
};

const getApprovalBorder = (status: string | null | undefined): React.CSSProperties => {
  switch (status) {
    case 'in_progress':
      return { 
        outline: '3px solid #1890ff',
        outlineOffset: '2px',
      };
    case 'preliminary_approved':
      return { 
        outline: '3px dashed #52c41a',
        outlineOffset: '2px',
      };
    case 'approved':
      return { 
        outline: '3px solid #52c41a',
        outlineOffset: '2px',
        boxShadow: '0 0 4px rgba(82, 196, 26, 0.4)',
      };
    case 'rejected':
      return { 
        outline: '3px solid #f5222d',
        outlineOffset: '2px',
      };
    case 'unlikely':
      return { 
        outline: '3px solid #fa8c16',
        outlineOffset: '2px',
      };
    default:
      return {};
  }
};

const rotatedHeaderStyle: React.CSSProperties = {
  height: 180,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  minWidth: 120,
};
const rotatedTextStyle: React.CSSProperties = {
  display: 'inline-block',
  transform: 'rotate(-45deg)',
  whiteSpace: 'normal',
  fontSize: 11,
  textAlign: 'center',
  transformOrigin: 'center center',
  maxWidth: 160,
  lineHeight: 1.3,
};

const YEAR_OPTIONS = [
  { value: 2024, label: '2024' },
  { value: 2025, label: '2025' },
  { value: 2026, label: '2026' },
];

const APPROVAL_STATUS_OPTIONS = [
  { value: 'in_progress', label: 'В проработке' },
  { value: 'preliminary_approved', label: 'Предварительно одобрено' },
  { value: 'approved', label: 'Одобрено' },
  { value: 'rejected', label: 'Отказано' },
  { value: 'unlikely', label: 'Маловероятно' },
];

function demandValueLabel(value: boolean | null) {
  if (value === null) return 'не было';
  return value ? 'да' : 'нет';
}

function formatHistoryDate(value: string) {
  return new Date(value).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function renderDemandTooltip(params: {
  approvalStatus?: string | null;
  showMissingInfo?: boolean;
  missingOps?: { id: number; short_name: string }[];
  history?: DemandHistoryEntry[];
}) {
  const { approvalStatus, showMissingInfo, missingOps, history = [] } = params;
  if (!approvalStatus && !showMissingInfo && history.length === 0) return undefined;
  return (
    <div style={{ maxWidth: 380 }}>
      {approvalStatus && <div>Статус: {approvalStatus}</div>}
      {showMissingInfo && missingOps && (
        <div style={{ marginTop: 4 }}>
          Отсутствует в: {missingOps.map((o) => o.short_name).join(', ')}
        </div>
      )}
      {history.length > 0 && (
        <div style={{ marginTop: approvalStatus || showMissingInfo ? 8 : 0 }}>
          <Typography.Text strong style={{ color: 'inherit' }}>История по импортам</Typography.Text>
          <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {history.map((item) => (
              <div key={item.id}>
                <div>{formatHistoryDate(item.changed_at)}</div>
                <div>
                  {item.federal_operator_name || 'ФО'}: востребована — {demandValueLabel(item.new_is_demanded)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DemandMatrixPage() {
  const [demandedOnly, setDemandedOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedProfessionIds, setSelectedProfessionIds] = useState<number[]>([]);
  const [selectedRegionIds, setSelectedRegionIds] = useState<number[]>([]);
  const [selectedApprovalStatuses, setSelectedApprovalStatuses] = useState<string[]>([]);
  const [selectedFederalOperatorId, setSelectedFederalOperatorId] = useState<number | undefined>();
  const [year, setYear] = useState<number>(2026);
  const [viewMode, setViewMode] = useState<ViewMode>('professions-x-regions');
  const [showDifferencesOnly, setShowDifferencesOnly] = useState<boolean>(false);
  const [deferMatrixRender, setDeferMatrixRender] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [pageSizeView1, setPageSizeView1] = useState(30);
  const [pageSizeView2, setPageSizeView2] = useState(25);
  const [selectedDemandImportIds, setSelectedDemandImportIds] = useState<number[]>([]);

  const { data: districts } = useFederalDistricts();
  const { data: regionsData } = useRegions();
  const { data: federalOperatorsData } = useFederalOperators();
  const { data: matrix, isLoading } = useDemandMatrix({
    demanded_only: demandedOnly || undefined,
    region_ids: selectedRegionIds.length > 0 ? selectedRegionIds.join(',') : undefined,
    approval_statuses: selectedApprovalStatuses.length > 0 ? selectedApprovalStatuses.join(',') : undefined,
    federal_operator_ids: selectedFederalOperatorId ? String(selectedFederalOperatorId) : undefined,
    demand_import_ids: selectedDemandImportIds.length > 0 ? selectedDemandImportIds.join(',') : undefined,
    year,
  });
  const matrixForRender = deferMatrixRender ? matrix : undefined;

  useEffect(() => {
    const raf = requestAnimationFrame(() => setDeferMatrixRender(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const filteredBySearch = useMemo(() => {
    if (!matrixForRender) return [];
    const searchLower = search.toLowerCase();
    return matrixForRender.professions.filter((p) =>
      !search || p.profession_name.toLowerCase().includes(searchLower)
    );
  }, [matrixForRender, search]);

  const filteredProfessions = useMemo(() => {
    if (selectedProfessionIds.length === 0) return filteredBySearch;
    return filteredBySearch.filter((p) => selectedProfessionIds.includes(p.profession_id));
  }, [filteredBySearch, selectedProfessionIds]);

  // Filter regions based on approval statuses
  const filteredRegions = useMemo(() => {
    if (!matrixForRender) return [];
    if (selectedApprovalStatuses.length === 0) return matrixForRender.regions;
    
    // Return only regions that have at least one profession with selected approval status
    return matrixForRender.regions.filter((region) => {
      return filteredProfessions.some((prof) => {
        const approvalStatus = prof.approvals?.[String(region.id)];
        return approvalStatus && selectedApprovalStatuses.includes(approvalStatus);
      });
    });
  }, [matrixForRender, selectedApprovalStatuses, filteredProfessions]);

  const visibleProfessions = useMemo(() => {
    if (!showDifferencesOnly) return filteredProfessions;
    if (filteredRegions.length === 0) return [];
    const visibleRegionIds = new Set(filteredRegions.map((r) => String(r.id)));
    return filteredProfessions.filter((p) =>
      Object.entries(p.region_missing_operators || {}).some(
        ([regionId, missing]) => visibleRegionIds.has(regionId) && (missing?.length || 0) > 0
      )
    );
  }, [showDifferencesOnly, filteredProfessions, filteredRegions]);

  const visibleRegions = useMemo(() => {
    if (!showDifferencesOnly) return filteredRegions;
    return filteredRegions.filter((region) =>
      visibleProfessions.some(
        (p) => (p.region_missing_operators?.[String(region.id)]?.length || 0) > 0
      )
    );
  }, [showDifferencesOnly, filteredRegions, visibleProfessions]);

  const professionOptions = useMemo(() => {
    if (!matrixForRender) return [];
    return matrixForRender.professions.map((p) => ({
      value: p.profession_id,
      label: `${p.profession_number}. ${p.profession_name}`,
    }));
  }, [matrixForRender]);

  const districtRegionCascaderOptions = useMemo(() => {
    if (!districts?.results || !regionsData?.results) return [];
    return districts.results.map((district) => ({
      value: `district_${district.id}`,
      label: district.name,
      children: regionsData.results
        .filter((r) => r.federal_district === district.id)
        .map((region) => ({
          value: region.id,
          label: region.name,
        })),
    }));
  }, [districts, regionsData]);

  const federalOperatorOptions = useMemo(() => {
    const operators = federalOperatorsData?.results || [];
    return operators
      .map((operator) => ({
        value: operator.id,
        label: operator.short_name?.trim() || operator.name,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'ru'));
  }, [federalOperatorsData]);

  const demandImportOptions = useMemo(() => {
    return (matrixForRender?.demand_imports || []).map((item) => ({
      value: item.id,
      label: `${formatHistoryDate(item.imported_at)} · ${item.federal_operator_name}`,
    }));
  }, [matrixForRender]);

  const handleRegionFilterChange = (value: (string | number)[][]) => {
    const regionIds: number[] = [];
    value.forEach((path) => {
      if (path.length === 2) {
        regionIds.push(path[1] as number);
      } else if (path.length === 1 && typeof path[0] === 'string' && path[0].startsWith('district_')) {
        const districtId = parseInt(path[0].replace('district_', ''));
        const districtRegions = regionsData?.results.filter((r) => r.federal_district === districtId) || [];
        regionIds.push(...districtRegions.map((r) => r.id));
      }
    });
    setSelectedRegionIds(regionIds);
  };

  const totalDemanded = useMemo(() => {
    if (!matrixForRender) return 0;
    let count = 0;
    for (const p of matrixForRender.professions) {
      for (const val of Object.values(p.regions)) {
        if (val) count++;
      }
    }
    return count;
  }, [matrixForRender]);

  // --- View 1: Профессии (строки) × Регионы (столбцы) ---
  const regionColumnsView1 = useMemo(() => {
    if (!matrixForRender) return [];
    return visibleRegions.map((r) => ({
      title: (
        <div style={rotatedHeaderStyle}>
          <span style={rotatedTextStyle} title={r.name}>
            {r.name}
          </span>
        </div>
      ),
      key: `r_${r.id}`,
      width: 120,
      align: 'center' as const,
      render: (_: any, record: any) => {
        const isDemanded = record.regions[String(r.id)];
        const approvalStatus = record.approvals?.[String(r.id)];
        const missingOps = record.region_missing_operators?.[String(r.id)];
        const history = record.demand_history?.[String(r.id)] as DemandHistoryEntry[] | undefined;
        const hasMissing = missingOps && missingOps.length > 0;
        const showMissingInfo = showDifferencesOnly && hasMissing;
        const borderStyle = getApprovalBorder(approvalStatus);
        const tooltipTitle = renderDemandTooltip({
          approvalStatus,
          showMissingInfo,
          missingOps,
          history,
        });
        const cell = (
          <div
            style={{
              width: '100%',
              minHeight: 24,
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: 16,
                height: 16,
                borderRadius: 3,
                background: isDemanded ? '#52c41a' : '#f0f0f0',
                ...borderStyle,
              }}
            />
            {showMissingInfo && (
              <span
                style={{
                  position: 'absolute',
                  top: 2,
                  right: 4,
                  color: '#f5222d',
                  fontSize: 13,
                  fontWeight: 700,
                  lineHeight: 1,
                }}
              >
                *
              </span>
            )}
          </div>
        );
        return tooltipTitle ? <Tooltip title={tooltipTitle}>{cell}</Tooltip> : cell;
      },
    }));
  }, [matrixForRender, visibleRegions, showDifferencesOnly]);

  const columnsView1 = useMemo(
    () => [
      {
        title: '№',
        dataIndex: 'profession_number',
        key: 'number',
        width: 50,
        fixed: 'left' as const,
      },
      {
        title: 'Профессия',
        dataIndex: 'profession_name',
        key: 'name',
        width: 280,
        fixed: 'left' as const,
        ellipsis: true,
      },
      {
        title: <span style={{ whiteSpace: 'nowrap' }}>Регионов</span>,
        key: 'count',
        width: 95,
        fixed: 'left' as const,
        align: 'center' as const,
        sorter: (a: any, b: any) => {
          const regionIdsSet = new Set(visibleRegions.map((r) => String(r.id)));
          const countA = Object.entries(a.regions).filter(([regionId, val]) => val && regionIdsSet.has(regionId)).length;
          const countB = Object.entries(b.regions).filter(([regionId, val]) => val && regionIdsSet.has(regionId)).length;
          return countA - countB;
        },
        render: (_: any, record: any) => {
          const regionIdsSet = new Set(visibleRegions.map((r) => String(r.id)));
          const count = Object.entries(record.regions).filter(([regionId, val]) => val && regionIdsSet.has(regionId)).length;
          return (
            <Tag color={count > 40 ? 'green' : count > 20 ? 'blue' : 'default'}>
              {count}
            </Tag>
          );
        },
      },
      ...regionColumnsView1,
    ],
    [regionColumnsView1, visibleRegions]
  );

  // --- View 2: Регионы (строки) × Профессии (столбцы) ---
  const regionRowsData = useMemo(() => {
    if (!matrixForRender) return [];
    return visibleRegions.map((region) => {
      const professionCount = visibleProfessions.filter(
        (p) => p.regions[String(region.id)]
      ).length;
      return {
        region_id: region.id,
        region_name: region.name,
        profession_count: professionCount,
        professions: visibleProfessions.reduce(
          (acc, p) => {
            acc[p.profession_id] = !!p.regions[String(region.id)];
            return acc;
          },
          {} as Record<number, boolean>
        ),
        approvals: visibleProfessions.reduce(
          (acc, p) => {
            acc[p.profession_id] = p.approvals?.[String(region.id)] || null;
            return acc;
          },
          {} as Record<number, string | null>
        ),
        demand_history_by_profession: visibleProfessions.reduce(
          (acc, p) => {
            const history = p.demand_history?.[String(region.id)];
            if (history?.length) acc[p.profession_id] = history;
            return acc;
          },
          {} as Record<number, DemandHistoryEntry[]>
        ),
        region_missing_operators_by_profession: visibleProfessions.reduce(
          (acc, p) => {
            const missing = p.region_missing_operators?.[String(region.id)];
            if (missing?.length) acc[p.profession_id] = missing;
            return acc;
          },
          {} as Record<number, { id: number; short_name: string }[]>
        ),
      };
    });
  }, [matrixForRender, visibleRegions, visibleProfessions]);

  const professionColumnsView2 = useMemo(() => {
    if (!matrixForRender) return [];
    return visibleProfessions.map((p) => ({
      title: (
        <div style={rotatedHeaderStyle}>
          <span style={{ ...rotatedTextStyle, maxWidth: 220 }} title={p.profession_name}>
            {p.profession_number}. {p.profession_name}
          </span>
        </div>
      ),
      key: `p_${p.profession_id}`,
      width: 160,
      align: 'center' as const,
      render: (_: any, record: any) => {
        const isDemanded = record.professions[p.profession_id];
        const approvalStatus = record.approvals?.[p.profession_id];
        const missingOps = record.region_missing_operators_by_profession?.[p.profession_id];
        const history = record.demand_history_by_profession?.[p.profession_id] as DemandHistoryEntry[] | undefined;
        const hasMissing = missingOps && missingOps.length > 0;
        const showMissingInfo = showDifferencesOnly && hasMissing;
        const borderStyle = getApprovalBorder(approvalStatus);
        const tooltipTitle = renderDemandTooltip({
          approvalStatus,
          showMissingInfo,
          missingOps,
          history,
        });
        const cell = (
          <div
            style={{
              width: '100%',
              minHeight: 24,
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: 2,
                background: isDemanded ? '#52c41a' : '#f0f0f0',
                ...borderStyle,
              }}
            />
            {showMissingInfo && (
              <span
                style={{
                  position: 'absolute',
                  top: 2,
                  right: 4,
                  color: '#f5222d',
                  fontSize: 12,
                  fontWeight: 700,
                  lineHeight: 1,
                }}
              >
                *
              </span>
            )}
          </div>
        );
        return tooltipTitle ? <Tooltip title={tooltipTitle}>{cell}</Tooltip> : cell;
      },
    }));
  }, [matrixForRender, visibleProfessions, showDifferencesOnly]);

  const columnsView2 = useMemo(
    () => [
      {
        title: 'Регион',
        dataIndex: 'region_name',
        key: 'region_name',
        width: 300,
        fixed: 'left' as const,
      },
      {
        title: 'Профессий',
        dataIndex: 'profession_count',
        key: 'count',
        width: 110,
        fixed: 'left' as const,
        align: 'center' as const,
        sorter: (a: any, b: any) => a.profession_count - b.profession_count,
        render: (v: number) => (
          <Tag color={v > 50 ? 'green' : v > 20 ? 'blue' : 'default'}>{v}</Tag>
        ),
      },
      ...professionColumnsView2,
    ],
    [professionColumnsView2]
  );

  return (
    <div>
      <Typography.Title level={4}>Матрица востребованности профессий</Typography.Title>
      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
        Зелёные ячейки — востребованность в регионе. Переключите вид: профессии×регионы или
        регионы×профессии.
      </Typography.Text>
      {showDifferencesOnly && (
        <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
          <span style={{ color: '#f5222d', fontWeight: 700 }}>*</span> — отсутствует в части ФО (подробности в подсказке ячейки).
        </Typography.Text>
      )}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          <strong>Статусы одобрения (окантовка):</strong>
        </Typography.Text>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ width: 16, height: 16, borderRadius: 2, background: '#52c41a', outline: '3px solid #1890ff', outlineOffset: '2px' }} />
          <Typography.Text style={{ fontSize: 12 }}>В проработке</Typography.Text>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ width: 16, height: 16, borderRadius: 2, background: '#52c41a', outline: '3px dashed #52c41a', outlineOffset: '2px' }} />
          <Typography.Text style={{ fontSize: 12 }}>Предварительно одобрено</Typography.Text>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ width: 16, height: 16, borderRadius: 2, background: '#52c41a', outline: '3px solid #52c41a', outlineOffset: '2px' }} />
          <Typography.Text style={{ fontSize: 12 }}>Одобрено</Typography.Text>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ width: 16, height: 16, borderRadius: 2, background: '#f0f0f0', outline: '3px solid #f5222d', outlineOffset: '2px' }} />
          <Typography.Text style={{ fontSize: 12 }}>Отказано</Typography.Text>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ width: 16, height: 16, borderRadius: 2, background: '#f0f0f0', outline: '3px solid #fa8c16', outlineOffset: '2px' }} />
          <Typography.Text style={{ fontSize: 12 }}>Маловероятно</Typography.Text>
        </div>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Строка 1: Поиск + Только с востребованностью */}
            <div className="filter-bar" style={{ gap: 12 }}>
              <Input
                placeholder="Поиск профессии"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: 300 }}
                allowClear
              />
              <Space>
                <Switch checked={demandedOnly} onChange={setDemandedOnly} />
                <Typography.Text>Только с востребованностью</Typography.Text>
              </Space>
            </div>

            {/* Строка 2: Переключение вида + Год + ФО */}
            <div className="filter-bar" style={{ gap: 12 }}>
              <Segmented
                value={viewMode}
                onChange={(v) => setViewMode(v as ViewMode)}
                options={[
                  { value: 'professions-x-regions', label: 'Профессии × Регионы' },
                  { value: 'regions-x-professions', label: 'Регионы × Профессии' },
                ]}
              />
              <Select
                placeholder="Год"
                value={year}
                onChange={setYear}
                options={YEAR_OPTIONS}
                style={{ width: 100 }}
              />
              <Select
                placeholder="Федеральный оператор"
                value={selectedFederalOperatorId}
                onChange={(v) => setSelectedFederalOperatorId(v)}
                options={federalOperatorOptions}
                style={{ minWidth: 260 }}
                allowClear
              />
              <Select
                mode="multiple"
                placeholder="Импорты для истории"
                value={selectedDemandImportIds.length ? selectedDemandImportIds : undefined}
                onChange={(ids) => setSelectedDemandImportIds(ids || [])}
                options={demandImportOptions}
                style={{ minWidth: 360 }}
                maxTagCount="responsive"
                allowClear
              />
              <Space>
                <Switch checked={showDifferencesOnly} onChange={setShowDifferencesOnly} />
                <Typography.Text>Показать различия по ФО</Typography.Text>
              </Space>
            </div>

            {/* Строка 3: Фильтры по профессиям, регионам и статусам одобрения */}
            <div className="filter-bar" style={{ gap: 12, alignItems: 'flex-start' }}>
              <Select
                mode="multiple"
                placeholder="Фильтр по профессиям"
                value={selectedProfessionIds.length ? selectedProfessionIds : undefined}
                onChange={(ids) => setSelectedProfessionIds(ids || [])}
                options={professionOptions}
                style={{ minWidth: 300 }}
                maxTagCount="responsive"
                allowClear
              />
              <Cascader
                multiple
                placeholder="Фильтр по округам/регионам"
                options={districtRegionCascaderOptions}
                onChange={handleRegionFilterChange}
                style={{ minWidth: 300 }}
                maxTagCount="responsive"
                showCheckedStrategy="SHOW_CHILD"
                showSearch={{
                  filter: (inputValue, path) =>
                    path.some((opt) =>
                      String(opt?.label ?? '').toLowerCase().includes(String(inputValue).toLowerCase())
                    ),
                }}
                allowClear
              />
              <Select
                mode="multiple"
                placeholder="Статус одобрения"
                value={selectedApprovalStatuses.length ? selectedApprovalStatuses : undefined}
                onChange={(statuses) => setSelectedApprovalStatuses(statuses || [])}
                options={APPROVAL_STATUS_OPTIONS}
                style={{ minWidth: 250 }}
                maxTagCount="responsive"
                allowClear
              />
            </div>

            {matrixForRender && (
              <Row gutter={24} style={{ marginTop: 4 }}>
                <Col>
                  <Statistic title="Год" value={matrixForRender.year} formatter={(v) => String(v)} valueStyle={{ fontSize: 18 }} />
                </Col>
                <Col>
                  <Statistic title="Профессий" value={visibleProfessions.length} valueStyle={{ fontSize: 18 }} />
                </Col>
                <Col>
                  <Statistic title="Регионов" value={visibleRegions.length} valueStyle={{ fontSize: 18 }} />
                </Col>
                <Col>
                  <Statistic title="Всего востребовано" value={totalDemanded} suffix="связей" valueStyle={{ fontSize: 18 }} />
                </Col>
                <Col style={{ marginLeft: 'auto' }}>
                  <Button icon={<UploadOutlined />} onClick={() => setImportModalOpen(true)}>
                    Импорт
                  </Button>
                </Col>
              </Row>
            )}
            {!matrixForRender && (
              <div>
                <Button icon={<UploadOutlined />} onClick={() => setImportModalOpen(true)}>
                  Импорт
                </Button>
              </div>
            )}

          <Modal
            title="Импорт востребованности"
            open={importModalOpen}
            onCancel={() => setImportModalOpen(false)}
            footer={null}
            width={640}
            destroyOnClose
          >
            <ImportWizard onDone={() => setImportModalOpen(false)} />
          </Modal>
        </div>
      </Card>

      {isLoading || !matrixForRender ? (
        <div style={{ textAlign: 'center', padding: 80 }}>
          <Spin size="large" />
        </div>
      ) : viewMode === 'professions-x-regions' ? (
        <Card styles={{ body: { padding: 12, overflow: 'auto' } }}>
          <Table
            className="demand-matrix-table"
            dataSource={visibleProfessions}
            columns={columnsView1}
            rowKey="profession_id"
            size="small"
            virtual
            pagination={{
              pageSize: pageSizeView1,
              showSizeChanger: true,
              pageSizeOptions: [10, 20, 30, 50, 100],
              onShowSizeChange: (_current, size) => setPageSizeView1(size),
              showTotal: (t) => `Всего: ${t}`,
            }}
            scroll={{
              x: 425 + visibleRegions.length * 120,
              y: 620,
            }}
            bordered
          />
        </Card>
      ) : (
        <Card styles={{ body: { padding: 12, overflow: 'auto' } }}>
          <Table
            className="demand-matrix-table"
            dataSource={regionRowsData}
            columns={columnsView2}
            rowKey="region_id"
            size="small"
            virtual
            pagination={{
              pageSize: pageSizeView2,
              showSizeChanger: true,
              pageSizeOptions: [10, 20, 25, 50, 100],
              onShowSizeChange: (_current, size) => setPageSizeView2(size),
              showTotal: (t) => `Всего: ${t}`,
            }}
            scroll={{
              x: 410 + visibleProfessions.length * 160,
              y: 620,
            }}
            bordered
          />
        </Card>
      )}
    </div>
  );
}
