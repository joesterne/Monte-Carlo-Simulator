/**
 * Monte Carlo Simulation Logic
 */

export interface SimulationParams {
  initialValue: number;
  mean: number; // Expected annual return
  volatility: number; // Annual volatility
  timeHorizon: number; // Years
  stepsPerYear: number;
  iterations: number;
  meanReversionSpeed: number; // Speed of reversion to the mean path
}

export interface SimulationResult {
  paths: number[][]; // [iteration][step]
  finalValues: number[];
  timePoints: number[];
  percentiles: {
    p2_5: number[];
    p5: number[];
    p50: number[];
    p95: number[];
    p97_5: number[];
  };
}

/**
 * Generates a random number from a normal distribution using Box-Muller transform
 */
export function randomNormal(mean: number = 0, stdDev: number = 1): number {
  const u1 = Math.random();
  const u2 = Math.random();
  
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return z0 * stdDev + mean;
}

/**
 * Geometric Brownian Motion Simulation with optional Mean Reversion
 * dS = mu * S * dt + kappa * (S_target - S) * dt + sigma * S * dW
 */
export function runMonteCarlo(params: SimulationParams): SimulationResult {
  const { initialValue, mean, volatility, timeHorizon, stepsPerYear, iterations, meanReversionSpeed } = params;
  
  const dt = 1 / stepsPerYear;
  const totalSteps = Math.floor(timeHorizon * stepsPerYear);
  const paths: number[][] = [];
  const finalValues: number[] = [];
  const timePoints: number[] = Array.from({ length: totalSteps + 1 }, (_, i) => i * dt);

  // Store all values at each step to calculate percentiles
  const allValuesAtStep: number[][] = Array.from({ length: totalSteps + 1 }, () => []);

  // Limit iterations for performance in the browser
  const safeIterations = Math.min(iterations, 5000);
  // Limit paths to display to avoid crashing Recharts
  const displayPathsCount = Math.min(safeIterations, 50);

  for (let i = 0; i < safeIterations; i++) {
    const path: number[] = [initialValue];
    allValuesAtStep[0].push(initialValue);
    let currentValue = initialValue;

    for (let t = 1; t <= totalSteps; t++) {
      const currentTime = t * dt;
      
      // Standard GBM drift
      const gbmDrift = (mean - 0.5 * Math.pow(volatility, 2)) * dt;
      
      // Mean reversion component
      // We revert the log-price towards the expected log-price path: ln(S0) + (mu - 0.5*sigma^2)*t
      const expectedLogPrice = Math.log(initialValue) + (mean - 0.5 * Math.pow(volatility, 2)) * currentTime;
      const currentLogPrice = Math.log(currentValue);
      const reversionDrift = meanReversionSpeed * (expectedLogPrice - currentLogPrice) * dt;
      
      const diffusion = volatility * Math.sqrt(dt) * randomNormal(0, 1);
      
      currentValue = currentValue * Math.exp(gbmDrift + reversionDrift + diffusion);
      path.push(currentValue);
      allValuesAtStep[t].push(currentValue);
    }

    if (i < displayPathsCount) {
      paths.push(path);
    }
    finalValues.push(currentValue);
  }

  // Calculate percentiles for each step
  const percentiles = {
    p2_5: [] as number[],
    p5: [] as number[],
    p50: [] as number[],
    p95: [] as number[],
    p97_5: [] as number[],
  };

  for (let t = 0; t <= totalSteps; t++) {
    const sorted = allValuesAtStep[t].sort((a, b) => a - b);
    percentiles.p2_5.push(sorted[Math.floor(sorted.length * 0.025)]);
    percentiles.p5.push(sorted[Math.floor(sorted.length * 0.05)]);
    percentiles.p50.push(sorted[Math.floor(sorted.length * 0.50)]);
    percentiles.p95.push(sorted[Math.floor(sorted.length * 0.95)]);
    percentiles.p97_5.push(sorted[Math.floor(sorted.length * 0.975)]);
  }

  return {
    paths,
    finalValues,
    timePoints,
    percentiles,
  };
}

export function calculateStatistics(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const median = sorted[Math.floor(sorted.length / 2)];
  const p5 = sorted[Math.floor(sorted.length * 0.05)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const min = sorted[0];
  const max = sorted[sorted.length - 1];

  return {
    mean,
    median,
    p5,
    p95,
    min,
    max,
    count: values.length
  };
}
