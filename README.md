# Monte Carlo Simulator

A high-performance, interactive Monte Carlo simulation dashboard for financial forecasting, asset trajectory modeling, and risk quantification. Built with React 19, TypeScript, Recharts, and enhanced with Google Gemini AI intelligence for automated financial strategy insights.

---

## Overview

The **Monte Carlo Simulator** enables investors, quantitative analysts, and financial planners to forecast wealth accumulation and portfolio volatility across thousands of stochastic trajectories. Using **Geometric Brownian Motion (GBM)** with optional **mean-reverting drift**, the application simulates potential market outcomes, computes exact confidence bands, and provides quantitative risk probabilities.

---

## Features

### 1. Stochastic Simulation Engine
- **Geometric Brownian Motion (GBM)**: Simulates continuous-time asset price diffusion incorporating drift ($\mu$) and stochastic volatility ($\sigma$).
- **Mean Reversion Drift**: Optional Ornstein-Uhlenbeck-style pull toward the fundamental expected path to model market corrections and long-term valuation anchors.
- **Box-Muller Normal Sampling**: Fast, client-side pseudo-random normal variate generation.
- **Configurable Parameters**:
  - Initial Investment ($S_0$)
  - Expected Annual Return ($\mu$)
  - Annual Volatility ($\sigma$)
  - Time Horizon (1 to 30 years)
  - Simulation Iterations (up to 5,000 runs)
  - Mean Reversion Speed ($\kappa$)

### 2. Interactive Visual Analytics
- **Multi-Trajectory Path Chart**:
  - Simultaneous rendering of individual sample trajectories.
  - **90% and 95% Confidence Intervals**: Shaded percentile cones visualizing the distribution bounds over time.
  - **Confidence Band Toggle**: Show or hide confidence bands on demand.
  - **Path Selection**: Click or hover individual trajectories to inspect their exact progression.
  - **Dynamic Scaling Smart Tooltip**: Filters out excessive path series to present an uncluttered summary containing key percentiles, active paths, and exact currency amounts.
- **Distribution Histogram**:
  - Binned final wealth distribution across all simulation iterations.
  - Visual reference lines for median, mean, 5th percentile, and 95th percentile outcomes.
- **Deterministic Scenario Comparison**:
  - Comparative bar chart contrasting projected values across scenarios (Worst Case, Most Likely, Best Case).
  - Hover tooltips displaying exact final dollar values and scenario names.

### 3. Scenario Analysis & Stress Testing
- **One-Click Presets**:
  - *Conservative* (4% return, 8% volatility, mean-reverting)
  - *Most Likely* (8% return, 18% volatility)
  - *Best Case* (14% return, 15% volatility)
  - *Aggressive* (14% return, 35% volatility)
  - *Worst Case* (4% return, 25% volatility)
- **Market Stress Testing**:
  - *Black Swan Event*: Simulates catastrophic market drops (-20% return, 50% volatility).
  - *Golden Decade*: Simulates prolonged low-volatility secular bull markets (+15% return, 12% volatility).
  - **Individual Toggle States**: Seamlessly toggle any scenario on or off to revert back to baseline configurations.

### 4. Quantitative Risk & Probability Metrics
- **Median & Average Final Portfolio Value**
- **5th Percentile (Value at Risk / VaR proxy)** & **95th Percentile (Upside Potential)**
- **Probability of Loss**: Percentage of paths finishing below initial capital.
- **Probability of 50% Gain** & **Probability of Doubling Investment**
- **Visual Progress Trackers**: Color-coded probability gauges with smooth entry animations.

### 5. Gemini AI Financial Insights
- Integrated **Gemini 3 Flash** intelligence to analyze simulation outputs on demand.
- Delivers concise, professional commentary evaluating portfolio risk-return trade-offs, tail risk vulnerabilities, and long-term stability implications.

---

## Technical Stack

- **Framework**: React 19, TypeScript
- **Bundler & Dev Server**: Vite 6
- **Styling**: Tailwind CSS, Shadcn UI patterns
- **Data Visualization**: Recharts (ComposedChart, AreaChart, BarChart, LineChart)
- **Animation**: Motion (`motion/react`)
- **Icons**: Lucide React
- **AI Integration**: `@google/genai` (Google Gen AI TypeScript SDK)

---

## Getting Started

### Prerequisites
- Node.js (v18 or higher recommended)
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd <repository-directory>

# Install dependencies
npm install
```

### Environment Setup

Create a `.env` file or define your variables based on `.env.example`:

```env
# Required for Gemini AI strategy insights
GEMINI_API_KEY="your-gemini-api-key"
```

### Development Server

Start the local Vite development server:

```bash
npm run dev
```

The application will be accessible at `http://localhost:3000`.

### Production Build

Compile and bundle the application for production:

```bash
npm run build
```

The build artifacts will be generated in the `dist/` directory.

### Code Verification

```bash
# Type check and lint
npm run lint
```

---

## Mathematical Model

The continuous asset progression follows an augmented Stochastic Differential Equation (SDE):

$$dS_t = \mu S_t dt + \kappa (S_{target} - S_t) dt + \sigma S_t dW_t$$

Where:
- $S_t$: Asset price at time $t$
- $\mu$: Expected drift (annualized return)
- $\sigma$: Volatility of returns
- $\kappa$: Mean reversion speed constant
- $S_{target}$: Deterministic baseline asset value at time $t$
- $W_t$: Standard Brownian motion ($dW_t = \epsilon \sqrt{dt}$, with $\epsilon \sim \mathcal{N}(0, 1)$)

---

## License

Apache-2.0
