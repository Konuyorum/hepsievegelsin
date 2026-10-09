# Hepsi Eve Gelsin (HEG) 🛒✨
### AI-Powered Smart Shopping Assistant & Product Comparison Engine

[![Live Demo](https://img.shields.io/badge/Demo-Live%20Website-brightgreen?style=flat-square)](https://www.hepsievegelsin.com)
[![AI Engine](https://img.shields.io/badge/AI%20Engine-Anthropic%20Claude%203.5%20Haiku-7952b3?style=flat-square)](https://www.anthropic.com)
[![Runtime](https://img.shields.io/badge/Runtime-Cloudflare%20Pages%20Worker-f38020?style=flat-square)](https://pages.cloudflare.com)
[![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)

> **Live Production Website:** [https://www.hepsievegelsin.com](https://www.hepsievegelsin.com)

---

## 📌 Executive Summary

**Hepsi Eve Gelsin (HEG)** is an intelligent consumer shopping copilot built to eliminate e-commerce decision paralysis for Turkish consumers. Navigating millions of product listings across Amazon Turkey, Trendyol, and Hepsiburada is time-consuming and filled with sponsored noise.

HEG leverages **Anthropic's Claude 3.5 Haiku** deployed at the edge via **Cloudflare Workers** to analyze user intent in real-time, synthesize buyer reviews, perform rigorous head-to-head spec comparisons, and deliver unbiased, structured buying recommendations within milliseconds.

---

## 🚀 Key Features

* **🧠 Semantic Query Routing:** Distinguishes between broad category queries (e.g., *"Kablosuz Kulaklık"*, *"Robot Süpürge"*) and specific product lookups (e.g., *"iPhone 15"*, *"Sony WH-1000XM5"*).
* **⚖️ Head-to-Head "VS Mode":** Dynamic side-by-side product comparison engine evaluating features, pros, cons, and determining clear category winners.
* **⚡ Edge Execution with Sub-second Latency:** Powered by Cloudflare Pages Advanced Workers running within 50ms of global consumers.
* **🇹🇷 Turkish Market-Specific Knowledge:** Guarantees product availability, localized price-to-performance evaluation, and direct e-commerce affiliate routing.
* **🛡️ Type-Safe Structured Output:** Enforces strict JSON contracts for seamless, client-side dynamic UI rendering without hallucinated layout formats.

---

## 🏗️ Architecture & AI Integration

```
[ User Browser (Tailwind UI) ]
             │
             ▼
[ Cloudflare Edge CDN / Pages ]
             │
      /api/search (POST)
             │
             ▼
[ Cloudflare Pages Worker (_worker.js) ]
             │
             ├──► [ Anthropic Claude 3.5 Haiku API ]
             │     └── System Prompt: E-Commerce Product Evaluation
             │     └── Schema: Strict JSON (single, list, comparison)
             │
             └──► [ Fallback AI Engine (Optional) ]
```

### Why Anthropic Claude 3.5 Haiku?
1. **Unrivaled Speed and Latency:** Critical for consumer-facing shopping applications where users expect real-time answers.
2. **Superior JSON Schema Adherence:** Zero parsing failures or markdown wrapper leakage during high-concurrency evaluation.
3. **Advanced Linguistic Nuance in Turkish:** Accurately interprets regional colloquialisms, buyer complaints, and nuanced product strengths.
4. **Cost Efficiency at Scale:** Enables millions of shopping queries per month at fractional infrastructure cost.

---

## 🛠️ Tech Stack

- **AI Model:** Anthropic Claude 3.5 Haiku (`claude-3-5-haiku-20241022`)
- **Backend / Edge Runtime:** Cloudflare Pages Advanced Worker (`_worker.js`)
- **Frontend:** Vanilla HTML5, Modern CSS / Tailwind CSS, FontAwesome Icons
- **Hosting & DNS:** Cloudflare Pages with Global Anycast CDN & SSL
- **Language:** JavaScript (ES Modules)

---

## 💻 Local Development & Deployment

### Prerequisites
- Node.js (v18+)
- Cloudflare Wrangler CLI (`npm install -g wrangler`)
- Anthropic API Key ([Anthropic Console](https://console.anthropic.com))

### 1. Clone the repository
```bash
git clone https://github.com/Konuyorum/hepsievegelsin.git
cd hepsievegelsin
```

### 2. Configure Environment Variables
Create a `.dev.vars` file for local development:
```env
ANTHROPIC_API_KEY=your_anthropic_api_key_here
ANTHROPIC_MODEL=claude-3-5-haiku-20241022
```

### 3. Run Locally with Wrangler
```bash
npx wrangler pages dev .
```
Visit `http://localhost:8788` in your browser.

### 4. Deploy to Cloudflare Pages
```bash
npx wrangler pages deploy .
```
Set `ANTHROPIC_API_KEY` in the Cloudflare Dashboard under:
**Project Settings** ➡️ **Environment Variables** ➡️ **Production**.

---

## 📄 License

This project is open-source under the [MIT License](LICENSE).
