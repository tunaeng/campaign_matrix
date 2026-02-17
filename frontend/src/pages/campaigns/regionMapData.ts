export interface RegionCell {
  regionName: string;
  abbr: string;
  row: number;
  col: number;
}

export const MAP_ROWS = 10;
export const MAP_COLS = 17;

export const REGION_MAP_LAYOUT: RegionCell[] = [
  // Row 0
  { regionName: 'Республика Карелия', abbr: 'КАР', row: 0, col: 5 },
  { regionName: 'Мурманская область', abbr: 'МУР', row: 0, col: 6 },

  // Row 1
  { regionName: 'г. Санкт-Петербург', abbr: 'СПБ', row: 1, col: 3 },
  { regionName: 'Ленинградская область', abbr: 'Л.О.', row: 1, col: 4 },
  { regionName: 'Вологодская область', abbr: 'ВОЛ', row: 1, col: 5 },
  { regionName: 'Архангельская область', abbr: 'АРХ', row: 1, col: 8 },
  { regionName: 'Ненецкий автономный округ', abbr: 'НАО', row: 1, col: 9 },

  // Row 2
  { regionName: 'Калининградская область', abbr: 'КЛН', row: 2, col: 0 },
  { regionName: 'Псковская область', abbr: 'ПСК', row: 2, col: 2 },
  { regionName: 'Новгородская область', abbr: 'НОВ', row: 2, col: 3 },
  { regionName: 'Тверская область', abbr: 'ТВЕ', row: 2, col: 4 },
  { regionName: 'Ярославская область', abbr: 'ЯРО', row: 2, col: 5 },
  { regionName: 'Ивановская область', abbr: 'ИВА', row: 2, col: 6 },
  { regionName: 'Костромская область', abbr: 'КОС', row: 2, col: 7 },
  { regionName: 'Кировская область', abbr: 'КИР', row: 2, col: 8 },
  { regionName: 'Республика Коми', abbr: 'КОМ', row: 2, col: 9 },
  { regionName: 'Ямало-Ненецкий автономный округ', abbr: 'Я-Н', row: 2, col: 10 },
  { regionName: 'Чукотский автономный округ', abbr: 'ЧУК', row: 2, col: 15 },
  { regionName: 'Камчатский край', abbr: 'КАМ', row: 2, col: 16 },

  // Row 3
  { regionName: 'Смоленская область', abbr: 'СМО', row: 3, col: 3 },
  { regionName: 'г. Москва', abbr: 'МСК', row: 3, col: 4 },
  { regionName: 'Московская область', abbr: 'М.О.', row: 3, col: 5 },
  { regionName: 'Владимирская область', abbr: 'ВЛА', row: 3, col: 6 },
  { regionName: 'Республика Марий Эл', abbr: 'М-Э', row: 3, col: 7 },
  { regionName: 'Удмуртская Республика', abbr: 'УДМ', row: 3, col: 8 },
  { regionName: 'Пермский край', abbr: 'ПРМ', row: 3, col: 9 },
  { regionName: 'Ханты-Мансийский АО - Югра', abbr: 'Х-М', row: 3, col: 10 },
  { regionName: 'Омская область', abbr: 'ОМС', row: 3, col: 11 },
  { regionName: 'Томская область', abbr: 'ТОМ', row: 3, col: 12 },
  { regionName: 'Красноярский край', abbr: 'КРА', row: 3, col: 13 },
  { regionName: 'Республика Саха (Якутия)', abbr: 'ЯКУ', row: 3, col: 14 },
  { regionName: 'Магаданская область', abbr: 'МАГ', row: 3, col: 15 },

  // Row 4
  { regionName: 'Брянская область', abbr: 'БРЯ', row: 4, col: 2 },
  { regionName: 'Калужская область', abbr: 'КЛЖ', row: 4, col: 3 },
  { regionName: 'Тульская область', abbr: 'ТУЛ', row: 4, col: 4 },
  { regionName: 'Рязанская область', abbr: 'РЯЗ', row: 4, col: 5 },
  { regionName: 'Нижегородская область', abbr: 'НИЖ', row: 4, col: 6 },
  { regionName: 'Чувашская Республика - Чувашия', abbr: 'ЧУВ', row: 4, col: 7 },
  { regionName: 'Республика Татарстан (Татарстан)', abbr: 'ТАТ', row: 4, col: 8 },
  { regionName: 'Республика Башкортостан', abbr: 'БАШ', row: 4, col: 9 },
  { regionName: 'Свердловская область', abbr: 'СВЕ', row: 4, col: 10 },
  { regionName: 'Новосибирская область', abbr: 'НВС', row: 4, col: 11 },
  { regionName: 'Кемеровская область', abbr: 'КЕМ', row: 4, col: 12 },
  { regionName: 'Иркутская область', abbr: 'ИРК', row: 4, col: 13 },
  { regionName: 'Амурская область', abbr: 'АМУ', row: 4, col: 14 },
  { regionName: 'Хабаровский край', abbr: 'ХАБ', row: 4, col: 15 },

  // Row 5
  { regionName: 'Курская область', abbr: 'КУР', row: 5, col: 2 },
  { regionName: 'Орловская область', abbr: 'ОРЛ', row: 5, col: 3 },
  { regionName: 'Липецкая область', abbr: 'ЛИП', row: 5, col: 4 },
  { regionName: 'Тамбовская область', abbr: 'ТАМ', row: 5, col: 5 },
  { regionName: 'Республика Мордовия', abbr: 'МРД', row: 5, col: 6 },
  { regionName: 'Ульяновская область', abbr: 'УЛН', row: 5, col: 7 },
  { regionName: 'Самарская область', abbr: 'САМ', row: 5, col: 8 },
  { regionName: 'Оренбургская область', abbr: 'ОРН', row: 5, col: 9 },
  { regionName: 'Тюменская область', abbr: 'ТЮМ', row: 5, col: 10 },
  { regionName: 'Алтайский край', abbr: 'АЛ.К.', row: 5, col: 11 },
  { regionName: 'Республика Хакасия', abbr: 'ХАК', row: 5, col: 12 },
  { regionName: 'Республика Бурятия', abbr: 'БУР', row: 5, col: 13 },
  { regionName: 'Забайкальский край', abbr: 'ЗАБ', row: 5, col: 14 },
  { regionName: 'Еврейская автономная область', abbr: 'ЕАО', row: 5, col: 15 },
  { regionName: 'Сахалинская область', abbr: 'САХ', row: 5, col: 16 },

  // Row 6
  { regionName: 'Белгородская область', abbr: 'БЕЛ', row: 6, col: 3 },
  { regionName: 'Воронежская область', abbr: 'ВРЖ', row: 6, col: 4 },
  { regionName: 'Волгоградская область', abbr: 'ВГГ', row: 6, col: 5 },
  { regionName: 'Пензенская область', abbr: 'ПЕН', row: 6, col: 6 },
  { regionName: 'Саратовская область', abbr: 'САР', row: 6, col: 7 },
  { regionName: 'Челябинская область', abbr: 'ЧЕЛ', row: 6, col: 9 },
  { regionName: 'Курганская область', abbr: 'КРГ', row: 6, col: 10 },
  { regionName: 'Республика Алтай', abbr: 'АЛТ', row: 6, col: 12 },
  { regionName: 'Республика Тыва', abbr: 'ТЫВ', row: 6, col: 13 },
  { regionName: 'Приморский край', abbr: 'ПР.К.', row: 6, col: 16 },

  // Row 8 (gap at row 7)
  { regionName: 'Запорожская область', abbr: 'ЗАП', row: 7, col: 1 },
  { regionName: 'Донецкая Народная Республика', abbr: 'ДНР', row: 7, col: 2 },
  { regionName: 'Луганская Народная Республика', abbr: 'ЛНР', row: 7, col: 3 },
  { regionName: 'Ростовская область', abbr: 'РОС', row: 7, col: 4 },
  { regionName: 'Астраханская область', abbr: 'АСТ', row: 7, col: 5 },

  // Row 9 (shifted right by 1 — ХРС under ДНР, not under ЗАП)
  { regionName: 'Херсонская область', abbr: 'ХРС', row: 8, col: 1 },
  { regionName: 'Республика Адыгея', abbr: 'АДГ', row: 8, col: 2 },
  { regionName: 'Краснодарский край', abbr: 'КР.К.', row: 8, col: 3 },
  { regionName: 'Ставропольский край', abbr: 'СТ.К.', row: 8, col: 4 },
  { regionName: 'Республика Ингушетия', abbr: 'ИНГ', row: 8, col: 5 },
  { regionName: 'Республика Калмыкия', abbr: 'КЛМ', row: 8, col: 6 },

  // Row 10
  { regionName: 'г. Севастополь', abbr: 'СЕВ', row: 9, col: 0 },
  { regionName: 'Республика Крым', abbr: 'КРМ', row: 9, col: 1 },
  { regionName: 'Карачаево-Черкесская Республика', abbr: 'К-Ч', row: 9, col: 3 },
  { regionName: 'Кабардино-Балкарская Республика', abbr: 'К-Б', row: 9, col: 4 },
  { regionName: 'Республика Северная Осетия - Алания', abbr: 'ОСЕ', row: 9, col: 5 },
  { regionName: 'Чеченская Республика', abbr: 'ЧЕЧ', row: 9, col: 6 },
  { regionName: 'Республика Дагестан', abbr: 'ДАГ', row: 9, col: 7 },
];
