import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardService } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Loader } from '../components/ui/Loader';
import { getRiskInfo, formatPercent, formatDate } from '../utils/helpers';
import { ArrowLeft, AlertTriangle, CheckCircle2, TrendingUp, Package, Clock, BarChart2 } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';

export const SKUDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [skuData, setSkuData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDetails = async () => {
      setLoading(true);
      try {
        const data = await DashboardService.getSKUDetails(id);
        setSkuData(data);
      } catch (error) {
        console.error("Failed to fetch SKU details", error);
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [id]);

  if (loading) return <Loader className="h-[60vh]" text={`Loading details for ${id}...`} />;
  
  if (!skuData) return (
    <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
      <Package className="w-16 h-16 text-slate-300" />
      <h2 className="text-xl font-semibold">SKU Not Found</h2>
      <p className="text-slate-500">Could not locate prediction data for {id}.</p>
      <button onClick={() => navigate(-1)} className="text-sky-500 hover:underline">Go Back</button>
    </div>
  );

  const risk = getRiskInfo(skuData.prediction_prob);
  
  // Format SHAP / Top features for BarChart
  const featureData = (skuData.top_features || []).map(f => ({
    name: f.feature.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    importance: f.importance,
    value: f.value
  }));

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Predictions
      </button>

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold tracking-tight">{skuData.sku}</h1>
            <Badge className={risk.badgeClass}>{risk.level}</Badge>
          </div>
          <p className="text-lg text-slate-600 dark:text-slate-300">
            {skuData.product_name || "Unknown Product"}
          </p>
          <div className="flex items-center gap-4 mt-3 text-sm text-slate-500">
            <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> {formatDate(skuData.timestamp)}</span>
            <span className="flex items-center gap-1.5">Model: {skuData.model_version}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Core Prediction Card */}
        <Card className={`col-span-1 border-t-4 ${skuData.risk_flag ? 'border-t-rose-500' : 'border-t-emerald-500'}`}>
          <CardContent className="p-6">
            <h3 className="text-sm font-medium text-slate-500 mb-4">Predicted Stockout Risk</h3>
            <div className="flex items-end gap-2 mb-2">
              <span className="text-5xl font-bold tracking-tighter">
                {formatPercent(skuData.prediction_prob)}
              </span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-4 leading-relaxed">
              {risk.description}
            </p>
            
            <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Recommendation</h4>
              <div className="flex items-start gap-2">
                {skuData.risk_flag ? (
                  <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                )}
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {skuData.risk_flag 
                    ? "Initiate immediate restock. Alert dispatched to purchasing."
                    : "No action required. Monitor standard inventory depletion."}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Feature Importance Chart */}
        <Card className="col-span-1 md:col-span-2">
          <CardHeader>
             <div className="flex items-center gap-2">
               <BarChart2 className="w-5 h-5 text-sky-500" />
               <CardTitle>Feature Impact (SHAP)</CardTitle>
             </div>
             <CardDescription>Top variables driving this prediction.</CardDescription>
          </CardHeader>
          <CardContent>
            {featureData.length > 0 ? (
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={featureData} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#374151" opacity={0.2} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} width={90} />
                    <RechartsTooltip 
                      cursor={{fill: 'rgba(14, 165, 233, 0.1)'}}
                      contentStyle={{ backgroundColor: '#111827', border: 'none', borderRadius: '8px', color: '#f8fafc', fontSize: '12px' }}
                      formatter={(value, name, props) => [
                        `Importance: ${value.toFixed(3)} (Val: ${props.payload.value})`, 
                        'Impact'
                      ]}
                    />
                    <Bar dataKey="importance" radius={[0, 4, 4, 0]} barSize={24}>
                      {featureData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={skuData.risk_flag ? '#f43f5e' : '#0ea5e9'} opacity={1 - (index * 0.2)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-slate-500 text-sm italic">
                Detailed feature attribution not available for this record.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
