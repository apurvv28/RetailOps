# Real (Non-Synthetic) Dataset Sources — AgriTech MLOps Suite

Verified directly from AIKosh, UCI, and HuggingFace. Kaggle avoided per your ask — flagged below where a "real-looking" non-Kaggle dataset turned out to actually be synthetic/templated on inspection.

---

## 1. Irrigation Risk Model (soil moisture depletion)

### ✅ Primary: AIKosh — Maharashtra 2018 Soil Moisture (district-level)
- **Link:** https://aikosh.indiaai.gov.in/home/datasets/details/maharashtra_2018_soil_moisture.html
- **What it is:** Real, government-sourced. District-level **daily volumetric soil moisture** (at 15cm depth) for Maharashtra, 2018, derived from the **VIC hydrological model run by NRSC** (National Remote Sensing Centre, ISRO).
- **Why it fits:** You're based in Pune, Maharashtra — this gives you a genuine regional dataset, not a generic global one. Good talking point in interviews ("used real ISRO/NRSC hydrology model output, not a Kaggle CSV").
- **Also available:** Same catalog has every other state (Punjab, Karnataka, MP, Chhattisgarh, Andhra Pradesh, Tamil Nadu, Arunachal Pradesh, etc.) — see the master catalog below if you want a multi-state training set.

### ✅ Master catalog: AIKosh — Daily Data of Soil Moisture
- **Link:** https://aikosh.indiaai.gov.in/home/datasets/details/daily_data_of_soil_moisture.html
- Volumetric soil moisture for **all States/UTs and districts of India, 2018 onwards**, same VIC-model source. Lets you pick a custom Area of Interest + time period. This is the most direct real replacement for the UCI SMAP dataset you were using.

### Supplementary (real, global): NASA/global soil moisture
- **GSSM1km (Nature Scientific Data)** — physics-informed ML global 1km daily surface soil moisture, real satellite-derived, useful if you want a non-Indian benchmark: https://www.nature.com/articles/s41597-023-02011-7 (data linked from the paper, not a simple CSV download — heavier lift).

---

## 2. Crop Recommendation Model

### ✅ Primary: AIKosh — District Crop Area, Production & Yield Dataset
- **Link:** https://aikosh.indiaai.gov.in/home/datasets/details/district_crop_area_production_yield_dataset.html
- **What it is:** Real Ministry of Agriculture & Farmers Welfare (MoA&FW) data — **district-wise crop area, production, and yield** across India.
- **How to use it for recommendation (not just yield):** For each district, the crop with the highest normalized yield/area share becomes your "recommended crop" ground truth — a genuine label derived from real agricultural outcomes rather than a synthetic NPK→crop lookup table. Combine with district-level soil moisture (dataset #1) and IMD rainfall data for the feature set (N/P/K can be layered in from Soil Health Card aggregates — see note below).

### ⚠️ Important honesty check on the usual Kaggle crop-recommendation dataset
I found a paper that explicitly states the popular Kaggle "Crop Recommendation" dataset (2200 rows, 22 crops) **was developed by combining augmented data on rainfall, climate, and fertilizers** — i.e., it's not raw field observations, it's a synthetic/stitched-together compilation. Good to know this even if you'd used it earlier — it explains why it's suspiciously clean and perfectly balanced (exactly 100 rows/crop).

### Supporting real source: Soil Health Card (SHC) national data
- **Portal:** https://soilhealth.dac.gov.in
- Real: ~20 crore soil test cards issued since 2015, geo-tagged, N/P/K + pH per field/village. This is the closest thing India has to ground-truth soil nutrient data at scale.
- **Caveat:** Not distributed as a clean bulk CSV — it's portal/GIS-based, so pulling it needs either their public dashboard exports or an API/RTI request. Worth doing if you want a genuinely irreproachable "real data" story for your report, but budget extra time for this one.

---

## 3. Fertilizer Recommendation Model

This was the hardest to find as truly non-synthetic, and I want to flag that honestly rather than hand you something that only *looks* real.

### ⚠️ Checked: HuggingFace `kaifahmad/Fertilizer-Prediction`
- Link: https://huggingface.co/datasets/kaifahmad/Fertilizer-Prediction
- I opened the actual data viewer — it's the same 99-row dataset as Kaggle's `gdabhishek/fertilizer-prediction`, just re-hosted. On inspection, the temperature/humidity values repeat in fixed pairs (26/52, 29/58, 30/60...) across rows and the crop→fertilizer mapping looks rule-generated, not measured. **This is templated/synthetic data wearing a HuggingFace URL — not something I'd present as real in a report.**

### ✅ Best real option: AIKosh — Production, Imports and Consumption of Fertilizers
- **Link:** https://aikosh.indiaai.gov.in/home/datasets/details/production_imports_and_consumption_of_fertilizers.html
- Real Government of India data (Dept. of Fertilizers): actual **N/P/K fertilizer production, imports, and consumption** figures, by fertilizer type and year.
- **Limitation:** This is aggregate (national/state/year level), not row-level "given this field's soil, recommend this fertilizer." It's real, but it's the wrong grain for a per-instance classifier.

### Recommended approach for this model (given the data gap)
Since no clean real per-field fertilizer-recommendation dataset exists in the public domain (SHC individual records aren't bulk-downloadable, and every "clean" alternative I found is synthetic), the honest options are:
1. **Rule-based ground truth layer:** Use real ICAR / State Agricultural University "Package of Practices" NPK dosage tables (published, crop-wise, freely available as PDFs from state agri-university extension sites) as your label source, applied to real Soil Health Card district-average N/P/K values. This is expert-system-derived, not synthetic — a legitimate and common approach in published agri-ML papers.
2. **Reframe scope honestly in your report:** state that fertilizer recommendation is trained on domain-expert dosage rules validated against real regional soil-nutrient averages (SHC), rather than claiming a "found" real per-field dataset — this is actually a *stronger* portfolio story than an unlabeled black-box dataset, since it shows you understood the data-quality problem and solved it deliberately.

---

## 4. Yield Prediction (stretch model)

### ✅ Strong real option: HuggingFace — CropNet
- **Link:** https://huggingface.co/datasets/CropNet/CropNet
- **What it is:** Genuinely real, large-scale, deep-learning-ready. Combines **Sentinel-2 satellite imagery + WRF-HRRR weather model output + USDA crop yield records**, aligned spatially and temporally across **2,200+ US counties, 2017–2022**.
- Best-documented, most rigorous dataset of the four — if you want one dataset to point to as "unambiguously real," this is it.

### ✅ India-specific alternative: same AIKosh District Crop Area/Production/Yield Dataset (see §2)
- Reuse it here directly as the regression target (yield = production/area) — keeps your whole suite India-focused and internally consistent if that matters more to you than CropNet's US scope.

---

## Summary Table

| Model | Dataset | Source | Real? |
|---|---|---|---|
| Irrigation Risk | Maharashtra/All-India Soil Moisture (VIC model, NRSC) | AIKosh | ✅ Real (satellite/hydro-model) |
| Crop Recommendation | District Crop Area, Production & Yield | AIKosh | ✅ Real (govt agri statistics) |
| Crop Recommendation (features) | Soil Health Card N/P/K | soilhealth.dac.gov.in | ✅ Real, harder to bulk-access |
| Fertilizer Recommendation | Production/Import/Consumption of Fertilizers | AIKosh | ✅ Real, but aggregate-grain only |
| Fertilizer Recommendation (labels) | ICAR/SAU Package of Practices dosage tables | State agri university sites | ✅ Real (expert system, not ML-derived) |
| Yield Prediction (stretch) | CropNet (Sentinel-2 + WRF-HRRR + USDA) | HuggingFace | ✅ Real, most rigorous of all four |