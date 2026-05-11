# Multimodal Axial Length Prediction System

Static GitHub Pages demonstration for a deidentified multimodal forecasting system for postoperative axial length trajectories in congenital ectopia lentis.

## Purpose

This repository contains a browser-based scientific demo aligned with the manuscript, "Multimodal prediction of postoperative axial growth trajectories in congenital ectopia lentis." The page is designed to present the model concept, multimodal inputs, trajectory forecasts and case-level interpretability in a compact publication-style interface.

It is a demonstration package only. It is not a clinical device and should not be used for real patient decisions.

## Manuscript Context

Postoperative axial length (AL) elongation is a major driver of refractive change and long-term visual outcomes in children with congenital ectopia lentis. Individualized AL growth prediction is difficult because real-world follow-up is sparse, irregularly sampled and clinically heterogeneous.

The manuscript describes a multimodal multi-horizon forecasting framework with the following core elements:

- Cohort scale: 437 participants and 874 eyes.
- Prediction target: individualized postoperative AL trajectories across 0.5 to 5.0 years.
- Modalities: structured biometric variables, clinical narrative embeddings and ophthalmic image embeddings.
- Modeling strategy: observation-level multi-horizon regression, curve-informed temporal modeling and stage-wise fusion of gradient boosting and multimodal deep learning branches.
- Reported internal performance: MSE 1.035, MAE 0.589 mm and MAPE 2.35%.
- Prospective validation display: R2 0.859 with close agreement between observed and predicted AL values.

## Static Web Demo

The GitHub Pages interface in `docs/` demonstrates the manuscript method without requiring a backend server.

The page includes:

- A compact prediction-system layout with anonymized case identifiers.
- Structured inputs for baseline AL, age and forecast horizon.
- Deidentified ophthalmic image panels using clean base images without hand-drawn marker strokes.
- Browser-generated attention heatmap and overlay views.
- A fused postoperative AL trajectory chart comparing structured, multimodal and curve-informed branches.
- Modality and token contribution panels that summarize how structured biometry, clinical text and image features contribute to the forecast.
- A manuscript-aligned summary panel for cohort scale, horizon range, temporal validation and model fusion.
- A static institutional logo asset in the page header.

Demo values and visualizations are manuscript-aligned for communication of the method. They are intentionally deidentified and should be interpreted as an interface demonstration rather than source clinical records.

## Repository Structure

```text
.
├── README.md
├── docs/
│   ├── .nojekyll
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   └── assets/
│       ├── logo.jpg
│       └── demo_assets/
│           ├── case-a-base.jpg
│           ├── case-b-base.jpg
│           └── case-c-base.jpg
└── .gitignore
```

This repository intentionally excludes source clinical tables, raw patient folders, model training artifacts, Python services, API keys and private research workspace files.

## Run Locally

Any static file server can be used:

```bash
python3 -m http.server 8000 --directory docs
```

Then open:

```text
http://127.0.0.1:8000
```

## GitHub Pages

Use the following repository settings:

- Source: `Deploy from a branch`
- Branch: `main`
- Folder: `/docs`

Expected project-site URL after deployment:

```text
https://liuyan990312-ship-it.github.io/multimodal-axial-length/
```

If the repository remains private, GitHub Pages availability and access control depend on the GitHub account or organization plan.

## Privacy And Release Scope

The demo is designed for scientific presentation and method communication. Before publishing updates, check that the repository does not contain:

- Patient names or identifiable clinical notes.
- Source clinical spreadsheets or raw research folders.
- Local filesystem paths.
- Personal email addresses or private contact details.
- API keys, access tokens, SSH keys or service credentials.
- Full training pipelines or unreleased model artifacts.

## Update Checklist

Before each public or collaborator-facing update:

- Replace image assets only with deidentified clean originals.
- Verify that heatmap overlays are generated without hand-drawn clinical marker strokes.
- Confirm that `docs/index.html`, `docs/styles.css` and `docs/app.js` run without a backend.
- Run a local static preview and inspect desktop and mobile layouts.
- Scan the repository for private paths, emails, secrets and raw data filenames.
