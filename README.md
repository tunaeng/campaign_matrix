# Матрица потребности — модуль создания кампаний по сбору потребности

Веб-приложение для формирования кампаний по сбору потребности в обучении, с учётом востребованности профессий по регионам, квот, договоров и статусов согласования с МинТруда/ФО.

## Технологический стек

- **Backend:** Django 5.1 + Django REST Framework, PostgreSQL
- **Frontend:** React 18 + TypeScript, Vite, Ant Design, React Query
- **Auth:** JWT (djangorestframework-simplejwt), роли: admin, manager
- **Инфраструктура:** Docker Compose (PostgreSQL + backend + frontend)

## Локальный запуск на этой машине (Windows)

Запуск без Docker — бэкенд на SQLite, фронтенд через Vite.

**1. Бэкенд (в первом терминале):**

```powershell
cd c:\Users\Administrator\projects\campaings_matrix\backend
.\venv\Scripts\Activate.ps1
python manage.py migrate
python manage.py createsuperuser
python manage.py load_regions
python manage.py runserver
```

(Если venv нет: `python -m venv venv`, затем `pip install -r requirements.txt`.)

**2. Фронтенд (во втором терминале):**

Если `npm` не находится, сначала добавьте Node.js в PATH:

```powershell
$env:PATH = "C:\Program Files\nodejs;" + $env:PATH
```

Затем:

```powershell
cd c:\Users\Administrator\projects\campaings_matrix\frontend
npm install
npm run dev
```

**3. Открыть в браузере:** http://localhost:5173  
Войти под учётной записью, созданной через `createsuperuser`.

**4. Добавить статусы одобрения (опционально):**

Для визуализации окантовки в матрице востребованности используйте management-команду для генерации тестовых данных:

```powershell
cd c:\Users\Administrator\projects\campaings_matrix\backend
.\venv\Scripts\Activate.ps1
python manage.py generate_approval_statuses --coverage 0.5
```

Параметры команды:
- `--coverage 0.5` — генерирует статусы для 50% от всех пар профессия-регион (от 0.0 до 1.0)
- `--year 2026` — год для статусов (по умолчанию 2026)

Команда создаёт случайное распределение статусов для всех профессий (востребованных и невостребованных):
- 20% — в проработке (in_progress)
- 25% — предварительно одобрено (preliminary_approved)
- 35% — одобрено по факту (approved)
- 10% — отказано (rejected)
- 10% — маловероятно (unlikely)

Также можно добавить записи вручную через админ-панель (Reference → Статусы одобрения профессий) или Django shell.

---

## Быстрый старт (Docker)

```bash
# Клонировать репозиторий
git clone <repo-url>
cd campaings_matrix

# Запустить все сервисы
docker-compose up --build

# В отдельном терминале — создать суперпользователя
docker-compose exec backend python manage.py createsuperuser

# Загрузить справочные данные
docker-compose exec backend python manage.py load_regions
docker-compose exec backend python manage.py load_demand_matrix data/demand_matrix.csv
```

Приложение доступно по адресам:
- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:8000/api/
- **Django Admin:** http://localhost:8000/admin/

## Локальная разработка (без Docker)

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Linux/macOS

pip install -r requirements.txt

python manage.py migrate
python manage.py createsuperuser
python manage.py load_regions
python manage.py runserver
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Структура проекта

```
campaings_matrix/
  backend/
    manage.py
    config/                # Django settings, urls, wsgi
    apps/
      accounts/            # User model, auth views (JWT login/refresh/me)
      reference/           # Regions, Professions, Programs, FederalOperators, Quotas
      organizations/       # Organizations, Interactions
      campaigns/           # Campaign, Queue, CampaignProgram, CampaignRegion, CampaignOrg
    requirements.txt
    Dockerfile
  frontend/
    package.json
    src/
      api/                 # Axios client, React Query hooks
      components/          # Shared UI components (AppLayout)
      pages/
        auth/              # Login page
        campaigns/         # Campaign list, constructor (6 steps), detail, demand matrix
      types/               # TypeScript interfaces
    vite.config.ts
    Dockerfile
  docker-compose.yml
  README.md
```

## Основные модули

### Справочники (Reference Data)
- **Федеральные округа** — 8 округов РФ
- **Регионы** — 89 субъектов РФ
- **Профессии** — 179+ профессий из перечня
- **Востребованность** — матрица профессий x регионов (загружается из CSV)
- **Программы обучения** — привязаны к профессиям
- **Федеральные операторы** — ФО с договорами
- **Договоры и приложения** — статусы программ в договорах
- **Квоты** — квоты по ФО, программам, регионам

### Организации
- **Организации-заказчики** — с типами, регионами, контактами
- **История взаимодействий** — хронология контактов с организациями

### Кампании
- **Конструктор кампаний** — 6-шаговый wizard:
  1. Основные параметры (название, ФО, гипотеза, прогноз, дедлайн)
  2. Выбор программ (фильтрация по договорам, востребованности)
  3. Выбор регионов (фильтрация по востребованности, распределение по очередям)
  4. Выбор заказчиков (фильтрация по типу, региону, истории взаимодействий)
  5. Назначение менеджеров (по программам, регионам, организациям)
  6. Обзор и создание
- **Список кампаний** — таблица со статусами, фильтрами, пагинацией
- **Детали кампании** — карточка с вкладками (программы, регионы, заказчики)

### Матрица востребованности
- Визуализация матрицы профессий x регионов
- **Фильтрация:**
  - По профессиям (множественный выбор)
  - По регионам/округам (иерархический Cascader)
  - По годам (2024, 2025, 2026)
  - **По статусам одобрения Минтруда** (множественный выбор) — фильтрует как профессии (строки), так и регионы (столбцы)
- Переключатель "только с востребованностью"
- **Статусы одобрения Минтруда** — цветная окантовка ячеек (с отступом от квадрата):
  - **Синяя** (in_progress) — в проработке
  - **Зелёная штрихованная** (preliminary_approved) — предварительное одобрение
  - **Сплошная зелёная с тенью** (approved) — одобрено по факту потока
  - **Красная** (rejected) — отказано
  - **Оранжевая** (unlikely) — маловероятно
  - Статусы могут быть как у востребованных, так и у невостребованных профессий
  - Цвета гармонизированы с палитрой Ant Design
- Переключение видов: «Профессии × Регионы» и «Регионы × Профессии»

## API-эндпоинты

### Аутентификация
| Метод | URL | Описание |
|-------|-----|----------|
| POST  | `/api/auth/login/` | JWT-авторизация |
| POST  | `/api/auth/refresh/` | Обновление токена |
| GET   | `/api/auth/me/` | Текущий пользователь |
| GET   | `/api/auth/users/` | Список пользователей |

### Справочники
| Метод | URL | Описание |
|-------|-----|----------|
| GET   | `/api/federal-districts/` | Федеральные округа |
| GET   | `/api/regions/` | Регионы (фильтр по округу) |
| GET   | `/api/professions/` | Профессии |
| GET   | `/api/professions/{id}/demand-map/` | Востребованность по регионам |
| GET   | `/api/programs/` | Программы (фильтр по профессии, договору) |
| GET   | `/api/federal-operators/` | Федеральные операторы |
| GET   | `/api/contracts/` | Договоры |
| GET   | `/api/quotas/` | Квоты |
| GET   | `/api/demand-matrix/` | Матрица востребованности |

### Организации
| Метод | URL | Описание |
|-------|-----|----------|
| GET/POST | `/api/organizations/` | Организации (CRUD, фильтры) |
| GET/POST | `/api/organization-interactions/` | Взаимодействия |

### Кампании
| Метод | URL | Описание |
|-------|-----|----------|
| GET/POST | `/api/campaigns/` | Список / создание |
| GET/PATCH | `/api/campaigns/{id}/` | Детали / обновление |
| POST  | `/api/campaigns/{id}/programs/` | Добавить программы |
| POST  | `/api/campaigns/{id}/regions/` | Добавить регионы |
| POST  | `/api/campaigns/{id}/organizations/` | Добавить заказчиков |
| POST  | `/api/campaigns/{id}/assign-managers/` | Назначить менеджеров |

## Роли пользователей

- **admin** — полный доступ ко всем функциям
- **manager** — работа с кампаниями и организациями
