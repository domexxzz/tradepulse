import {
  Layers, TrendingUp, Target, Table, Activity, GitBranch, Boxes,
  LayoutGrid, Minus, SeparatorHorizontal, Waves,
  BellRing, Scale, Clock, BarChart3, CandlestickChart, Palette,
  Calculator, Bell, LineChart, BookOpen,
  type LucideIcon,
} from "lucide-react";

const map: Record<string, LucideIcon> = {
  Layers, TrendingUp, Target, Table, Activity, GitBranch, Boxes,
  LayoutGrid, Minus, SeparatorHorizontal, Waves,
  BellRing, Scale, Clock, BarChart3, CandlestickChart, Palette,
  Calculator, Bell, LineChart, BookOpen,
};

export function Icon({ name, className }: { name: string; className?: string }) {
  const Cmp = map[name] ?? Layers;
  return <Cmp className={className} />;
}
