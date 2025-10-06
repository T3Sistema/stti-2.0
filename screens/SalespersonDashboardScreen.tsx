import React, { useState, useMemo, useEffect, FormEvent, ChangeEvent } from 'react';
import { useData } from '../hooks/useMockData';
import { Vehicle, TeamMember, HunterLead, PipelineStage, Company } from '../types';
import KpiCard from '../components/KpiCard';
import VehicleCard from '../components/VehicleCard';
import { formatCurrency } from '../utils/calculationUtils';
import SalesGoalKpiCard from '../components/SalesGoalKpiCard';
import UserProfileDropdown from '../components/UserProfileDropdown';
import NotificationBell from '../components/NotificationBell';
import ImageLightbox from '../components/ImageLightbox';
import MarketingAssetsCard from '../components/MarketingAssetsCard';
import SalespersonPerformanceScreen from './SalespersonPerformanceScreen';
import { ChartBarIcon } from '../components/icons/ChartBarIcon';
import { CarIcon } from '../components/icons/CarIcon';
import FilterBar, { AdvancedFilters } from '../components/FilterBar';
import { getDaysInStock, formatTimeUntil } from '../utils/dateUtils';
import Modal from '../components/Modal';
import UserProfileForm from '../components/forms/UserProfileForm';
import ChangePasswordForm from '../components/forms/ChangePasswordForm';
import ProspectAIScreen from './ProspectAIScreen';
import { CrosshairIcon } from '../components/icons/CrosshairIcon';
import Card from '../components/Card';
import { PhoneIcon } from '../components/icons/PhoneIcon';
import { ClipboardIcon } from '../components/icons/ClipboardIcon';
import { ChatBubbleOvalLeftEllipsisIcon } from '../components/icons/ChatBubbleOvalLeftEllipsisIcon';
import { CalendarIcon } from '../components/icons/CalendarIcon';
import { CheckCircleIcon } from '../components/icons/CheckCircleIcon';
import { XCircleIcon } from '../components/icons/XCircleIcon';
import { CheckIcon } from '../components/icons/CheckIcon';
import { ArrowRightIcon } from '../components/icons/ArrowRightIcon';
import { UserCircleIcon } from '../components/icons/UserCircleIcon';
import ConfirmationModal from '../components/ConfirmationModal';
import { LockIcon } from '../components/icons/LockIcon';
import { UploadIcon } from '../components/icons/UploadIcon';
import { XIcon } from '../components/icons/XIcon';
import SalespersonHunterPerformanceScreen from './SalespersonHunterPerformanceScreen';
import { SearchIcon } from '../components/icons/SearchIcon';
import { ArrowPathIcon } from '../components/icons/ArrowPathIcon';


interface SalespersonDashboardScreenProps {
  user: TeamMember;
  onLogout: () => void;
}

type SalespersonView = 'stock' | 'performance';
type StockView = 'assigned' | 'all';
type Period = 'last_7_days' | 'last_30_days' | 'all' | 'custom';


// --- HUNTER MODE COMPONENTS ---

const HunterProspectCard: React.FC<{ title: string; count: number; color: string; }> = ({ title, count, color }) => (
    <Card className="p-4 text-center animate-fade-in">
        <p className="text-sm font-medium text-dark-secondary min-h-[2.5rem] flex items-center justify-center">{title}</p>
        <p className="text-4xl font-bold mt-2" style={{ color }}>{count}</p>
    </Card>
);

const HunterActionModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    lead: HunterLead;
    stages: PipelineStage[];
    onAction: (lead: HunterLead, feedbackText: string, images: string[], targetStageId: string, outcome?: 'convertido' | 'nao_convertido' | null) => Promise<void>;
}> = ({ isOpen, onClose, lead, stages, onAction }) => {
    const [feedbackText, setFeedbackText] = useState('');
    const [feedbackImages, setFeedbackImages] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const currentStage = stages.find(s => s.id === lead.stage_id);
    const nextStage = stages.find(s => s.stageOrder > (currentStage?.stageOrder || 0) && !s.isFixed);

    useEffect(() => {
        if (!isOpen) {
            setFeedbackText('');
            setFeedbackImages([]);
            setIsSubmitting(false);
        }
    }, [isOpen]);

    const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            // FIX: Iterate directly over FileList to ensure correct typing for 'file' and avoid Blob assignment errors.
            for (const file of e.target.files) {
                const reader = new FileReader();
                reader.onloadend = () => setFeedbackImages(prev => [...prev, reader.result as string]);
                reader.readAsDataURL(file);
            }
        }
    };

    const handleRemoveImage = (indexToRemove: number) => {
        setFeedbackImages(prev => prev.filter((_, index) => index !== indexToRemove));
    };

    const handlePerformAction = async (targetStageName: string, outcome?: 'convertido' | 'nao_convertido' | null) => {
        if (!feedbackText.trim()) {
            alert('Por favor, registre um feedback antes de finalizar.');
            return;
        }
        
        const targetStage = stages.find(s => s.name === targetStageName);
        if (!targetStage) {
            alert(`Erro: A etapa "${targetStageName}" não foi encontrada no pipeline.`);
            return;
        }
        
        setIsSubmitting(true);
        await onAction(lead, feedbackText, feedbackImages, targetStage.id, outcome);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose}>
             <div className="p-2 space-y-4">
                <h2 className="text-2xl font-bold text-center">Registrar Ação</h2>
                <div className="p-4 bg-dark-background rounded-lg border border-dark-border text-center">
                    <h3 className="text-2xl font-bold text-dark-primary">{lead.leadName}</h3>
                    <p className="text-dark-secondary mt-1">{lead.leadPhone}</p>
                </div>
                 <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-dark-secondary mb-2">
                        <ChatBubbleOvalLeftEllipsisIcon className="w-4 h-4" />
                        Feedback do Contato (Obrigatório)
                    </label>
                    <textarea value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)} rows={4} className="w-full px-3 py-2 text-sm bg-dark-background border border-dark-border rounded-md" placeholder="Descreva o resultado do contato..."/>
                </div>
                 <div>
                    <label htmlFor={`hunter-image-upload-${lead.id}`} className="w-full cursor-pointer text-center bg-dark-background hover:bg-dark-border/50 border border-dark-border text-dark-text font-medium py-2 px-3 rounded-md transition-colors text-sm flex items-center justify-center gap-2">
                        <UploadIcon className="w-4 h-4"/>
                        <span>Adicionar Imagens (Print)</span>
                    </label>
                    <input id={`hunter-image-upload-${lead.id}`} type="file" multiple className="sr-only" onChange={handleImageChange} accept="image/*" />
                </div>
                {feedbackImages.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                        {feedbackImages.map((imgSrc, index) => (
                            <div key={index} className="relative group">
                                <img src={imgSrc} alt={`Preview ${index}`} className="w-full h-16 object-cover rounded-md" />
                                <button type="button" onClick={() => handleRemoveImage(index)} className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <XIcon className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
                 <div className="pt-4 border-t border-dark-border">
                    <h4 className="text-center text-sm font-bold text-dark-secondary mb-3">Próximas Ações</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {nextStage && (
                            <button onClick={() => handlePerformAction(nextStage.name)} disabled={isSubmitting || !feedbackText.trim()} className="action-btn bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 sm:col-span-2">
                                <ArrowRightIcon className="w-5 h-5"/> Mover para {nextStage.name}
                            </button>
                        )}
                        <button onClick={() => handlePerformAction('Agendado')} disabled={isSubmitting || !feedbackText.trim()} className="action-btn bg-blue-500/20 text-blue-300 hover:bg-blue-500/30">
                            <CalendarIcon className="w-5 h-5"/> Agendar
                        </button>
                        <button onClick={() => handlePerformAction('Finalizados', 'convertido')} disabled={isSubmitting || !feedbackText.trim()} className="action-btn bg-green-500/20 text-green-300 hover:bg-green-500/30">
                            <CheckCircleIcon className="w-5 h-5"/> Lead convertido
                        </button>
                        <button onClick={() => handlePerformAction('Finalizados', 'nao_convertido')} disabled={isSubmitting || !feedbackText.trim()} className="action-btn bg-red-500/20 text-red-300 hover:bg-red-500/30 sm:col-span-2">
                            <XCircleIcon className="w-5 h-5"/> Lead não convertido
                        </button>
                    </div>
                </div>
            </div>
            <style>{`.action-btn { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.5rem; font-bold; padding: 1rem 0.5rem; border-radius: 0.5rem; transition: background-color 0.2s; text-align: center; opacity: 1; } .action-btn:disabled { opacity: 0.5; cursor: not-allowed; }`}</style>
        </Modal>
    );
};


const HunterLeadCard: React.FC<{ 
    lead: HunterLead; 
    isNewLead: boolean;
    onStartProspecting: () => void;
    onOpenActions: () => void;
    isDisabled?: boolean;
    isFinalized?: boolean;
    onReopen?: () => void;
}> = ({ lead, isNewLead, onStartProspecting, onOpenActions, isDisabled = false, isFinalized = false, onReopen }) => {
    const [isCopied, setIsCopied] = useState(false);
    
    const handleCopyPhone = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(lead.leadPhone);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    const handleClick = () => {
        if (isDisabled) return;
        if (isNewLead) {
            onStartProspecting();
        } else if (isFinalized) {
            onReopen?.();
        } else {
            onOpenActions();
        }
    };

    const lastFeedback = lead.feedback?.length > 0 ? lead.feedback[lead.feedback.length - 1] : null;

    return (
        <Card 
            className={`p-4 transition-all duration-300 relative ${isDisabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:border-dark-primary/50'}`} 
            onClick={handleClick}
        >
             {isDisabled && isNewLead && (
                <div className="absolute top-2 right-2 p-1 bg-dark-background/80 rounded-full" title="Prospecção bloqueada. Finalize o lead em andamento ou o anterior na fila.">
                    <LockIcon className="w-4 h-4 text-dark-secondary" />
                </div>
            )}
            <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-dark-background border border-dark-border flex items-center justify-center">
                        <UserCircleIcon className="w-6 h-6 text-dark-primary" />
                    </div>
                    <div>
                        <h4 className="font-bold text-dark-text">{lead.leadName}</h4>
                        <p className="text-xs text-dark-secondary">{new Date(lead.createdAt).toLocaleDateString('pt-BR')}</p>
                    </div>
                </div>
            </div>
            {!isNewLead && !isFinalized && (
                <div className="mt-4 pt-4 border-t border-dark-border space-y-3">
                    <div className="flex items-center justify-between gap-2 text-sm text-dark-secondary">
                        <div className="flex items-center gap-2">
                            <PhoneIcon className="w-4 h-4" />
                            <span className="font-medium text-dark-text">{lead.leadPhone}</span>
                        </div>
                        <button onClick={handleCopyPhone} className={`flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded-md transition-colors ${isCopied ? 'bg-green-500/20 text-green-400' : 'bg-dark-border/50 hover:bg-dark-border'}`}>
                            {isCopied ? <CheckIcon className="w-3 h-3"/> : <ClipboardIcon className="w-3 h-3" />}
                            {isCopied ? 'Copiado' : 'Copiar'}
                        </button>
                    </div>
                    {lastFeedback && (
                        <div className="text-xs text-dark-secondary p-2 bg-dark-background/50 rounded-md">
                            <span className="font-bold">Último Feedback:</span>
                            <p className="italic truncate">"{lastFeedback.text}"</p>
                        </div>
                    )}
                </div>
            )}
             {isFinalized && !isNewLead && (
                 <div className="mt-4 pt-4 border-t border-dark-border text-center space-y-2">
                     <p className={`text-sm font-bold ${lead.outcome === 'convertido' ? 'text-green-400' : 'text-red-400'}`}>
                        {lead.outcome === 'convertido' ? 'Convertido' : 'Não Convertido'}
                     </p>
                     <button className="w-full flex items-center justify-center gap-2 text-sm font-bold py-2 px-3 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors">
                         <ArrowPathIcon className="w-4 h-4" /> Reabrir Atendimento
                     </button>
                 </div>
            )}
        </Card>
    );
};


const HunterProspectColumn: React.FC<{ title: string; count: number; children: React.ReactNode; }> = ({ title, count, children }) => {
    return (
      <div className="w-full md:w-72 flex-shrink-0 bg-dark-card/50 p-4 rounded-lg flex flex-col gap-4">
        <h3 className="text-lg font-bold text-dark-text">{title} ({count})</h3>
        <div className="space-y-4 overflow-y-auto pr-2 max-h-[calc(100vh-25rem)]">
          {children}
        </div>
      </div>
    );
  };

const HunterScreen: React.FC<{ user: TeamMember, activeCompany: Company }> = ({ user, activeCompany }) => {
    const { hunterLeads, updateHunterLead, addHunterLeadAction, teamMembers } = useData();
    const [selectedLead, setSelectedLead] = useState<HunterLead | null>(null);
    const [leadToProspect, setLeadToProspect] = useState<HunterLead | null>(null);
    const [isPerformanceView, setIsPerformanceView] = useState(false);
    const [finalizedSearch, setFinalizedSearch] = useState('');
    const [leadToReopen, setLeadToReopen] = useState<HunterLead | null>(null);
    const [period, setPeriod] = useState<Period>('last_7_days');
    const [customRange, setCustomRange] = useState({
        start: new Date(new Date().setDate(new Date().getDate() - 6)).toISOString().slice(0, 10),
        end: new Date().toISOString().slice(0, 10),
    });


    const companyPipeline = useMemo(() => 
        activeCompany.pipeline_stages.filter(s => s.isEnabled).sort((a, b) => a.stageOrder - b.stageOrder), 
    [activeCompany]);

    const myLeads = useMemo(() => {
        const baseLeads = hunterLeads.filter(lead => lead.salespersonId === user.id);
        if (period === 'all') return baseLeads;

        let startDate: Date;
        let endDate: Date = new Date();
        endDate.setHours(23, 59, 59, 999);

        if (period === 'last_7_days') {
            startDate = new Date();
            startDate.setDate(startDate.getDate() - 6);
            startDate.setHours(0, 0, 0, 0);
        } else if (period === 'last_30_days') {
            startDate = new Date();
            startDate.setDate(startDate.getDate() - 29);
            startDate.setHours(0, 0, 0, 0);
        } else { // custom
            if (!customRange.start || !customRange.end) return [];
            startDate = new Date(customRange.start + 'T00:00:00');
            endDate = new Date(customRange.end + 'T23:59:59.999');
        }

        return baseLeads.filter(lead => {
            const leadDate = new Date(lead.createdAt);
            return leadDate >= startDate && leadDate <= endDate;
        });
    }, [hunterLeads, user.id, period, customRange]);

    const categorizedLeads = useMemo(() => {
        const categories: Record<string, HunterLead[]> = {};
        companyPipeline.forEach(stage => { categories[stage.id] = []; });

        myLeads.forEach(lead => {
            if (categories[lead.stage_id]) {
                categories[lead.stage_id].push(lead);
            }
        });
        return categories;
    }, [myLeads, companyPipeline]);
    
    const hasLeadInProgress = useMemo(() => {
        const inProgressStages = companyPipeline.filter(s => !s.isFixed && s.name !== 'Remanejados');
        for (const stage of inProgressStages) {
            if (categorizedLeads[stage.id]?.length > 0) {
                return true;
            }
        }
        return false;
    }, [categorizedLeads, companyPipeline]);

    const counts = useMemo(() => {
        const result: Record<string, number> = {};
        let total = 0;
        companyPipeline.forEach(stage => {
            const count = categorizedLeads[stage.id]?.length || 0;
            if (stage.name === 'Finalizados') {
                const converted = (categorizedLeads[stage.id] || []).filter(l => l.outcome === 'convertido').length;
                const notConverted = (categorizedLeads[stage.id] || []).filter(l => l.outcome === 'nao_convertido').length;
                result['Convertidos'] = converted;
                result['Não Convertidos'] = notConverted;
            } else {
                 result[stage.name] = count;
            }
             if (!stage.isFixed || stage.name === 'Novos Leads') {
                total += count;
            }
        });
        result['Total'] = total;
        return result;
    }, [categorizedLeads, companyPipeline]);

    const handleStartProspectingConfirm = async () => {
        if (!leadToProspect) return;
    
        const firstAttemptStage =
            companyPipeline.find(s => s.name === 'Primeira Tentativa') ||
            companyPipeline.find(s => !s.isFixed && s.stageOrder > 0);
    
        if (firstAttemptStage) {
            await updateHunterLead(leadToProspect.id, {
                stage_id: firstAttemptStage.id,
                prospected_at: new Date().toISOString(),
                last_activity: new Date().toISOString(),
            });
        } else {
            console.error("Pipeline configuration error: No initial attempt stage found (e.g., 'Primeira Tentativa').");
            alert("Erro de configuração do Pipeline: Nenhuma etapa inicial de tentativa foi encontrada.");
        }
        setLeadToProspect(null);
    };

    const confirmReopenLead = async () => {
        if (!leadToReopen) return;
        const firstAttemptStage = companyPipeline.find(s => s.name === 'Primeira Tentativa');
        if (firstAttemptStage) {
            await updateHunterLead(leadToReopen.id, { 
                stage_id: firstAttemptStage.id, 
                outcome: null 
            });
        }
        setLeadToReopen(null);
    };
    
    const periodOptions: { id: Period; label: string }[] = [
        { id: 'last_7_days', label: 'Últimos 7 dias' },
        { id: 'last_30_days', label: 'Últimos 30 dias' },
        { id: 'all', label: 'Todo o Período' },
        { id: 'custom', label: 'Personalizado' },
    ];
    
    if (isPerformanceView) {
        // Passar leads não filtrados para a tela de performance
        const allMyLeads = hunterLeads.filter(lead => lead.salespersonId === user.id);
        return <SalespersonHunterPerformanceScreen user={user} leads={allMyLeads} onBack={() => setIsPerformanceView(false)} allSalespeople={teamMembers} />
    }
    
    if (myLeads.length === 0 && period === 'all') {
        return (
            <div className="text-center py-16 bg-dark-card rounded-2xl border border-dark-border mt-8">
                <CheckCircleIcon className="w-16 h-16 mx-auto text-green-400" />
                <h3 className="text-2xl font-bold text-dark-text mt-4">Fila de Prospecção Vazia</h3>
                <p className="text-dark-secondary mt-2 max-w-md mx-auto">
                    Você não possui leads no modo Hunter. Aguarde o gestor distribuir uma nova base.
                </p>
            </div>
        );
    }


    return (
        <div className="mt-8">
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
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
                <button
                    onClick={() => setIsPerformanceView(true)}
                    className="flex items-center gap-2 bg-dark-card border border-dark-border px-4 py-2 rounded-lg hover:border-dark-primary transition-colors font-medium text-sm"
                >
                    <ChartBarIcon className="w-4 h-4" />
                    <span>Analisar Desempenho</span>
                </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 mb-8">
                <HunterProspectCard title="Meus Leads Ativos" count={counts['Total'] || 0} color="#00D1FF" />
                <HunterProspectCard title="Convertidos" count={counts['Convertidos'] || 0} color="#22C55E" />
                <HunterProspectCard title="Não Convertidos" count={counts['Não Convertidos'] || 0} color="#EF4444" />
                <HunterProspectCard title="Agendados" count={counts['Agendado'] || 0} color="#60A5FA" />
                <HunterProspectCard title="Novos Leads" count={counts['Novos Leads'] || 0} color="#FBBF24" />
            </div>

            <div className="flex flex-col md:flex-row md:overflow-x-auto md:space-x-6 md:pb-4 gap-6 md:gap-0">
                 {companyPipeline.filter(s => s.name !== 'Remanejados').map(stage => {
                    const isNewLeadColumn = stage.name === 'Novos Leads';
                    const isFinalizedColumn = stage.name === 'Finalizados';

                    const leadsForColumn = (categorizedLeads[stage.id] || []).filter(lead => 
                        !isFinalizedColumn || !finalizedSearch || 
                        lead.leadName.toLowerCase().includes(finalizedSearch.toLowerCase()) ||
                        lead.leadPhone.includes(finalizedSearch)
                    );

                    return (
                        <HunterProspectColumn key={stage.id} title={stage.name} count={leadsForColumn.length}>
                             {isFinalizedColumn && (
                                <div className="relative mb-2">
                                    <input
                                        type="text"
                                        placeholder="Pesquisar leads..."
                                        value={finalizedSearch}
                                        onChange={(e) => setFinalizedSearch(e.target.value)}
                                        className="w-full bg-dark-background border border-dark-border rounded-lg pl-8 pr-2 py-1.5 text-sm"
                                    />
                                    <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-secondary" />
                                </div>
                            )}
                            {leadsForColumn.length > 0
                                ? leadsForColumn.map((lead, index) => (
                                    <HunterLeadCard 
                                        key={lead.id} 
                                        lead={lead}
                                        isNewLead={isNewLeadColumn}
                                        isFinalized={isFinalizedColumn}
                                        onStartProspecting={() => setLeadToProspect(lead)}
                                        onOpenActions={() => setSelectedLead(lead)}
                                        onReopen={() => setLeadToReopen(lead)}
                                        isDisabled={isNewLeadColumn && (hasLeadInProgress || index > 0)}
                                    />
                                ))
                                : <div className="border-2 border-dashed border-dark-border rounded-lg p-8 text-center text-dark-secondary">Nenhum lead nesta etapa.</div>
                            }
                        </HunterProspectColumn>
                    )
                })}
            </div>

            {selectedLead && (
                <HunterActionModal 
                    isOpen={!!selectedLead}
                    onClose={() => setSelectedLead(null)}
                    lead={selectedLead}
                    stages={companyPipeline}
                    onAction={addHunterLeadAction}
                />
            )}

            <ConfirmationModal
                isOpen={!!leadToProspect}
                onClose={() => setLeadToProspect(null)}
                onConfirm={handleStartProspectingConfirm}
                title="Iniciar Prospecção"
                confirmButtonText="Iniciar"
                confirmButtonClass="bg-green-600 hover:bg-green-700"
            >
                Deseja iniciar a prospecção do lead <strong className="text-dark-text">{leadToProspect?.leadName}</strong>?
            </ConfirmationModal>

             <ConfirmationModal
                isOpen={!!leadToReopen}
                onClose={() => setLeadToReopen(null)}
                onConfirm={confirmReopenLead}
                title="Reabrir Atendimento"
                confirmButtonText="Sim, Reabrir"
                confirmButtonClass="bg-blue-600 hover:bg-blue-700"
            >
                Deseja reabrir o atendimento para o lead <strong className="text-dark-text">{leadToReopen?.leadName}</strong>? Ele voltará para a primeira etapa do funil.
            </ConfirmationModal>
            <style>{`
                .filter-date-input { background-color: #10182C; border: 1px solid #243049; color: #E0E0E0; padding: 0.375rem 0.5rem; border-radius: 0.5rem; font-size: 0.75rem; font-weight: 500; color-scheme: dark; }
                .filter-date-input::-webkit-calendar-picker-indicator { filter: invert(0.8); cursor: pointer; }
            `}</style>
        </div>
    );
};


const SalespersonDashboardScreen: React.FC<SalespersonDashboardScreenProps> = ({ user, onLogout }) => {
    const { 
        companies, vehicles, teamMembers, notifications, prospectaiLeads, hunterLeads,
        markVehicleAsSold, markNotificationAsRead, addNotification
    } = useData();
    
    // View State
    const [view, setView] = useState<'dashboard' | 'performance'>('dashboard');
    const [stockView, setStockView] = useState<StockView>('assigned');
    
    // Modal States
    const [expandedImageUrl, setExpandedImageUrl] = useState<string | null>(null);
    const [isEditProfileModalOpen, setEditProfileModalOpen] = useState(false);
    const [isChangePasswordModalOpen, setChangePasswordModalOpen] = useState(false);
    
    // Filter States
    const [filters, setFilters] = useState<AdvancedFilters>({
        salespersonIds: [],
        stockDays: [],
        priceRanges: [],
        modelNames: [],
    });
    const [isOverdueFilterActive, setOverdueFilterActive] = useState(false);
    const [selectedSalespersonId, setSelectedSalespersonId] = useState<string | null>(null);


    // Data specific to this user
    const activeCompany = companies.find(c => c.id === user.companyId);
    const features = activeCompany?.enabledFeatures || [];
    const availableToolsCount = features.filter(f => f === 'estoque_inteligente' || f === 'prospectai').length;

    // Determine initial view based on available features
    const getInitialSubView = () => {
        if (features.includes('prospectai') && !features.includes('estoque_inteligente')) {
            return 'prospectAI';
        }
        return 'dashboard';
    };
    const [currentSubView, setCurrentSubView] = useState<'dashboard' | 'prospectAI' | 'hunter'>(getInitialSubView);

    const userNotifications = notifications.filter(n =>
        (n.recipientRole === 'salesperson' && !n.userId) || // Notificações genéricas para vendedores
        n.userId === user.id // Notificações específicas para este usuário
    );

    // APPOINTMENT NOTIFICATION LOGIC
    useEffect(() => {
        if (!activeCompany) return;

        const NOTIFIED_APPOINTMENTS_KEY = `notified_appointments_${user.id}`;

        const checkAppointments = () => {
            const notifiedIds: string[] = JSON.parse(sessionStorage.getItem(NOTIFIED_APPOINTMENTS_KEY) || '[]');
            
            const agendadoStage = activeCompany.pipeline_stages.find(stage => stage.name === 'Agendado');
            if (!agendadoStage) return;

            const upcomingAppointments = prospectaiLeads.filter(lead => {
                if (lead.salespersonId !== user.id || lead.stage_id !== agendadoStage.id || !lead.appointment_at) {
                    return false;
                }
                const appointmentDate = new Date(lead.appointment_at);
                const now = new Date();
                const diffHours = (appointmentDate.getTime() - now.getTime()) / (1000 * 60 * 60);
                
                // Notificar sobre agendamentos nas próximas 48 horas (hoje e amanhã) que ainda não ocorreram.
                return diffHours > 0 && diffHours <= 48;
            });

            const newNotifiedIds = [...notifiedIds];

            upcomingAppointments.forEach(lead => {
                if (!notifiedIds.includes(lead.id)) {
                    const timeUntil = formatTimeUntil(lead.appointment_at!);
                    const lastFeedback = lead.feedback && lead.feedback.length > 0 ? lead.feedback[lead.feedback.length - 1].text : null;
                    
                    let message = `Lembrete: Agendamento com ${lead.leadName} ${timeUntil}.`;
                    if (lastFeedback) {
                        message += ` | Último feedback: "${lastFeedback}"`;
                    }
                    
                    // Envia uma notificação específica para este usuário
                    addNotification(message, 'salesperson', user.id);
                    
                    newNotifiedIds.push(lead.id);
                }
            });

            sessionStorage.setItem(NOTIFIED_APPOINTMENTS_KEY, JSON.stringify(newNotifiedIds));
        };

        // Verifica imediatamente ao carregar e depois a cada minuto
        checkAppointments();
        const intervalId = setInterval(checkAppointments, 60000); 

        return () => clearInterval(intervalId);

    }, [user.id, user.companyId, prospectaiLeads, addNotification, activeCompany]);


    // Vehicle data
    const allCompanyVehicles = useMemo(() => vehicles.filter(v => v.companyId === user.companyId && v.status === 'available'), [vehicles, user.companyId]);
    const assignedVehicles = useMemo(() => allCompanyVehicles.filter(v => v.salespersonId === user.id), [allCompanyVehicles, user.id]);
    const allSalespeople = useMemo(() => teamMembers.filter(tm => tm.companyId === user.companyId && tm.role === 'Vendedor'), [teamMembers, user.companyId]);
    
    const soldVehiclesThisMonth = useMemo(() => {
      return vehicles.filter(v => {
        if (v.status !== 'sold' || v.salespersonId !== user.id || !v.saleDate) return false;
        const saleDate = new Date(v.saleDate);
        const today = new Date();
        return saleDate.getMonth() === today.getMonth() && saleDate.getFullYear() === today.getFullYear();
      });
    }, [vehicles, user.id]);

    // KPI Calculations
    const totalAssignedValue = assignedVehicles.reduce((sum, v) => sum + v.announcedPrice - v.discount, 0);

    const salesGoalProps = {
        title: `Minha Meta de Vendas`,
        currentValue: soldVehiclesThisMonth.length,
        goalValue: user.monthlySalesGoal,
    };
    
    const vehiclesToDisplay = useMemo(() => {
        if (stockView === 'assigned') {
            return assignedVehicles;
        }

        let baseVehicles = allCompanyVehicles;

        // Apply main salesperson dropdown filter first
        if (selectedSalespersonId) {
            baseVehicles = baseVehicles.filter(v => v.salespersonId === selectedSalespersonId);
        }

        let vehiclesToFilter = [...baseVehicles];

        if (isOverdueFilterActive) {
            vehiclesToFilter = vehiclesToFilter.filter(v => getDaysInStock(v.entryDate) > 30);
        }

        const { salespersonIds, stockDays, priceRanges, modelNames } = filters;
        
        if (salespersonIds.length > 0) {
            vehiclesToFilter = vehiclesToFilter.filter(v => 
                (v.salespersonId && salespersonIds.includes(v.salespersonId))
            );
        }

        if (modelNames.length > 0) {
            vehiclesToFilter = vehiclesToFilter.filter(v => modelNames.includes(`${v.brand} ${v.model}`));
        }

        if (stockDays.length > 0) {
            vehiclesToFilter = vehiclesToFilter.filter(v => {
                const days = getDaysInStock(v.entryDate);
                return stockDays.some(range => {
                    if (range === '0-15') return days <= 15;
                    if (range === '16-30') return days > 15 && days <= 30;
                    if (range === '31-60') return days > 30 && days <= 60;
                    if (range === '60+') return days > 60;
                    return false;
                });
            });
        }
        
        if (priceRanges.length > 0) {
            vehiclesToFilter = vehiclesToFilter.filter(v => {
                const price = v.announcedPrice;
                return priceRanges.some(range => {
                    if (range === '0-50000') return price <= 50000;
                    if (range === '50001-100000') return price > 50000 && price <= 100000;
                    if (range === '100001-150000') return price > 100000 && price <= 150000;
                    if (range === '150001+') return price > 150000;
                    return false;
                });
            });
        }
        
        return vehiclesToFilter;

    }, [stockView, assignedVehicles, allCompanyVehicles, isOverdueFilterActive, filters, selectedSalespersonId]);

    const stockTitle = stockView === 'assigned' ? 'Meus Veículos Atribuídos' : 'Estoque Completo da Loja';

    if (!activeCompany) {
        return <div>Carregando dados...</div>;
    }
    
    if (view === 'performance' && features.includes('estoque_inteligente')) {
        const allSoldVehicles = vehicles.filter(v => v.status === 'sold' && v.companyId === user.companyId);
        return (
             <SalespersonPerformanceScreen 
                salespeople={allSalespeople}
                vehicles={allSoldVehicles}
                currentUser={user}
                onBack={() => setView('dashboard')}
             />
        );
    }

    if (currentSubView === 'prospectAI' && features.includes('prospectai')) {
        return <ProspectAIScreen
            onBack={() => setCurrentSubView('dashboard')}
            onSwitchToHunter={() => setCurrentSubView('hunter')}
            user={user}
            onLogout={onLogout}
            showBackButton={availableToolsCount > 1}
        />;
    }
    
    return (
        <div className="container mx-auto">
             <header className="flex flex-wrap justify-between items-center gap-4 mb-8">
                <div>
                    <h1 className="text-3xl sm:text-4xl font-bold text-dark-text">
                        Bem-vindo, <span className="text-dark-primary">{user.name.split(' ')[0]}</span>!
                    </h1>
                </div>
                <div className="flex items-center gap-4">
                    <NotificationBell
                        notifications={userNotifications}
                        onMarkAsRead={markNotificationAsRead}
                    />
                    <UserProfileDropdown
                        company={{ ...activeCompany, name: user.name, logoUrl: user.avatarUrl, email: user.email }}
                        onEditProfile={() => setEditProfileModalOpen(true)}
                        onChangePassword={() => setChangePasswordModalOpen(true)}
                        onLogout={onLogout}
                    />
                </div>
            </header>

            <div className="mb-8 animate-fade-in flex flex-wrap items-center justify-between gap-4">
                <div className="bg-dark-card p-1 rounded-lg border border-dark-border flex flex-wrap items-center gap-1">
                    {features.includes('estoque_inteligente') && (
                      <>
                        <button 
                            onClick={() => {
                                setCurrentSubView('dashboard');
                                setStockView('assigned');
                            }}
                            className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${stockView === 'assigned' && currentSubView === 'dashboard' ? 'bg-dark-primary text-dark-background' : 'text-dark-secondary hover:bg-dark-border/50'}`}
                        >
                            Meus Veículos
                        </button>
                        <button 
                            onClick={() => {
                                setCurrentSubView('dashboard');
                                setStockView('all');
                            }}
                             className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${stockView === 'all' && currentSubView === 'dashboard' ? 'bg-dark-primary text-dark-background' : 'text-dark-secondary hover:bg-dark-border/50'}`}
                        >
                            Estoque da Loja
                        </button>
                      </>
                    )}
                    {features.includes('prospectai') && (
                        <button 
                            onClick={() => setCurrentSubView('prospectAI')}
                            className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${currentSubView === 'prospectAI' ? 'bg-dark-primary text-dark-background' : 'text-dark-secondary hover:bg-dark-border/50'}`}
                        >
                            ProspectAI (Farm)
                        </button>
                    )}
                    {features.includes('prospectai') && user.isHunterModeActive && (
                        <button 
                            onClick={() => setCurrentSubView('hunter')}
                            className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${currentSubView === 'hunter' ? 'bg-dark-primary text-dark-background' : 'text-dark-secondary hover:bg-dark-border/50'}`}
                        >
                            ProspectAI (Hunter)
                        </button>
                    )}
                </div>
                {features.includes('estoque_inteligente') && (
                     <button
                        onClick={() => setView('performance')}
                        className="flex items-center gap-2 bg-dark-primary text-dark-background px-4 py-2 rounded-lg hover:opacity-90 transition-opacity font-bold text-sm"
                    >
                        <ChartBarIcon className="w-4 h-4" />
                        Minha Performance
                    </button>
                )}
            </div>
            
            {currentSubView === 'hunter' && features.includes('prospectai') && user.isHunterModeActive
                ? <HunterScreen user={user} activeCompany={activeCompany} />
                : features.includes('estoque_inteligente') && currentSubView === 'dashboard' ? (
              <>
                <FilterBar
                    salespeople={allSalespeople}
                    vehicles={allCompanyVehicles}
                    isOverdueFilterActive={isOverdueFilterActive}
                    onOverdueFilterToggle={() => setOverdueFilterActive(prev => !prev)}
                    onAdvancedFilterChange={setFilters}
                    // FIX: Use Array.isArray(val) as a type guard before accessing `val.length`. Also added explicit types to the reduce function accumulator and value to resolve a TypeScript error where `val` was inferred as 'unknown', preventing safe access to array properties.
                    activeAdvancedFiltersCount={Object.values(filters).reduce((acc: number, val: unknown) => acc + (Array.isArray(val) ? val.length : 0), 0)}
                    selectedSalespersonId={selectedSalespersonId}
                    onSalespersonSelect={setSelectedSalespersonId}
                    areFiltersDisabled={stockView === 'assigned'}
                    // Hide buttons not relevant for salesperson
                    showAddVehicle={false}
                    showSalesAnalysis={false}
                    showMarketing={false}
                    showLembrAI={false}
                    showStockViewToggle={false}
                    showProspectAI={false}
                />
                
                <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
                    <div className="xl:col-span-3 space-y-8">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            <KpiCard title="Veículos Atribuídos" value={assignedVehicles.length.toString()} trend="Prontos para venda" icon={<CarIcon />} />
                            <SalesGoalKpiCard {...salesGoalProps} />
                            <KpiCard title="Valor em Estoque" value={formatCurrency(totalAssignedValue)} trend="Sob sua responsabilidade" />
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold mb-4 animate-fade-in">
                                {stockTitle}
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {vehiclesToDisplay.map((vehicle, index) => (
                                    <VehicleCard 
                                        key={vehicle.id}
                                        id={`vehicle-card-${vehicle.id}`} 
                                        vehicle={vehicle}
                                        company={activeCompany}
                                        salesperson={teamMembers.find(s => s.id === vehicle.salespersonId)}
                                        onMarkAsSold={() => markVehicleAsSold(vehicle.id!)}
                                        onImageClick={() => vehicle.imageUrl && setExpandedImageUrl(vehicle.imageUrl)}
                                        isSalespersonView={true}
                                        style={{ animationDelay: `${index * 100}ms` }}
                                    />
                                ))}
                            </div>
                            {vehiclesToDisplay.length === 0 && (
                                <div className="text-center py-16 bg-dark-card rounded-2xl border border-dark-border">
                                    <h3 className="text-xl font-bold text-dark-text">Nenhum Veículo Encontrado</h3>
                                    <p className="text-dark-secondary mt-2">
                                        {stockView === 'assigned' 
                                            ? 'Você não possui veículos atribuídos no momento.' 
                                            : 'Tente ajustar os filtros ou selecione outro vendedor.'}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="xl:col-span-1 space-y-8">
                        <MarketingAssetsCard driveUrl={activeCompany.marketingDriveUrl} />
                    </div>
                </div>
              </>
            ) : (
                 <div className="text-center py-16 bg-dark-card rounded-2xl border border-dark-border">
                    <h3 className="text-xl font-bold text-dark-text">Bem-vindo(a), {user.name.split(' ')[0]}!</h3>
                    <p className="text-dark-secondary mt-2">
                       {features.length > 0 ? 'Sua visão de estoque está desabilitada. Use o menu acima para acessar as ferramentas disponíveis.' : 'Nenhuma ferramenta habilitada para seu perfil.'}
                    </p>
                </div>
            )}


             {expandedImageUrl && (
                <ImageLightbox
                    imageUrl={expandedImageUrl}
                    onClose={() => setExpandedImageUrl(null)}
                />
            )}
            
            <Modal isOpen={isEditProfileModalOpen} onClose={() => setEditProfileModalOpen(false)}>
                <UserProfileForm initialData={user} onClose={() => setEditProfileModalOpen(false)} />
            </Modal>
            
            <Modal isOpen={isChangePasswordModalOpen} onClose={() => setChangePasswordModalOpen(false)}>
                <ChangePasswordForm onClose={() => setChangePasswordModalOpen(false)} />
            </Modal>
        </div>
    );
};

export default SalespersonDashboardScreen;
