# Retail Pricing Manager

A full-stack application for uploading, analysing, modifying, and downloading retail store pricing data.

- **Frontend:** Angular 21 + Bootstrap 5
- **Backend:** FastAPI + SQLAlchemy
- **Database:** PostgreSQL

---

## Prerequisites

| Tool       | Version  |
|------------|----------|
| Node.js    | 18+      |
| npm        | 9+       |
| Python     | 3.10+    |
| PostgreSQL | 13+      |

---

## 1. Database Setup

Create the PostgreSQL database:

```sql
CREATE DATABASE "Learn_sample_Price_DB";
```

Then update the password in `fastapi_app/app/database.py`:

```python
DATABASE_URL = f"postgresql://postgres:{quote_plus('YOUR_PASSWORD')}@localhost:5432/Learn_sample_Price_DB"
```

Replace `YOUR_PASSWORD` with your PostgreSQL `postgres` user password.

---

## 2. Backend Setup (FastAPI)

```bash
cd fastapi_app
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The API runs at **http://localhost:8000**. Docs available at **http://localhost:8000/docs**.

---

## 3. Frontend Setup (Angular)

```bash
cd sample_angular_learn
npm install
ng serve --proxy-config proxy.conf.json
```

The app runs at **http://localhost:4200**.

> The proxy config forwards `/api` requests to the FastAPI backend on port 8000.

---

## Project Structure

```
fastapi_app/
  app/
    main.py                 # FastAPI entry point
    pricing_endpoints.py    # Upload, modify, download endpoints
    models.py               # SQLAlchemy + Pydantic models
    database.py             # DB connection config
  requirements.txt

sample_angular_learn/
  src/app/
    landing/                # Home page
    file-upload/            # Upload, edit, save, download component
    app.routes.ts           # Angular routing
  proxy.conf.json           # Dev proxy to backend
```

---

## API Endpoints

| Method | Endpoint                  | Description                          |
|--------|---------------------------|--------------------------------------|
| POST   | `/api/uploadPricingFile`  | Truncates table and uploads CSV data |
| PUT    | `/api/modifyPricingData`  | Updates modified rows in DB          |
| GET    | `/api/downloadPricingData`| Downloads all DB data as CSV         |
