import React, { useState, useMemo, useEffect } from 'react';
import { 
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, BarChart, Bar, Cell, LabelList, ReferenceLine
} from 'recharts';
import { 
  Play, 
  Settings2, 
  TrendingUp, 
  BarChart3, 
  Info, 
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  ShieldCheck,
  Zap,
  AlertTriangle,
  Layers,
  Sparkles,
  TrendingDown,
  Calculator,
  MousePointer2,
  X,
  BrainCircuit,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

import { runMonteCarlo, calculateStatistics, SimulationParams, SimulationResult } from '@/src/lib/simulation';

const DEFAULT_PARAMS: SimulationParams = {
  initialValue: 10000,
  mean: 0.08,
  volatility: 0.20,
  timeHorizon: 10,
  stepsPerYear: 12,
  iterations: 1000,
  meanReversionSpeed: 0
};

export default function MonteCarloDashboard() {
  const [params, setParams] = useState<SimulationParams>(DEFAULT_PARAMS);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [selectedPathIndex, setSelectedPathIndex] = useState<number | null>(null);
  const [hoveredPathIndex, setHoveredPathIndex] = useState<number | null>(null);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isGeneratingInsight, setIsGeneratingInsight] = useState(false);
  const [showConfidenceBands, setShowConfidenceBands] = useState(true);
  const [simulationHistory, setSimulationHistory] = useState<Array<{
    timestamp: string;
    initialValue: number;
    mean: number;
    volatility: number;
    medianFinal: number;
  }>>([]);

  const stats = useMemo(() => {
    if (!result) return null;
    return calculateStatistics(result.finalValues);
  }, [result]);

  const runSimulation = () => {
    setIsSimulating(true);
    setSelectedPathIndex(null);
    setAiInsight(null);
    // Use setTimeout to allow UI to update before heavy calculation
    setTimeout(() => {
      const res = runMonteCarlo(params);
      setResult(res);
      const runStats = calculateStatistics(res.finalValues);
      setSimulationHistory((prev) => [
        {
          timestamp: new Date().toLocaleTimeString(),
          initialValue: params.initialValue,
          mean: params.mean,
          volatility: params.volatility,
          medianFinal: runStats.median,
        },
        ...prev,
      ].slice(0, 8));
      setIsSimulating(false);
    }, 100);
  };

  const toggleScenario = (mean: number, volatility: number, meanReversionSpeed: number = 0) => {
    const isCurrent = 
      Math.abs(params.mean - mean) < 0.001 && 
      Math.abs(params.volatility - volatility) < 0.001 &&
      Math.abs(params.meanReversionSpeed - meanReversionSpeed) < 0.001;
      
    if (isCurrent) {
      setParams({ 
        ...params, 
        mean: DEFAULT_PARAMS.mean, 
        volatility: DEFAULT_PARAMS.volatility, 
        meanReversionSpeed: DEFAULT_PARAMS.meanReversionSpeed 
      });
    } else {
      setParams({ 
        ...params, 
        mean, 
        volatility, 
        meanReversionSpeed 
      });
    }
  };

  const generateAiInsight = async () => {
    if (!result || !stats) return;
    
    setIsGeneratingInsight(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `
        Analyze these Monte Carlo simulation results for an investment:
        - Initial Investment: ${formatCurrency(params.initialValue)}
        - Time Horizon: ${params.timeHorizon} years
        - Expected Annual Return: ${formatPercent(params.mean)}
        - Annual Volatility: ${formatPercent(params.volatility)}
        - Mean Reversion Strength: ${params.meanReversionSpeed}
        
        Simulation Results:
        - Median Final Value: ${formatCurrency(stats.median)}
        - Average Final Value: ${formatCurrency(stats.average)}
        - 5th Percentile (Worst 5%): ${formatCurrency(stats.p5)}
        - 95th Percentile (Best 5%): ${formatCurrency(stats.p95)}
        - Probability of Loss: ${formatPercent(stats.probLoss)}
        - Probability of 50% Gain: ${formatPercent(stats.probGain50)}
        
        Provide a concise, professional financial insight (3-4 sentences) about the risk-reward profile of this strategy. 
        Focus on the "cone of uncertainty" and what the mean reversion implies for the long-term stability.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      setAiInsight(response.text || "Unable to generate insight at this time.");
    } catch (error) {
      console.error("Gemini Error:", error);
      setAiInsight("Error generating AI insights. Please check your configuration.");
    } finally {
      setIsGeneratingInsight(false);
    }
  };

  useEffect(() => {
    runSimulation();
  }, []);

  const chartData = useMemo(() => {
    if (!result) return [];
    return result.timePoints.map((t, stepIndex) => {
      const dataPoint: any = { 
        time: t.toFixed(2),
        p2_5: result.percentiles.p2_5[stepIndex],
        p5: result.percentiles.p5[stepIndex],
        p50: result.percentiles.p50[stepIndex],
        p95: result.percentiles.p95[stepIndex],
        p97_5: result.percentiles.p97_5[stepIndex],
      };
      result.paths.forEach((path, pathIndex) => {
        dataPoint[`path_${pathIndex}`] = path[stepIndex];
      });
      return dataPoint;
    });
  }, [result]);

  const histogramData = useMemo(() => {
    if (!result) return [];
    const values = result.finalValues;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const binCount = 30;
    const binWidth = (max - min) / binCount;
    
    const bins = Array.from({ length: binCount }, (_, i) => ({
      bin: min + i * binWidth,
      count: 0,
      label: `$${(min + i * binWidth).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
    }));

    values.forEach(v => {
      const binIndex = Math.min(Math.floor((v - min) / binWidth), binCount - 1);
      bins[binIndex].count++;
    });

    return bins;
  }, [result]);

  const selectedPathStats = useMemo(() => {
    if (selectedPathIndex === null || !result || !result.paths[selectedPathIndex]) return null;
    const path = result.paths[selectedPathIndex];
    const finalValue = path[path.length - 1];
    const initialValue = path[0];
    const totalReturn = (finalValue / initialValue - 1);
    const peak = Math.max(...path);
    const trough = Math.min(...path);
    
    return {
      finalValue,
      totalReturn,
      peak,
      trough,
      index: selectedPathIndex
    };
  }, [selectedPathIndex, result]);

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

  const formatPercent = (val: number) => 
    new Intl.NumberFormat('en-US', { style: 'percent', minimumFractionDigits: 1 }).format(val);

  const comparisonData = useMemo(() => {
    const scenarios = [
      { name: 'Worst Case', mean: 0.04, color: '#EF4444' }, // red-500
      { name: 'Most Likely', mean: 0.08, color: '#3B82F6' }, // blue-500
      { name: 'Best Case', mean: 0.14, color: '#F59E0B' }, // amber-500
    ];

    return scenarios.map(s => ({
      name: s.name,
      value: params.initialValue * Math.exp(s.mean * params.timeHorizon),
      color: s.color
    }));
  }, [params.initialValue, params.timeHorizon]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      // Filter payload to show only relevant items:
      // 1. Percentiles (if bands are shown)
      // 2. The hovered path
      // 3. The selected path
      // 4. If nothing is hovered/selected, show the first path (Sample Path)
      
      const filteredPayload = payload.filter((item: any) => {
        const name = item.name;
        
        // Always show percentiles if bands are enabled
        if (showConfidenceBands && ['p97_5', 'p95', 'p5', 'p2_5'].includes(name)) return true;
        
        // Handle paths
        if (name.startsWith('path_')) {
          const index = parseInt(name.split('_')[1]);
          
          // Show if hovered or selected
          if (index === hoveredPathIndex || index === selectedPathIndex) return true;
          
          // If nothing is active, show the first path as "Sample Path"
          if (hoveredPathIndex === null && selectedPathIndex === null && index === 0) return true;
        }
        
        return false;
      });

      if (filteredPayload.length === 0) return null;

      // Sort: Percentiles first (top to bottom), then paths
      const sortedPayload = [...filteredPayload].sort((a, b) => {
        const order = ['p97_5', 'p95', 'p5', 'p2_5'];
        const aIdx = order.indexOf(a.name);
        const bIdx = order.indexOf(b.name);
        
        if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
        if (aIdx !== -1) return -1;
        if (bIdx !== -1) return 1;
        return 0;
      });

      return (
        <div className="bg-white/95 backdrop-blur-sm p-4 border border-gray-100 shadow-2xl rounded-2xl min-w-[200px]">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-50">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Timeline</span>
            <span className="text-xs font-mono font-bold text-blue-600">Year {label}</span>
          </div>
          <div className="space-y-2">
            {sortedPayload.map((item: any, index: number) => {
              let displayName = item.name;
              let color = item.color || item.stroke;
              let isPath = false;

              if (item.name === 'p97_5') displayName = '97.5th Percentile';
              else if (item.name === 'p95') displayName = '95th Percentile';
              else if (item.name === 'p5') displayName = '5th Percentile';
              else if (item.name === 'p2_5') displayName = '2.5th Percentile';
              else if (item.name.startsWith('path_')) {
                const pIdx = parseInt(item.name.split('_')[1]);
                displayName = pIdx === 0 && selectedPathIndex === null ? 'Sample Path' : `Path #${pIdx + 1}`;
                isPath = true;
              }

              return (
                <div key={index} className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                    <span className={`text-[11px] ${isPath ? 'font-bold text-blue-700' : 'font-medium text-gray-500'}`}>
                      {displayName}
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold text-gray-900">
                    {formatCurrency(item.value)}
                  </span>
                </div>
              );
            })}
          </div>
          {(hoveredPathIndex !== null || selectedPathIndex !== null) && (
            <div className="mt-3 pt-2 border-t border-gray-50 flex items-center gap-1.5">
              <MousePointer2 className="h-3 w-3 text-blue-400" />
              <span className="text-[9px] font-bold text-blue-400 uppercase tracking-tighter">Active Analysis</span>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_20%,#1f4d3f_0%,#0b1f1f_35%,#070b12_100%)] text-[#E8ECF1] font-sans p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="bg-amber-200/10 text-amber-300 border-amber-400/40 font-mono text-[10px] tracking-wider uppercase shadow-[0_0_14px_rgba(251,191,36,0.25)]">
                Monte Carlo Royale
              </Badge>
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-amber-100 drop-shadow-[0_2px_12px_rgba(251,191,36,0.25)]">Monte Carlo High Roller Suite</h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-emerald-100/80 max-w-2xl">
                Simulate thousands of potential outcomes for asset growth using Geometric Brownian Motion. 
              </p>
              <Badge variant="secondary" className="bg-emerald-400/10 text-emerald-200 border-emerald-300/30 flex items-center gap-1 py-0 px-2 h-5">
                <Sparkles className="h-3 w-3" />
                <span className="text-[10px] font-bold uppercase tracking-tighter">AI Enhanced</span>
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <AnimatePresence>
              {isSimulating && (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="flex items-center gap-2 text-blue-600"
                >
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-xs font-medium animate-pulse">Calculating paths...</span>
                </motion.div>
              )}
            </AnimatePresence>
            <Button 
              onClick={runSimulation} 
              disabled={isSimulating}
              className="bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-black font-semibold px-8 h-12 rounded-xl shadow-[0_8px_30px_rgba(251,191,36,0.4)] transition-all active:scale-95"
            >
              {isSimulating ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4 fill-current" />}
              Run Simulation
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Sidebar Controls */}
          <aside className="lg:col-span-3 space-y-6">
            <Card className="relative border border-amber-300/15 shadow-2xl bg-black/30 backdrop-blur-md overflow-hidden">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-white/12 via-white/5 to-transparent" />
              <CardHeader className="pb-4 border-b border-amber-200/10 bg-black/30">
                <div className="flex items-center gap-2">
                  <Settings2 className="h-4 w-4 text-gray-400" />
                  <CardTitle className="text-sm font-semibold uppercase tracking-wider text-amber-200">Parameters</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label className="text-xs font-medium text-gray-600">Initial Investment</Label>
                      <span className="text-xs font-mono text-blue-600">{formatCurrency(params.initialValue)}</span>
                    </div>
                    <Input 
                      type="number" 
                      value={params.initialValue}
                      onChange={(e) => setParams({...params, initialValue: Number(e.target.value)})}
                      className="h-9 border-gray-200 focus:ring-blue-500"
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <Label className="text-xs font-medium text-gray-600">Expected Return (Annual)</Label>
                      <span className="text-xs font-mono text-blue-600">{formatPercent(params.mean)}</span>
                    </div>
                    <Slider 
                      value={[params.mean * 100]} 
                      min={-20} max={40} step={0.5}
                      onValueChange={(v) => {
                        const val = Array.isArray(v) ? v[0] : v;
                        setParams({...params, mean: val / 100});
                      }}
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <Label className="text-xs font-medium text-gray-600">Volatility (Annual)</Label>
                      <span className="text-xs font-mono text-blue-600">{formatPercent(params.volatility)}</span>
                    </div>
                    <Slider 
                      value={[params.volatility * 100]} 
                      min={1} max={100} step={1}
                      onValueChange={(v) => {
                        const val = Array.isArray(v) ? v[0] : v;
                        setParams({...params, volatility: val / 100});
                      }}
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <Label className="text-xs font-medium text-gray-600">Time Horizon (Years)</Label>
                      <span className="text-xs font-mono text-blue-600">{params.timeHorizon}y</span>
                    </div>
                    <Slider 
                      value={[params.timeHorizon]} 
                      min={1} max={50} step={1}
                      onValueChange={(v) => {
                        const val = Array.isArray(v) ? v[0] : v;
                        setParams({...params, timeHorizon: val});
                      }}
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <Label className="text-xs font-medium text-gray-600">Mean Reversion Strength</Label>
                      <span className="text-xs font-mono text-blue-600">{params.meanReversionSpeed.toFixed(1)}</span>
                    </div>
                    <Slider 
                      value={[params.meanReversionSpeed]} 
                      min={0} max={5} step={0.1}
                      onValueChange={(v) => {
                        const val = Array.isArray(v) ? v[0] : v;
                        setParams({...params, meanReversionSpeed: val});
                      }}
                    />
                    <p className="text-[10px] text-gray-400 leading-tight">
                      Higher values pull the price back to the expected growth trend more quickly.
                    </p>
                  </div>

                  <Separator className="my-4" />

                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-600">Iterations</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {[100, 500, 1000, 5000].map(n => (
                        <Button 
                          key={n}
                          variant={params.iterations === n ? "default" : "outline"}
                          size="sm"
                          onClick={() => setParams({...params, iterations: n})}
                          className="text-[10px] h-8"
                        >
                          {n.toLocaleString()}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="relative border border-emerald-300/20 shadow-xl bg-gradient-to-br from-emerald-700/80 to-emerald-900/80 text-white overflow-hidden">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-emerald-100/30 via-emerald-100/10 to-transparent" />
              <CardContent className="p-6 space-y-2">
                <div className="flex items-center gap-2 opacity-80">
                  <Info className="h-4 w-4" />
                  <span className="text-xs font-medium uppercase tracking-wider">Simulation Info</span>
                </div>
                <p className="text-sm leading-relaxed opacity-90">
                  This model uses <strong>Geometric Brownian Motion</strong>, the standard for modeling stock prices. 
                  It assumes returns are normally distributed and volatility is constant.
                </p>
              </CardContent>
            </Card>
          </aside>

          {/* Main Content */}
          <main className="lg:col-span-9 space-y-8">
            {/* Stats Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              <AnimatePresence mode="wait">
                {stats && (
                  <>
                    <StatCard 
                      label="Average Final Value" 
                      value={formatCurrency(stats.mean)} 
                      subValue="Arithmetic mean of all paths"
                      icon={<Calculator className="h-4 w-4 text-gray-600" />}
                      delay={0}
                    />
                    <StatCard 
                      label="Expected Value (Mean)" 
                      value={formatCurrency(stats.mean)} 
                      subValue={`${((stats.mean / params.initialValue - 1) * 100).toFixed(1)}% total return`}
                      icon={<TrendingUp className="h-4 w-4 text-blue-600" />}
                      delay={0.1}
                    />
                    <StatCard 
                      label="Median Outcome" 
                      value={formatCurrency(stats.median)} 
                      subValue="50% probability above/below"
                      icon={<Target className="h-4 w-4 text-purple-600" />}
                      delay={0.2}
                    />
                    <StatCard 
                      label="95th Percentile (Best)" 
                      value={formatCurrency(stats.p95)} 
                      subValue="Top 5% of outcomes"
                      icon={<ArrowUpRight className="h-4 w-4 text-green-600" />}
                      delay={0.3}
                    />
                    <StatCard 
                      label="5th Percentile (Worst)" 
                      value={formatCurrency(stats.p5)} 
                      subValue="Bottom 5% of outcomes"
                      icon={<ArrowDownRight className="h-4 w-4 text-red-600" />}
                      delay={0.4}
                    />
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* Charts */}
            <Card className="relative border border-amber-200/20 shadow-2xl bg-black/30 backdrop-blur-sm overflow-hidden">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-amber-100/15 via-amber-100/5 to-transparent" />
              <Tabs defaultValue="paths" className="w-full">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div className="space-y-1">
                    <CardTitle className="text-lg font-bold">Visual Analysis</CardTitle>
                    <CardDescription>Explore the range of simulated trajectories and final distribution.</CardDescription>
                  </div>
                  <TabsList className="bg-black/30 border border-amber-200/10 p-1">
                    <div className="flex items-center gap-2 mr-4 px-2 border-r border-gray-200">
                      <Label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest cursor-pointer" htmlFor="bands-toggle">
                        Bands
                      </Label>
                      <input 
                        id="bands-toggle"
                        type="checkbox" 
                        checked={showConfidenceBands}
                        onChange={(e) => setShowConfidenceBands(e.target.checked)}
                        className="w-3 h-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </div>
                    <TabsTrigger value="paths" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
                      <TrendingUp className="h-4 w-4 mr-2" />
                      Paths
                    </TabsTrigger>
                    <TabsTrigger value="distribution" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
                      <BarChart3 className="h-4 w-4 mr-2" />
                      Distribution
                    </TabsTrigger>
                  </TabsList>
                </CardHeader>
                <CardContent className="p-6">
                  <TabsContent value="paths" className="mt-0 outline-none">
                    <div className="relative h-[400px] w-full rounded-xl border border-emerald-300/10 bg-gradient-to-b from-emerald-900/20 to-transparent p-2 overflow-hidden">
                      <div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-white/10 to-transparent" />
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData}>
                          <defs>
                            <linearGradient id="confidenceOuter" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#DBEAFE" stopOpacity={0.45} />
                              <stop offset="100%" stopColor="#EFF6FF" stopOpacity={0.15} />
                            </linearGradient>
                            <linearGradient id="confidenceInner" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#93C5FD" stopOpacity={0.35} />
                              <stop offset="100%" stopColor="#BFDBFE" stopOpacity={0.10} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#33574A" />
                          <XAxis 
                            dataKey="time" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{fontSize: 12, fill: '#C7D2FE'}}
                            label={{ value: 'Years', position: 'insideBottom', offset: -5, fontSize: 12, fill: '#C7D2FE' }}
                          />
                          <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{fontSize: 12, fill: '#C7D2FE'}}
                            tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`}
                          />
                          <Tooltip 
                            content={<CustomTooltip />}
                          />
                          {/* Confidence Bands */}
                          {showConfidenceBands && (
                            <>
                              <Area 
                                type="monotone" 
                                dataKey="p97_5" 
                                stroke="none" 
                                fill="url(#confidenceOuter)" 
                                fillOpacity={1} 
                                isAnimationActive={false}
                              />
                              <Area 
                                type="monotone" 
                                dataKey="p95" 
                                stroke="none" 
                                fill="url(#confidenceInner)" 
                                fillOpacity={1} 
                                isAnimationActive={false}
                              />
                              <Area 
                                type="monotone" 
                                dataKey="p5" 
                                stroke="none" 
                                fill="#EFF6FF" 
                                fillOpacity={1} 
                                isAnimationActive={false}
                              />
                              <Area 
                                type="monotone" 
                                dataKey="p2_5" 
                                stroke="none" 
                                fill="#FFFFFF" 
                                fillOpacity={1} 
                                isAnimationActive={false}
                              />
                            </>
                          )}
                          <Line
                            type="monotone"
                            dataKey="p50"
                            stroke="#1D4ED8"
                            strokeWidth={2.5}
                            strokeDasharray="6 4"
                            dot={false}
                            isAnimationActive={false}
                            opacity={0.9}
                          />
                          
                          {result?.paths.map((_, i) => (
                            <Line 
                              key={i}
                              type="monotone" 
                              dataKey={`path_${i}`} 
                              stroke={selectedPathIndex === i || hoveredPathIndex === i ? "#2563EB" : (selectedPathIndex !== null ? "#E2E8F0" : (i === 0 ? "#2563EB" : "#94A3B8"))} 
                              strokeWidth={selectedPathIndex === i || hoveredPathIndex === i ? 4 : (i === 0 && selectedPathIndex === null ? 2.5 : 1)}
                              opacity={selectedPathIndex === i || hoveredPathIndex === i ? 1 : (selectedPathIndex !== null ? 0.2 : (i === 0 ? 1 : 0.15))}
                              dot={false}
                              isAnimationActive={false}
                              connectNulls
                              activeDot={{ r: 4, strokeWidth: 0 }}
                              onClick={() => setSelectedPathIndex(i)}
                              onMouseEnter={() => setHoveredPathIndex(i)}
                              onMouseLeave={() => setHoveredPathIndex(null)}
                              style={{ cursor: 'pointer' }}
                            />
                          ))}
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-4 text-[10px] text-gray-400 uppercase tracking-widest font-semibold">
                        <div className="flex items-center gap-1.5">
                          <MousePointer2 className="h-3 w-3 text-blue-500" />
                          <span className="text-blue-600">Click a path to analyze</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-0.5 bg-blue-600" />
                          {selectedPathIndex !== null ? `Path #${selectedPathIndex + 1}` : 'Sample Path'}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 bg-[#DBEAFE] rounded-sm" />
                          90% Confidence
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 bg-[#EFF6FF] border border-blue-100 rounded-sm" />
                          95% Confidence
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-0.5 bg-gray-300" />
                          Other Scenarios ({result?.paths.length})
                        </div>
                      </div>
                      {selectedPathIndex !== null && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => setSelectedPathIndex(null)}
                          className="h-7 px-2 text-[10px] text-gray-500 hover:text-gray-900"
                        >
                          <X className="h-3 w-3 mr-1" />
                          Clear Selection
                        </Button>
                      )}
                    </div>

                    <AnimatePresence>
                      {selectedPathStats && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-6 overflow-hidden"
                        >
                          <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100 grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="space-y-1">
                              <span className="text-[9px] font-bold uppercase tracking-widest text-blue-400">Path Final Value</span>
                              <div className="text-sm font-bold text-blue-900">{formatCurrency(selectedPathStats.finalValue)}</div>
                            </div>
                            <div className="space-y-1">
                              <span className="text-[9px] font-bold uppercase tracking-widest text-blue-400">Total Return</span>
                              <div className={`text-sm font-bold ${selectedPathStats.totalReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {formatPercent(selectedPathStats.totalReturn)}
                              </div>
                            </div>
                            <div className="space-y-1">
                              <span className="text-[9px] font-bold uppercase tracking-widest text-blue-400">Peak Value</span>
                              <div className="text-sm font-bold text-gray-700">{formatCurrency(selectedPathStats.peak)}</div>
                            </div>
                            <div className="space-y-1">
                              <span className="text-[9px] font-bold uppercase tracking-widest text-blue-400">Trough Value</span>
                              <div className="text-sm font-bold text-gray-700">{formatCurrency(selectedPathStats.trough)}</div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </TabsContent>

                  <TabsContent value="distribution" className="mt-0 outline-none">
                    <div className="relative h-[400px] w-full rounded-xl border border-amber-300/10 bg-gradient-to-b from-amber-900/10 to-transparent p-2 overflow-hidden">
                      <div className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-amber-100/15 to-transparent" />
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={histogramData}>
                          <defs>
                            <linearGradient id="histogramGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#60A5FA" stopOpacity={0.95} />
                              <stop offset="100%" stopColor="#2563EB" stopOpacity={0.65} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#5A4A2A" />
                          <XAxis 
                            dataKey="bin" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{fontSize: 10, fill: '#FCD34D'}}
                            tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`}
                          />
                          <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{fontSize: 12, fill: '#FCD34D'}}
                          />
                          <Tooltip 
                            cursor={{fill: '#F8FAFC'}}
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                            labelFormatter={(v) => `Value Range: ${formatCurrency(v)}`}
                          />
                          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                            {histogramData.map((entry, index) => {
                              const isMedian = stats && entry.bin <= stats.median && histogramData[index+1]?.bin > stats.median;
                              return (
                                <Cell 
                                  key={`cell-${index}`} 
                                  fill={isMedian ? "#1D4ED8" : "url(#histogramGradient)"} 
                                />
                              );
                            })}
                          </Bar>
                          {stats && <ReferenceLine x={stats.median} stroke="#1D4ED8" strokeDasharray="4 4" strokeOpacity={0.8} />}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="mt-4 text-xs text-center text-gray-400 italic">
                      Frequency of final portfolio values across {params.iterations.toLocaleString()} iterations.
                    </p>
                  </TabsContent>
                </CardContent>
              </Tabs>
            </Card>

            {/* Probability Table */}
            <Card className="border-none shadow-sm bg-white">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="space-y-1">
                  <CardTitle className="text-lg font-bold">Probability Breakdown</CardTitle>
                  <CardDescription>Likelihood of reaching specific financial milestones.</CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={generateAiInsight}
                  disabled={isGeneratingInsight || !result}
                  className="h-9 border-blue-100 text-blue-600 hover:bg-blue-50"
                >
                  {isGeneratingInsight ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <BrainCircuit className="h-4 w-4 mr-2" />}
                  AI Insights
                </Button>
              </CardHeader>
              <CardContent className="p-6">
                <AnimatePresence>
                  {aiInsight && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="mb-6 p-4 rounded-xl bg-blue-50 border border-blue-100 relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 p-2 opacity-10">
                        <BrainCircuit className="h-12 w-12" />
                      </div>
                      <h4 className="text-[10px] font-bold uppercase tracking-widest text-blue-500 mb-2 flex items-center gap-2">
                        <Sparkles className="h-3 w-3" />
                        Gemini Intelligence
                      </h4>
                      <p className="text-sm text-blue-900 leading-relaxed italic">
                        "{aiInsight}"
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <ProbabilityMetric 
                    threshold={params.initialValue} 
                    label="Break Even" 
                    values={result?.finalValues || []} 
                  />
                  <ProbabilityMetric 
                    threshold={params.initialValue * 1.5} 
                    label="50% Gain" 
                    values={result?.finalValues || []} 
                  />
                  <ProbabilityMetric 
                    threshold={params.initialValue * 2} 
                    label="Double Investment" 
                    values={result?.finalValues || []} 
                  />
                </div>
              </CardContent>
            </Card>

            {/* Scenario Analysis */}
            <Card className="border-none shadow-sm bg-white">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg font-bold">Scenario Analysis</CardTitle>
                    <CardDescription>Compare your current strategy against market extremes.</CardDescription>
                  </div>
                  <Layers className="h-5 w-5 text-gray-400" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                  <ScenarioCard 
                    title="Conservative"
                    description="Low risk, steady growth"
                    mean={0.04}
                    volatility={0.08}
                    meanReversionSpeed={0.5}
                    currentParams={params}
                    onApply={() => toggleScenario(0.04, 0.08, 0.5)}
                    icon={<ShieldCheck className="h-4 w-4 text-emerald-600" />}
                    color="emerald"
                  />
                  <ScenarioCard 
                    title="Most Likely"
                    description="Balanced market expectations"
                    mean={0.08}
                    volatility={0.18}
                    meanReversionSpeed={0}
                    currentParams={params}
                    onApply={() => toggleScenario(0.08, 0.18, 0)}
                    icon={<Target className="h-4 w-4 text-blue-600" />}
                    color="blue"
                  />
                  <ScenarioCard 
                    title="Best Case"
                    description="High growth with controlled risk"
                    mean={0.14}
                    volatility={0.15}
                    meanReversionSpeed={0}
                    currentParams={params}
                    onApply={() => toggleScenario(0.14, 0.15, 0)}
                    icon={<Sparkles className="h-4 w-4 text-amber-600" />}
                    color="amber"
                  />
                  <ScenarioCard 
                    title="Aggressive"
                    description="High volatility, high reward"
                    mean={0.14}
                    volatility={0.35}
                    meanReversionSpeed={0}
                    currentParams={params}
                    onApply={() => toggleScenario(0.14, 0.35, 0)}
                    icon={<Zap className="h-4 w-4 text-orange-600" />}
                    color="orange"
                  />
                  <ScenarioCard 
                    title="Worst Case"
                    description="Low return, high volatility"
                    mean={0.04}
                    volatility={0.25}
                    meanReversionSpeed={0}
                    currentParams={params}
                    onApply={() => toggleScenario(0.04, 0.25, 0)}
                    icon={<TrendingDown className="h-4 w-4 text-red-600" />}
                    color="red"
                  />
                </div>

                <div className="mt-8 p-6 rounded-2xl bg-gray-50 border border-gray-100">
                  <h4 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-4">Market Stress Test</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                    {(() => {
                      const isBlackSwan = Math.abs(params.mean - (-0.20)) < 0.001 && Math.abs(params.volatility - 0.50) < 0.001;
                      const isGoldenDecade = Math.abs(params.mean - 0.15) < 0.001 && Math.abs(params.volatility - 0.12) < 0.001;

                      return (
                        <>
                          <div className={`space-y-3 p-4 rounded-xl transition-all ${isBlackSwan ? 'bg-red-50/50 border border-red-100' : ''}`}>
                            <div className="flex items-center gap-2 text-red-600">
                              <AlertTriangle className="h-4 w-4" />
                              <span className="text-sm font-bold">Black Swan Event</span>
                            </div>
                            <p className="text-xs text-gray-500 leading-relaxed">
                              What happens if the market drops 30% in a single year with 50% volatility? 
                              This scenario tests your portfolio's resilience to extreme crashes.
                            </p>
                            <Button 
                              variant={isBlackSwan ? "default" : "outline"} 
                              size="sm" 
                              className={`text-[10px] h-8 ${isBlackSwan ? 'bg-red-600 hover:bg-red-700 border-none' : 'border-red-100 text-red-600 hover:bg-red-50 hover:text-red-700'}`}
                              onClick={() => toggleScenario(-0.20, 0.50)}
                            >
                              {isBlackSwan ? 'Stress Test Active' : 'Apply Stress Test'}
                            </Button>
                          </div>
                          <div className={`space-y-3 p-4 rounded-xl transition-all ${isGoldenDecade ? 'bg-green-50/50 border border-green-100' : ''}`}>
                            <div className="flex items-center gap-2 text-green-600">
                              <TrendingUp className="h-4 w-4" />
                              <span className="text-sm font-bold">Golden Decade</span>
                            </div>
                            <p className="text-xs text-gray-500 leading-relaxed">
                              A period of unprecedented growth with low inflation and high innovation. 
                              Simulates a 15% annual return with minimal 12% volatility.
                            </p>
                            <Button 
                              variant={isGoldenDecade ? "default" : "outline"} 
                              size="sm" 
                              className={`text-[10px] h-8 ${isGoldenDecade ? 'bg-green-600 hover:bg-green-700 border-none' : 'border-green-100 text-green-600 hover:bg-green-50 hover:text-green-700'}`}
                              onClick={() => toggleScenario(0.15, 0.12)}
                            >
                              {isGoldenDecade ? 'Golden Decade Active' : 'Apply Golden Decade'}
                            </Button>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Scenario Comparison Chart */}
            <Card className="border-none shadow-sm bg-white">
              <CardHeader>
                <CardTitle className="text-lg font-bold">Scenario Comparison</CardTitle>
                <CardDescription>Expected final portfolio value across key scenarios (Deterministic Projection).</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={comparisonData} margin={{ top: 40, right: 30, left: 20, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F1F1" />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 12, fontWeight: 600, fill: '#4B5563' }}
                      />
                      <YAxis hide />
                      <Tooltip 
                        cursor={{ fill: '#F8FAFC' }}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                        formatter={(v: number, name: string, props: any) => [formatCurrency(v), props.payload.name]}
                      />
                      <Bar dataKey="value" radius={[8, 8, 0, 0]} barSize={60}>
                        {comparisonData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                        <LabelList 
                          dataKey="value" 
                          position="top" 
                          formatter={(v: number) => formatCurrency(v)}
                          style={{ fontSize: '12px', fontWeight: 'bold', fill: '#1F2937' }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-gray-50 pt-6">
                  {comparisonData.map((s) => (
                    <div key={s.name} className="p-4 rounded-xl bg-gray-50/50 border border-gray-100 flex flex-col items-center">
                      <div className="text-[10px] font-bold uppercase text-gray-400 tracking-wider mb-1">{s.name}</div>
                      <div className="text-lg font-bold" style={{ color: s.color }}>{formatCurrency(s.value)}</div>
                      <div className="text-[10px] text-gray-500 mt-1">Expected Outcome</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border border-amber-200/20 shadow-2xl bg-black/30 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-lg font-bold">Simulation History</CardTitle>
                <CardDescription>Recent runs and the median projected outcome.</CardDescription>
              </CardHeader>
              <CardContent>
                {simulationHistory.length === 0 ? (
                  <p className="text-sm text-gray-400">No runs recorded yet. Run a simulation to start tracking history.</p>
                ) : (
                  <div className="space-y-3">
                    {simulationHistory.map((entry, idx) => (
                      <div key={`${entry.timestamp}-${idx}`} className="rounded-xl border border-amber-100/10 bg-black/25 px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                        <div className="text-xs text-amber-200/90 font-mono">{entry.timestamp}</div>
                        <div className="text-xs text-emerald-100/80">Start: {formatCurrency(entry.initialValue)}</div>
                        <div className="text-xs text-emerald-100/80">μ: {formatPercent(entry.mean)} · σ: {formatPercent(entry.volatility)}</div>
                        <div className="text-sm font-semibold text-amber-300">Median: {formatCurrency(entry.medianFinal)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </main>
        </div>
      </div>
    </div>
  );
}

function ScenarioCard({ 
  title, 
  description, 
  mean, 
  volatility, 
  meanReversionSpeed,
  currentParams, 
  onApply, 
  icon,
  color 
}: { 
  title: string, 
  description: string, 
  mean: number, 
  volatility: number, 
  meanReversionSpeed: number,
  currentParams: SimulationParams,
  onApply: () => void,
  icon: React.ReactNode,
  color: 'emerald' | 'blue' | 'amber' | 'orange' | 'red'
}) {
  const isCurrent = 
    Math.abs(currentParams.mean - mean) < 0.001 && 
    Math.abs(currentParams.volatility - volatility) < 0.001 &&
    Math.abs(currentParams.meanReversionSpeed - meanReversionSpeed) < 0.001;

  const colorClasses = {
    emerald: {
      border: 'border-emerald-200',
      bg: 'bg-emerald-50/30',
      ring: 'ring-emerald-100',
      iconBg: 'bg-emerald-50',
      badge: 'bg-emerald-100 text-emerald-700'
    },
    blue: {
      border: 'border-blue-200',
      bg: 'bg-blue-50/30',
      ring: 'ring-blue-100',
      iconBg: 'bg-blue-50',
      badge: 'bg-blue-100 text-blue-700'
    },
    amber: {
      border: 'border-amber-200',
      bg: 'bg-amber-50/30',
      ring: 'ring-amber-100',
      iconBg: 'bg-amber-50',
      badge: 'bg-amber-100 text-amber-700'
    },
    orange: {
      border: 'border-orange-200',
      bg: 'bg-orange-50/30',
      ring: 'ring-orange-100',
      iconBg: 'bg-orange-50',
      badge: 'bg-orange-100 text-orange-700'
    },
    red: {
      border: 'border-red-200',
      bg: 'bg-red-50/30',
      ring: 'ring-red-100',
      iconBg: 'bg-red-50',
      badge: 'bg-red-100 text-red-700'
    }
  }[color];

  return (
    <div className={`p-5 rounded-2xl border transition-all ${isCurrent ? `${colorClasses.border} ${colorClasses.bg} ring-1 ${colorClasses.ring}` : 'border-gray-100 bg-white hover:border-gray-200'}`}>
      <div className="flex justify-between items-start mb-4">
        <div className={`p-2 rounded-lg ${colorClasses.iconBg}`}>
          {icon}
        </div>
        {isCurrent && (
          <Badge className={`${colorClasses.badge} border-none text-[9px] uppercase tracking-tighter`}>
            Active
          </Badge>
        )}
      </div>
      <div className="space-y-1 mb-4">
        <h4 className="font-bold text-sm">{title}</h4>
        <p className="text-[10px] text-gray-500 leading-tight">{description}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="space-y-0.5">
          <span className="text-[9px] uppercase font-bold text-gray-400 tracking-wider">Return</span>
          <div className="text-xs font-mono font-bold">{(mean * 100).toFixed(1)}%</div>
        </div>
        <div className="space-y-0.5">
          <span className="text-[9px] uppercase font-bold text-gray-400 tracking-wider">Risk</span>
          <div className="text-xs font-mono font-bold">{(volatility * 100).toFixed(1)}%</div>
        </div>
      </div>
      <Button 
        variant={isCurrent ? "default" : "outline"} 
        size="sm" 
        className={`w-full text-[10px] h-8 font-bold transition-all ${isCurrent ? 'bg-gray-900 text-white hover:bg-gray-800' : ''}`}
        onClick={onApply}
      >
        {isCurrent ? "Active (Toggle Off)" : "Apply Scenario"}
      </Button>
    </div>
  );
}

function StatCard({ label, value, subValue, icon, delay }: { label: string, value: string, subValue: string, icon: React.ReactNode, delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      <Card className="border-none shadow-sm bg-white hover:shadow-md transition-shadow">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</span>
            <div className="p-2 bg-gray-50 rounded-lg">
              {icon}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold tracking-tight">{value}</div>
            <div className="text-xs text-gray-500 font-medium">{subValue}</div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function ProbabilityMetric({ threshold, label, values }: { threshold: number, label: string, values: number[] }) {
  const prob = useMemo(() => {
    if (values.length === 0) return 0;
    const count = values.filter(v => v >= threshold).length;
    return (count / values.length) * 100;
  }, [values, threshold]);

  return (
    <div className="p-4 rounded-xl bg-gray-50/50 border border-gray-100 space-y-3">
      <div className="flex justify-between items-center">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
        <Badge variant="secondary" className="bg-white text-gray-600 border-gray-200 font-mono text-[10px]">
          {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(threshold)}
        </Badge>
      </div>
      <div className="flex items-end gap-2">
        <span className="text-3xl font-bold tracking-tighter text-gray-900">{prob.toFixed(1)}%</span>
        <span className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">Probability</span>
      </div>
      <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${prob}%` }}
          className="h-full bg-blue-600"
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}
