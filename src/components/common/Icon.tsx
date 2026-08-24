import {
  Layers, TrendingUp, TrendingDown, Target, Table, Activity, GitBranch, Boxes,
  LayoutGrid, Minus, SeparatorHorizontal, Waves,
  BellRing, Scale, Clock, BarChart3, CandlestickChart, Palette,
  Calculator, Bell, LineChart, BookOpen,
  Droplets, Shuffle, Zap, Gauge, RefreshCw, Ban,
  type LucideIcon,
} from "lucide-react";

const map: Record<string, LucideIcon> = {
  Layers, TrendingUp, TrendingDown, Target, Table, Activity, GitBranch, Boxes,
  LayoutGrid, Minus, SeparatorHorizontal, Waves,
  BellRing, Scale, Clock, BarChart3, CandlestickChart, Palette,
  Calculator, Bell, LineChart, BookOpen,
  Droplets, Shuffle, Zap, Gauge, RefreshCw, Ban,
};

export function Icon({ name, className }: { name: string; className?: string }) {
  const Cmp = map[name] ?? Layers;
  return <Cmp className={className} />;
}
