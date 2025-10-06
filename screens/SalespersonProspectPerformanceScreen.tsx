import React, { useMemo, useState } from 'react';
import { TeamMember, ProspectAILead, PipelineStage } from '../types';
import { useData } from '../hooks/useMockData';
import Card from '../components/Card';
import ImageLightbox from '../components/ImageLightbox';
import ReactECharts from 'echarts-for-react';
import { PlusIcon } from '../components/icons/PlusIcon';
import { BullseyeIcon } from '../components/icons/BullseyeIcon';
import { ChatBubbleOvalLeftEllipsisIcon } from '../components/icons/ChatBubbleOvalLeftEllipsisIcon';
import { SwitchHorizontalIcon } from '../components/icons/SwitchHorizontalIcon';
import { CheckCircleIcon } from '../components/icons/CheckCircleIcon';
import { XIcon } from '../components/icons/XIcon';
import Modal from '../components/Modal';


// --- Helper Functions ---
const formatDuration = (ms: number): string => {
    if (ms < 0 || isNaN(ms)) return 'N/A';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    if (seconds > 0) return `${seconds}s`;
    return 'Imediato';
};

const calculatePerformanceMetrics = (leads: ProspectAILead[], companyPipeline: PipelineStage[], allSalespeople: TeamMember[]) => {
    const finalizadosStage = companyPipeline.find(s => s.name === 'Finalizados');
    const finalizedLeads = finalizadosStage ? leads.filter(l => l.stage_id === finalizadosStage.id) : [];

    const converted = finalizedLeads.filter(l => l.outcome === 'convertido');
    const notConverted = finalizedLeads.filter(l => l.outcome === 'nao_convertido');
    const finalized = [...converted, ...notConverted];
    const prospected = leads.filter(l => l.prospected_at);

    const conversionRate = finalized.length > 0 ? (converted.length / finalized.length) * 100 : 0;

    const responseTimes = prospected
        .map(l => new Date(l.prospected_at!).getTime() - new Date(l.createdAt).getTime())
        .filter(t => t >= 0);
    
    const avgResponseTime = responseTimes.length > 0 ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0;

    const closingTimes = finalized
        .filter(l => l.prospected_at && l.last_feedback_at)
        .map(l => new Date(l.last_feedback_at!).getTime() - new Date(l.prospected_at!).getTime())
        .filter(t => t >= 0);

    const avgClosingTime = closingTimes.length > 0 ? closingTimes.reduce((a, b) => a + b, 0) / closingTimes.length : 0;
    
    const stageMap = companyPipeline.reduce((acc, stage) => {
        acc[stage.id] = stage.name;
        return acc;
    }, {} as Record<string, string>);
    
    const allFeedbacks = leads
        .flatMap(l => {
            if (!l.feedback) return [];
            const stageName = stageMap[l.stage_id] || 'Desconhecido';
            let status = stageName;
            if (stageName === 'Finalizados') {
                if (l.outcome === 'convertido') status = 'Finalizado - Convertido';
                else if (l.outcome === 'nao_convertido') status = 'Finalizado - Não Convertido';
            }
            return l.feedback.map(f => ({ ...f, leadName: l.leadName, leadStatus: status, lead: l }));
        })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());


    return {
        totalLeads: leads.length,
        totalConverted: converted.length,
        totalNotConverted: notConverted.length,
        conversionRate,
        avgResponseTime,
        avgClosingTime,
        allFeedbacks
    };
};

const Kpi: React.FC<{ title: string; value: string; }> = ({ title, value }) => (
    <Card className="p-5 text-center transition-transform duration-300 hover:scale-105">
        <p className="text-sm font-medium text-dark-secondary">{title}</p>
        <p className="text-4xl font-bold mt-2 text-dark-primary">{value}</p>
    </Card>
);

interface PerformanceScreenProps {
    user: TeamMember;
    leads: ProspectAILead[];
    onBack: () => void;
    allSalespeople: TeamMember[];
}

type Period = 'all' | 'custom';

const generateLeadEvents = (lead: ProspectAILead, allSalespeople: TeamMember[]) => {
    const events: any[] = [];
    events.push({ type: 'creation', date: new Date(lead.createdAt), text: 'Lead recebido', icon: <PlusIcon className="w-4 h-4 text-blue-400" /> });
    if (lead.prospected_at) events.push({ type: 'prospecting', date: new Date(lead.prospected_at), text: 'Prospecção iniciada', icon: <BullseyeIcon className="w-4 h-4 text-yellow-400" /> });
    if (lead.feedback) lead.feedback.forEach(feedbackItem => events.push({ type: 'feedback', date: new Date(feedbackItem.createdAt), text: feedbackItem.text, images: feedbackItem.images, icon: <ChatBubbleOvalLeftEllipsisIcon className="w-4 h-4 text-gray-400" /> }));
    if (lead.details?.reassigned_at) {
        const from = allSalespeople.find(s => s.id === lead.details.reassigned_from)?.name || 'Desconhecido';
        const to = allSalespeople.find(s => s.id === lead.details.reassigned_to)?.name || 'Desconhecido';
        events.push({ type: 'reassignment', date: new Date(lead.details.reassigned_at), text: `Remanejado de ${from} para ${to}`, icon: <SwitchHorizontalIcon className="w-4 h-4 text-purple-400" /> });
    }
    if (lead.outcome && lead.last_feedback_at) {
        const outcomeText = lead.outcome === 'convertido' ? 'Convertido' : 'Não Convertido';
        const icon = lead.outcome === 'convertido' ? <CheckCircleIcon className="w-4 h-4 text-green-400" /> : <XIcon className="w-4 h-4 text-red-400" />;
        events.push({ type: 'finalization', date: new Date(lead.last_feedback_at), text: `Lead finalizado - ${outcomeText}`, icon: icon });
    }
    events.sort((a, b) => a.date.getTime() - b.date.getTime());
    return events;
};

const LeadHistoryTimeline: React.FC<{ lead: ProspectAILead, allSalespeople: TeamMember[], onImageClick: (url: string) => void }> = ({ lead, allSalespeople, onImageClick }) => {
    const events = useMemo(() => generateLeadEvents(lead, allSalespeople), [lead, allSalespeople]);

    return (
        <div className="p-2">
            <h2 className="text-2xl font-bold text-center mb-6">Histórico do Lead: {lead.leadName}</h2>
            <div className="max-h-[60vh] overflow-y-auto pr-2">
                <div className="relative pl-5 py-2">
                    <div className="absolute left-2.5 top-0 h-full w-0.5 bg-dark-border"></div>
                    {events.map((event, eventIndex) => (
                        <div key={eventIndex} className={`relative ${eventIndex === events.length - 1 ? '' : 'pb-4'}`}>
                            <div className="absolute -left-[23px] top-0.5 w-5 h-5 rounded-full bg-dark-card border-2 border-dark-border flex items-center justify-center">
                                {event.icon}
                            </div>
                            <div className="pl-4">
                                <p className="text-xs text-dark-secondary">{event.date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                                <p className="text-sm font-medium text-dark-text mt-1 whitespace-pre-wrap">{event.text}</p>
                                {event.type === 'feedback' && event.images && event.images.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-2">
                                        {event.images.map((img: string, i: number) => (
                                            <button key={i} onClick={() => onImageClick(img)} className="block w-12 h-12 rounded overflow-hidden focus:outline-none focus:ring-2 focus:ring-dark-primary">
                                                <img src={img} alt="feedback" className="w-full h-full object-cover"/>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const SalespersonProspectPerformanceScreen: React.FC<PerformanceScreenProps> = ({ user, leads, onBack, allSalespeople }) => {
    const { companies } = useData();
    const [period, setPeriod] = useState<Period>('all');
    const [customRange, setCustomRange] = useState({
        start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().slice(0, 10),
        end: new Date().toISOString().slice(0, 10),
    });
    const [expandedImageUrl, setExpandedImageUrl] = useState<string | null>(null);
    const [historyModalLead, setHistoryModalLead] = useState<ProspectAILead | null>(null);

    const activeCompany = useMemo(() => companies.find(c => c.id === user.companyId), [companies, user.companyId]);
    const companyPipeline = useMemo(() => activeCompany?.pipeline_stages.filter(s => s.isEnabled).sort((a, b) => a.stageOrder - b.stageOrder) || [], [activeCompany]);

    const filteredLeads = useMemo(() => {
        if (period === 'all') return leads;
        if (period === 'custom') {
            if (!customRange.start || !customRange.end) return [];
            const startDate = new Date(customRange.start + 'T00:00:00');
            const endDate = new Date(customRange.end + 'T23:59:59.999');
            return leads.filter(lead => {
                const leadDate = new Date(lead.createdAt);
                return leadDate >= startDate && leadDate <= endDate;
            });
        }
        return leads;
    }, [leads, period, customRange]);

    const metrics = useMemo(() => calculatePerformanceMetrics(filteredLeads, companyPipeline, allSalespeople), [filteredLeads, companyPipeline, allSalespeople]);

    const recentLeadsForTimeline = useMemo(() => {
        const leadMap = new Map<string, ProspectAILead>();
        for (const fb of metrics.allFeedbacks) {
            if (!leadMap.has(fb.lead.id)) {
                leadMap.set(fb.lead.id, fb.lead);
            }
        }
        return Array.from(leadMap.values());
    }, [metrics.allFeedbacks]);

    const barChartData = useMemo(() => {
        const stageCounts: Record<string, number> = {};
        const stageOrderMap = new Map<string, number>();

        companyPipeline.forEach(stage => {
            if (stage.isEnabled) {
                stageCounts[stage.name] = 0;
                stageOrderMap.set(stage.name, stage.stageOrder);
            }
        });

        stageCounts['Convertidos'] = 0;
        stageCounts['Não Convertidos'] = 0;
        stageOrderMap.set('Convertidos', 100);
        stageOrderMap.set('Não Convertidos', 101);

        const finalizadosStageId = companyPipeline.find(s => s.name === 'Finalizados')?.id;
        const novosLeadsStage = companyPipeline.find(s => s.name === 'Novos Leads');

        for (const lead of filteredLeads) {
            if (lead.details?.reassigned_from === user.id) {
                const remanejadoStage = companyPipeline.find(s => s.name === 'Remanejados');
                // FIX: Corrected variable from 'stage' to 'remanejadoStage' to use variable in scope, and cast to 'any' to resolve index signature error.
                if (remanejadoStage && stageCounts.hasOwnProperty(remanejadoStage.name)) {
                    (stageCounts as any)[remanejadoStage.name]++;
                }
            } 
            else if (lead.salespersonId === user.id) {
                const stage = companyPipeline.find(s => s.id === lead.stage_id);
                if (stage) {
                    if (stage.id === finalizadosStageId) {
                        if (lead.outcome === 'convertido') {
                            stageCounts['Convertidos']++;
                        } else if (lead.outcome === 'nao_convertido') {
                            stageCounts['Não Convertidos']++;
                        }
                    } 
                    else if (stage.name === 'Remanejados' && novosLeadsStage) {
                        (stageCounts as any)[novosLeadsStage.name]++;
                    }
                    else if (stageCounts.hasOwnProperty(stage.name)) {
                        (stageCounts as any)[stage.name]++;
                    }
                }
            }
        }
        
        const data = Object.entries(stageCounts)
            .map(([name, value]) => ({ name, value }))
            .filter(item => item.name !== 'Finalizados' && stageOrderMap.has(item.name));

        data.sort((a, b) => (stageOrderMap.get(a.name) ?? 999) - (stageOrderMap.get(b.name) ?? 999));

        return data;
    }, [filteredLeads, companyPipeline, user.id]);

    const leadsOverTimeData = useMemo(() => {
        if (filteredLeads.length === 0) {
            return [];
        }

        const leadsByDate = filteredLeads.reduce((acc, lead) => {
            const date: string = new Date(lead.createdAt).toISOString().slice(0, 10);
            acc[date] = (acc[date] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const dates = Object.keys(leadsByDate).map(d => new Date(d + 'T00:00:00'));
        const startDate = new Date(Math.min(...dates.map(d => d.getTime())));
        const endDate = new Date(Math.max(...dates.map(d => d.getTime())));

        const fullDateRangeData = [];
        let currentDate = new Date(startDate);
        
        while (currentDate <= endDate) {
            const dateString = currentDate.toISOString().slice(0, 10);
            fullDateRangeData.push([
                dateString,
                leadsByDate[dateString] || 0
            ]);
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        if (fullDateRangeData.length === 1) {
            const singleDate = new Date(fullDateRangeData[0][0] + 'T00:00:00');
            const dayBefore = new Date(singleDate);
            dayBefore.setDate(singleDate.getDate() - 1);
            const dayAfter = new Date(singleDate);
            dayAfter.setDate(singleDate.getDate() + 1);
            
            return [
                [dayBefore.toISOString().slice(0, 10), 0],
                ...fullDateRangeData,
                [dayAfter.toISOString().slice(0, 10), 0]
            ];
        }

        return fullDateRangeData;
    }, [filteredLeads]);

    const chartOptions = {
        base: {
            textStyle: { color: '#E0E0E0', fontFamily: 'Inter' },
            tooltip: { trigger: 'item', backgroundColor: 'rgba(16, 24, 44, 0.8)', borderColor: '#243049', textStyle: { color: '#E0E0E0' } },
            grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        },
        bar: {
            xAxis: {
                type: 'category',
                data: barChartData.map(d => d.name),
                axisLabel: {
                    color: '#8A93A3',
                    interval: 0,
                    fontSize: 10,
                    formatter: (value: string) => {
                        return value.replace(/ /g, '\n');
                    }
                },
                axisLine: { lineStyle: { color: '#243049' } }
            },
            yAxis: {
                type: 'value',
                axisLabel: { color: '#8A93A3' },
                splitLine: { lineStyle: { color: '#243049', type: 'dashed' } },
                minInterval: 1,
            },
            series: [{
                data: barChartData.map(d => d.value),
                type: 'bar',
                barWidth: '60%',
                itemStyle: { color: '#00D1FF', borderRadius: [5, 5, 0, 0] },
                emphasis: { itemStyle: { color: '#00AEEF' } }
            }],
            tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: '{b}: {c} leads' },
        },
        leadsOverTime: {
            xAxis: { type: 'category', boundaryGap: false, data: leadsOverTimeData.map(d => d[0]), axisLine: { lineStyle: { color: '#243049' } } },
            yAxis: { type: 'value', splitLine: { lineStyle: { color: '#243049' } }, minInterval: 1 },
            series: [{
                data: leadsOverTimeData.map(d => d[1] as number),
                type: 'line',
                smooth: true,
                symbol: 'none',
                areaStyle: {
                    color: {
                        type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                        colorStops: [{ offset: 0, color: 'rgba(0, 209, 255, 0.5)' }, { offset: 1, color: 'rgba(0, 209, 255, 0)' }]
                    }
                },
                lineStyle: { color: '#00D1FF' }
            }]
        },
    };

    const periodOptions: { id: Period; label: string }[] = [
        { id: 'all', label: 'Todo o Período' },
        { id: 'custom', label: 'Personalizado' },
    ];

    return (
        <div className="animate-fade-in">
            <header className="flex flex-wrap justify-between items-center gap-4 mb-8">
                <div>
                    <button onClick={onBack} className="flex items-center gap-2 text-sm text-dark-secondary hover:text-dark-text mb-2">
                        &larr; Voltar ao Pipeline
                    </button>
                    <h1 className="text-3xl sm:text-4xl font-bold text-dark-text">Análise de Desempenho</h1>
                </div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                     <div className="bg-dark-card p-1 rounded-lg border border-dark-border flex flex-wrap items-center gap-1">
                        {periodOptions.map(opt => (
                            <button key={opt.id} onClick={() => setPeriod(opt.id)} className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${period === opt.id ? 'bg-dark-primary text-dark-background' : 'text-dark-secondary hover:bg-dark-border/50'}`}>
                                {opt.label}
                            </button>
                        ))}
                    </div>
                    {period === 'custom' && (
                        <div className="flex items-center gap-2 animate-fade-in bg-dark-card p-1 rounded-lg border border-dark-border">
                            <input type="date" value={customRange.start} onChange={(e) => setCustomRange(r => ({...r, start: e.target.value}))} className="filter-date-input"/>
                            <span className="text-dark-secondary text-xs">até</span>
                            <input type="date" value={customRange.end} onChange={(e) => setCustomRange(r => ({...r, end: e.target.value}))} className="filter-date-input"/>
                        </div>
                    )}
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <Kpi title="Total de Leads" value={metrics.totalLeads.toString()} />
                <Kpi title="Taxa de Conversão" value={`${metrics.conversionRate.toFixed(1)}%`} />
                <Kpi title="1º Contato (Média)" value={formatDuration(metrics.avgResponseTime)} />
                <Kpi title="Atendimento (Média)" value={formatDuration(metrics.avgClosingTime)} />
            </div>

            <div className="grid grid-cols-1 gap-6 mb-6">
                <Card className="p-4">
                    <h2 className="text-xl font-bold text-dark-text mb-4">Pipeline de Leads</h2>
                    <ReactECharts option={{ ...chartOptions.base, ...chartOptions.bar }} style={{ height: '400px' }} />
                </Card>
            </div>
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-4">
                    <h2 className="text-xl font-bold text-dark-text mb-4">Leads ao Longo do Tempo</h2>
                    <ReactECharts option={{ ...chartOptions.base, ...chartOptions.leadsOverTime }} style={{ height: '300px' }} />
                </Card>
                <Card className="p-4">
                     <h2 className="text-xl font-bold text-dark-text mb-4">Feedbacks Recentes</h2>
                     <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                        {recentLeadsForTimeline.length > 0 ? (
                             recentLeadsForTimeline.map((lead) => {
                                const events = generateLeadEvents(lead, allSalespeople);
                                const lastEvent = events.length > 0 ? events[events.length - 1] : null;
                                const dateToShow = lastEvent ? lastEvent.date : new Date(lead.createdAt);
                                const textToShow = lastEvent ? lastEvent.text : 'Lead Criado';
                                return (
                                    <div key={lead.id}
                                         onClick={() => setHistoryModalLead(lead)}
                                         className="p-3 bg-dark-background/50 rounded-md border border-dark-border/50 cursor-pointer hover:border-dark-primary/50 transition-colors">
                                        <div className="flex justify-between items-start gap-3">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs text-dark-secondary">Lead: <span className="font-semibold text-dark-text">{lead.leadName}</span></p>
                                                <p className="text-sm text-dark-text mt-1 truncate" title={textToShow}>{textToShow}</p>
                                            </div>
                                            <p className="text-xs text-dark-secondary flex-shrink-0">
                                                {new Date(dateToShow).toLocaleString('pt-BR', {day: '2-digit', month: '2-digit', year:'2-digit', hour: '2-digit', minute: '2-digit'})}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })
                         ) : <p className="text-center text-dark-secondary py-8">Nenhum feedback no período.</p>}
                     </div>
                 </Card>
            </div>

            <Modal isOpen={!!historyModalLead} onClose={() => setHistoryModalLead(null)}>
                {historyModalLead && <LeadHistoryTimeline lead={historyModalLead} allSalespeople={allSalespeople} onImageClick={setExpandedImageUrl}/>}
            </Modal>

            {expandedImageUrl && <ImageLightbox imageUrl={expandedImageUrl} onClose={() => setExpandedImageUrl(null)} />}
            
            <style>{`
                .filter-date-input { background-color: #10182C; border: 1px solid #243049; color: #E0E0E0; padding: 0.375rem 0.5rem; border-radius: 0.5rem; font-size: 0.75rem; font-weight: 500; color-scheme: dark; }
                .filter-date-input::-webkit-calendar-picker-indicator { filter: invert(0.8); cursor: pointer; }
            `}</style>
        </div>
    );
};

export default SalespersonProspectPerformanceScreen;