-- Schema DDL for AgriTech Intelligence Platform (Multi-Model MLOps Suite)

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table for Managed Farms (Admin Multi-Farm & Farmer Isolation)
CREATE TABLE IF NOT EXISTS farms (
    farm_id VARCHAR(50) PRIMARY KEY,
    admin_id INTEGER,
    farmer_id INTEGER,
    farm_name VARCHAR(255) NOT NULL,
    district VARCHAR(100) NOT NULL,
    region VARCHAR(100) DEFAULT 'Maharashtra',
    gps_latitude NUMERIC(10, 6) DEFAULT 18.5204,
    gps_longitude NUMERIC(10, 6) DEFAULT 73.8567,
    acreage NUMERIC(8, 2) DEFAULT 15.0,
    soil_type VARCHAR(50) DEFAULT 'Loamy',
    current_crop VARCHAR(50) DEFAULT 'Paddy',
    sensor_types TEXT DEFAULT '["soil_moisture_sensor", "npk_sensor", "weather_station"]',
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_farms_admin_id ON farms(admin_id);
CREATE INDEX IF NOT EXISTS idx_farms_farmer_id ON farms(farmer_id);

-- Table for Raw Agri Sensor & Telemetry Data
CREATE TABLE IF NOT EXISTS raw_telemetry (
    id SERIAL PRIMARY KEY,
    farm_id VARCHAR(50),
    field_id VARCHAR(50) NOT NULL,
    nitrogen NUMERIC(8, 2),
    phosphorus NUMERIC(8, 2),
    potassium NUMERIC(8, 2),
    temperature NUMERIC(6, 2),
    humidity NUMERIC(6, 2),
    ph NUMERIC(4, 2),
    soil_moisture NUMERIC(6, 2),
    rainfall NUMERIC(8, 2),
    soil_type VARCHAR(50),
    crop_type VARCHAR(50),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_raw_telemetry_farm_id ON raw_telemetry(farm_id);
CREATE INDEX IF NOT EXISTS idx_raw_telemetry_field_id ON raw_telemetry(field_id);
CREATE INDEX IF NOT EXISTS idx_raw_telemetry_timestamp ON raw_telemetry(timestamp);

-- Table for Feature Store Engine
CREATE TABLE IF NOT EXISTS agri_features (
    field_id VARCHAR(50) NOT NULL,
    model_type VARCHAR(50) NOT NULL, -- 'irrigation', 'crop', 'fertilizer', 'yield'
    feature_version VARCHAR(50) NOT NULL,
    features_json TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (field_id, model_type, feature_version)
);

CREATE INDEX IF NOT EXISTS idx_agri_features_field ON agri_features(field_id, model_type);

-- Table for Decision Log across All 4 Model Heads
CREATE TABLE IF NOT EXISTS decision_log (
    id SERIAL PRIMARY KEY,
    field_id VARCHAR(50) NOT NULL,
    model_type VARCHAR(50) NOT NULL, -- 'irrigation', 'crop', 'fertilizer', 'yield'
    prediction_output VARCHAR(255) NOT NULL, -- e.g. "high_risk", "rice", "Urea", "152.9 bu/acre"
    confidence_score NUMERIC(5, 4) NOT NULL,
    risk_flag BOOLEAN DEFAULT FALSE,
    top_features_json TEXT, -- SHAP / Feature contribution JSON
    model_version VARCHAR(100) NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_decision_log_field ON decision_log(field_id);
CREATE INDEX IF NOT EXISTS idx_decision_log_model ON decision_log(model_type);
CREATE INDEX IF NOT EXISTS idx_decision_log_timestamp ON decision_log(timestamp);

-- Table for Prediction Outcomes / Ground Truth Feedback Loop
CREATE TABLE IF NOT EXISTS outcomes (
    id SERIAL PRIMARY KEY,
    decision_log_id INTEGER REFERENCES decision_log(id) ON DELETE CASCADE,
    actual_outcome VARCHAR(100) NOT NULL,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for Actions & Advisories Dispatched (Email/SES alerts, automated irrigation triggers)
CREATE TABLE IF NOT EXISTS actions_taken (
    id SERIAL PRIMARY KEY,
    decision_log_id INTEGER REFERENCES decision_log(id) ON DELETE CASCADE,
    field_id VARCHAR(50) NOT NULL,
    model_type VARCHAR(50) NOT NULL,
    action_type VARCHAR(100) NOT NULL, -- e.g. "irrigation_alert", "fertilizer_advisory"
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    recipient VARCHAR(255) NOT NULL,
    details TEXT
);

-- Table for User Accounts and RBAC
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    google_id VARCHAR(255) UNIQUE,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    picture TEXT,
    role VARCHAR(50) NOT NULL DEFAULT 'farmer', -- 'admin' or 'farmer'
    is_demo BOOLEAN DEFAULT FALSE,               -- TRUE for demo/test accounts; enables periodic cleanup
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Table for Farmer Profiles & Sandboxed Sensor Specs
CREATE TABLE IF NOT EXISTS farmer_profiles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    farm_name VARCHAR(255) DEFAULT 'Green Valley Farm',
    gps_latitude NUMERIC(10, 6) DEFAULT 18.5204,
    gps_longitude NUMERIC(10, 6) DEFAULT 73.8567,
    region VARCHAR(100) DEFAULT 'Maharashtra',
    current_crops TEXT DEFAULT 'Paddy, Cotton',
    sensors_config TEXT DEFAULT '{"soil_moisture_sensor": true, "npk_sensor": true, "weather_station": true}',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for MLOps Model Registry Persistence
CREATE TABLE IF NOT EXISTS model_registry (
    id SERIAL PRIMARY KEY,
    model_key VARCHAR(50) NOT NULL UNIQUE, -- 'irrigation', 'crop', 'fertilizer', 'yield'
    model_name VARCHAR(100) NOT NULL,
    algorithm VARCHAR(100) NOT NULL,
    version VARCHAR(50) NOT NULL,
    stage VARCHAR(50) NOT NULL DEFAULT 'Production', -- 'Production', 'Staging', 'Archived'
    accuracy_score NUMERIC(5, 4),
    f1_score NUMERIC(5, 4),
    rmse_score NUMERIC(8, 4),
    artifact_uri VARCHAR(255),
    parameters_json TEXT,
    metrics_json TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE INDEX IF NOT EXISTS idx_model_registry_key ON model_registry(model_key);
CREATE INDEX IF NOT EXISTS idx_model_registry_stage ON model_registry(stage);

-- Table for Live Drift Metrics & Detection History
CREATE TABLE IF NOT EXISTS drift_metrics_log (
    id SERIAL PRIMARY KEY,
    drift_type VARCHAR(50) NOT NULL, -- 'data_drift', 'model_drift', 'combined'
    model_key VARCHAR(50) NOT NULL, -- 'all', 'irrigation', 'crop', 'fertilizer', 'yield'
    drift_detected BOOLEAN DEFAULT FALSE,
    psi_score NUMERIC(6, 4) DEFAULT 0.0,
    drifted_features_count INTEGER DEFAULT 0,
    details_json TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_drift_metrics_model ON drift_metrics_log(model_key);
CREATE INDEX IF NOT EXISTS idx_drift_metrics_timestamp ON drift_metrics_log(timestamp);
