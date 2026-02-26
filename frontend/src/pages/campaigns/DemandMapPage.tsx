import { useMemo, useState } from 'react';
import { Card, Cascader, Select, Spin, Switch, Typography } from 'antd';
import type { DefaultOptionType } from 'antd/es/cascader';
import { useDemandMatrix, useFederalDistricts, useRegions } from '../../api/hooks';
import RegionMapView from './RegionMapView';

const YEAR_OPTIONS = [
  { value: 2024, label: '2024' },
  { value: 2025, label: '2025' },
  { value: 2026, label: '2026' },
];

export default function DemandMapPage() {
  const [year, setYear] = useState<number>(2026);
  const [selectedRegionIds, setSelectedRegionIds] = useState<number[]>([]);
  const [selectedProfessionId, setSelectedProfessionId] = useState<number | undefined>(undefined);
  const [showDifferencesOnly, setShowDifferencesOnly] = useState<boolean>(false);

  const { data: districts } = useFederalDistricts();
  const { data: regionsData } = useRegions();
  const { data: matrix, isLoading } = useDemandMatrix({ year });

  const professionOptions = useMemo(() => {
    if (!matrix) return [];
    return matrix.professions.map((p) => ({
      value: p.profession_id,
      label: `${p.profession_number}. ${p.profession_name}`,
    }));
  }, [matrix]);

  const districtRegionCascaderOptions = useMemo<DefaultOptionType[]>(() => {
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

  const handleRegionFilterChange = (value: (string | number | null)[][]) => {
    const regionIds: number[] = [];
    value.forEach((path) => {
      if (path.length === 2 && typeof path[1] === 'number') {
        regionIds.push(path[1]);
      } else if (
        path.length === 1 &&
        typeof path[0] === 'string' &&
        path[0].startsWith('district_')
      ) {
        const districtId = Number(path[0].replace('district_', ''));
        const districtRegions =
          regionsData?.results.filter((r) => r.federal_district === districtId) || [];
        regionIds.push(...districtRegions.map((r) => r.id));
      }
    });
    setSelectedRegionIds(Array.from(new Set(regionIds)));
  };

  return (
    <div>
      <Typography.Title level={4}>Карта по регионам</Typography.Title>
      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        Выберите профессию на карте. Фильтр по округам/регионам подсвечивает выбранные регионы,
        остальные отображаются серыми.
      </Typography.Text>

      {isLoading || !matrix ? (
        <div style={{ textAlign: 'center', padding: 80 }}>
          <Spin size="large" />
        </div>
      ) : (
        <Card styles={{ body: { padding: 16, overflow: 'auto' } }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
            <Select
              placeholder="Год"
              value={year}
              onChange={setYear}
              options={YEAR_OPTIONS}
              style={{ width: 110 }}
            />
            <Cascader
              multiple
              placeholder="Фильтр по округам/регионам (подсветка)"
              options={districtRegionCascaderOptions}
              onChange={(value) =>
                handleRegionFilterChange(value as (string | number | null)[][])
              }
              style={{ minWidth: 340 }}
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
              showSearch
              placeholder="Профессия"
              value={selectedProfessionId}
              onChange={(value) => setSelectedProfessionId(value)}
              options={professionOptions}
              style={{ minWidth: 420 }}
              filterOption={(input, option) =>
                (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
              }
              allowClear
            />
            <Switch checked={showDifferencesOnly} onChange={setShowDifferencesOnly} />
            <Typography.Text style={{ fontSize: 13 }}>Показать различия по ФО</Typography.Text>
          </div>
          <RegionMapView
            matrix={matrix}
            professionOptions={professionOptions}
            highlightedRegionIds={selectedRegionIds.length ? selectedRegionIds : undefined}
            selectedProfessionId={selectedProfessionId}
            onSelectedProfessionChange={setSelectedProfessionId}
            showProfessionSelector={false}
            showDifferencesOnly={showDifferencesOnly}
          />
        </Card>
      )}
    </div>
  );
}
