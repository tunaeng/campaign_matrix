import React, { useMemo } from 'react';
import { Select, Typography, Tooltip } from 'antd';
import { REGION_MAP_LAYOUT, MAP_ROWS, MAP_COLS } from './regionMapData';
import type { DemandMatrix } from '../../types';

interface RegionMapViewProps {
  matrix: DemandMatrix;
  professionOptions: { value: number; label: string }[];
  highlightedRegionIds?: number[];
  selectedProfessionId?: number;
  onSelectedProfessionChange?: (value: number | undefined) => void;
  showProfessionSelector?: boolean;
  showDifferencesOnly?: boolean;
}

const APPROVAL_LABELS: Record<string, string> = {
  in_progress: 'В проработке',
  preliminary_approved: 'Предварительно одобрено',
  approved: 'Одобрено',
  rejected: 'Отказано',
  unlikely: 'Маловероятно',
};

const APPROVAL_COLORS: Record<string, string> = {
  in_progress: '#1890ff',
  preliminary_approved: '#52c41a',
  approved: '#52c41a',
  rejected: '#f5222d',
  unlikely: '#fa8c16',
};

const getApprovalBorder = (status: string | null): React.CSSProperties => {
  if (!status) return {};
  const color = APPROVAL_COLORS[status] || '#d9d9d9';
  if (status === 'preliminary_approved') {
    return {
      borderWidth: 4,
      borderStyle: 'dashed',
      borderColor: color,
    };
  }
  return {
    borderWidth: 4,
    borderStyle: 'solid',
    borderColor: color,
    ...(status === 'approved' ? { boxShadow: `inset 0 0 6px rgba(82, 196, 26, 0.35)` } : {}),
  };
};

const CELL = 66;
const GAP = 3;

export default function RegionMapView({
  matrix,
  professionOptions,
  highlightedRegionIds,
  selectedProfessionId,
  onSelectedProfessionChange,
  showProfessionSelector = true,
  showDifferencesOnly = false,
}: RegionMapViewProps) {
  const [internalSelectedProfessionId, setInternalSelectedProfessionId] = React.useState<
    number | undefined
  >(undefined);
  const activeProfessionId =
    selectedProfessionId !== undefined ? selectedProfessionId : internalSelectedProfessionId;
  const handleProfessionChange = (value: number | undefined) => {
    if (onSelectedProfessionChange) {
      onSelectedProfessionChange(value);
      return;
    }
    setInternalSelectedProfessionId(value);
  };

  const regionNameToId = useMemo(() => {
    const map = new Map<string, number>();
    for (const region of matrix.regions) {
      map.set(region.name, region.id);
    }
    return map;
  }, [matrix.regions]);

  const selectedProfession = useMemo(() => {
    if (!activeProfessionId) return null;
    return matrix.professions.find((p) => p.profession_id === activeProfessionId) || null;
  }, [matrix.professions, activeProfessionId]);

  const stats = useMemo(() => {
    if (!selectedProfession) return null;
    let demanded = 0;
    const approvalCounts: Record<string, number> = {};
    for (const region of matrix.regions) {
      const rid = String(region.id);
      if (selectedProfession.regions[rid]) demanded++;
      const approval = selectedProfession.approvals?.[rid];
      if (approval && approval !== 'pending') {
        approvalCounts[approval] = (approvalCounts[approval] || 0) + 1;
      }
    }
    return { demanded, approvalCounts };
  }, [selectedProfession, matrix.regions]);

  const demandedCountByRegion = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const region of matrix.regions) {
      const regionId = String(region.id);
      counts[regionId] = 0;
      for (const profession of matrix.professions) {
        if (profession.regions[regionId]) {
          counts[regionId] += 1;
        }
      }
    }
    return counts;
  }, [matrix.regions, matrix.professions]);

  const gridCells = useMemo(() => {
    return REGION_MAP_LAYOUT.map((cell) => {
      const regionId = regionNameToId.get(cell.regionName) ?? null;
      let isDemanded = false;
      let approvalStatus: string | null = null;
      let missingInOperators: { id: number; short_name: string }[] = [];

      if (regionId !== null && selectedProfession) {
        isDemanded = !!selectedProfession.regions[String(regionId)];
        const a = selectedProfession.approvals?.[String(regionId)];
        approvalStatus = a && a !== 'pending' ? a : null;
        missingInOperators = selectedProfession.region_missing_operators?.[String(regionId)] ?? [];
      }

      return { ...cell, regionId, isDemanded, approvalStatus, missingInOperators };
    });
  }, [regionNameToId, selectedProfession]);

  return (
    <div>
      {showProfessionSelector && (
        <div style={{ marginBottom: 16, display: 'flex', gap: 16, alignItems: 'center' }}>
          <Typography.Text strong>Профессия:</Typography.Text>
          <Select
            showSearch
            placeholder="Выберите профессию"
            value={activeProfessionId}
            onChange={handleProfessionChange}
            options={professionOptions}
            style={{ minWidth: 420 }}
            filterOption={(input, option) =>
              (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
            }
            allowClear
          />
        </div>
      )}

      {/* Stats bar */}
      {stats && selectedProfession && (
        <div style={{ marginBottom: 12, display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <Typography.Text strong style={{ fontSize: 14 }}>
            {selectedProfession.profession_number}. {selectedProfession.profession_name}
          </Typography.Text>
          <Typography.Text type="secondary">
            Востребована в <strong>{stats.demanded}</strong> из {matrix.regions.length} регионов
          </Typography.Text>
          {Object.entries(stats.approvalCounts).map(([status, count]) => (
            <span key={status} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: APPROVAL_COLORS[status],
                  display: 'inline-block',
                }}
              />
              <Typography.Text style={{ fontSize: 13 }}>
                {APPROVAL_LABELS[status]}: {count}
              </Typography.Text>
            </span>
          ))}
        </div>
      )}

      <div
        style={{
          display: 'inline-grid',
          gridTemplateColumns: `repeat(${MAP_COLS}, ${CELL}px)`,
          gridTemplateRows: `repeat(${MAP_ROWS}, ${CELL}px)`,
          gap: GAP,
          padding: 4,
          background: '#fff',
        }}
      >
        {Array.from({ length: MAP_ROWS }).flatMap((_, r) =>
          Array.from({ length: MAP_COLS }).map((_, c) => {
            const key = `${r}-${c}`;
            const regionCell = gridCells.find((gc) => gc.row === r && gc.col === c);

            if (!regionCell) {
              return <div key={key} style={{ gridRow: r + 1, gridColumn: c + 1 }} />;
            }

            const hasDemand = regionCell.isDemanded;
            const approval = regionCell.approvalStatus;
            const missingInOperators = regionCell.missingInOperators ?? [];
            const hasMissingInOperators = missingInOperators.length > 0;
            const showMissingInfo = showDifferencesOnly && hasMissingInOperators;
            const passesDifferenceFilter =
              !showDifferencesOnly || !selectedProfession || hasMissingInOperators;
            const hasData = hasDemand || !!approval;
            const borderStyle = getApprovalBorder(approval);
            const isHighlighted =
              !highlightedRegionIds || !regionCell.regionId
                ? true
                : highlightedRegionIds.includes(regionCell.regionId);
            const demandedCount =
              regionCell.regionId !== null ? demandedCountByRegion[String(regionCell.regionId)] || 0 : 0;
            const showCountMode = !selectedProfession;

            const tooltipTitle = (
              <div>
                <div style={{ fontWeight: 600 }}>{regionCell.regionName}</div>
                {showCountMode ? (
                  <div>Востребованных профессий: {demandedCount}</div>
                ) : (
                  <>
                    <div>{hasDemand ? '✓ Востребована' : '— Не востребована'}</div>
                    {approval && <div>{APPROVAL_LABELS[approval]}</div>}
                    {showMissingInfo && (
                      <div style={{ marginTop: 4, color: '#ff7875' }}>
                        Отсутствует в: {missingInOperators.map((o) => o.short_name).join(', ')}
                      </div>
                    )}
                  </>
                )}
              </div>
            );

            return (
              <Tooltip key={key} title={tooltipTitle} placement="top">
                <div
                  style={{
                    gridRow: r + 1,
                    gridColumn: c + 1,
                    width: CELL,
                    height: CELL,
                    background: selectedProfession
                      ? passesDifferenceFilter
                        ? isHighlighted
                          ? hasDemand
                            ? '#b7eb8f'
                            : '#e8e8e8'
                          : '#efefef'
                        : '#f5f5f5'
                      : isHighlighted
                        ? '#e8e8e8'
                        : '#efefef',
                    borderRadius: 3,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 2,
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'transform 0.12s ease, box-shadow 0.12s ease',
                    border: '4px solid transparent',
                    ...(isHighlighted && passesDifferenceFilter ? borderStyle : {}),
                    opacity: isHighlighted ? (passesDifferenceFilter ? 1 : 0.25) : 0.55,
                  }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget;
                    el.style.transform = 'scale(1.06)';
                    el.style.zIndex = '10';
                    el.style.boxShadow = '0 3px 10px rgba(0,0,0,0.18)';
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget;
                    el.style.transform = '';
                    el.style.zIndex = '';
                    el.style.boxShadow = '';
                  }}
                >
                  {showMissingInfo && (
                    <span
                      style={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: '#f5222d',
                        zIndex: 1,
                      }}
                    />
                  )}
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: hasData || showCountMode ? 700 : 500,
                      color: isHighlighted ? (hasDemand ? '#135200' : '#555') : '#a6a6a6',
                      lineHeight: 1.1,
                      textAlign: 'center',
                      letterSpacing: -0.3,
                    }}
                  >
                    {regionCell.abbr}
                  </span>
                  {showCountMode && (
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: isHighlighted ? '#262626' : '#8c8c8c',
                        lineHeight: 1,
                      }}
                    >
                      {demandedCount}
                    </span>
                  )}
                </div>
              </Tooltip>
            );
          })
        )}
      </div>

      {/* Legend */}
      <div style={{ marginTop: 20, display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <div style={{ width: 20, height: 20, borderRadius: 2, background: '#b7eb8f' }} />
          <Typography.Text style={{ fontSize: 12 }}>Востребована</Typography.Text>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <div style={{ width: 20, height: 20, borderRadius: 2, background: '#e8e8e8' }} />
          <Typography.Text style={{ fontSize: 12 }}>Не востребована</Typography.Text>
        </div>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>|</Typography.Text>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <div style={{ width: 20, height: 20, borderRadius: 2, background: '#e8e8e8', border: '4px solid #1890ff' }} />
          <Typography.Text style={{ fontSize: 12 }}>В проработке</Typography.Text>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <div style={{ width: 20, height: 20, borderRadius: 2, background: '#b7eb8f', border: '4px dashed #52c41a' }} />
          <Typography.Text style={{ fontSize: 12 }}>Предв. одобрено</Typography.Text>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <div style={{ width: 20, height: 20, borderRadius: 2, background: '#b7eb8f', border: '4px solid #52c41a' }} />
          <Typography.Text style={{ fontSize: 12 }}>Одобрено</Typography.Text>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <div style={{ width: 20, height: 20, borderRadius: 2, background: '#e8e8e8', border: '4px solid #f5222d' }} />
          <Typography.Text style={{ fontSize: 12 }}>Отказано</Typography.Text>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <div style={{ width: 20, height: 20, borderRadius: 2, background: '#e8e8e8', border: '4px solid #fa8c16' }} />
          <Typography.Text style={{ fontSize: 12 }}>Маловероятно</Typography.Text>
        </div>
        {showDifferencesOnly && (
          <>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>|</Typography.Text>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f5222d', display: 'inline-block' }} />
              <Typography.Text style={{ fontSize: 12 }}>Отсутствует в части ФО (см. подсказку)</Typography.Text>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
