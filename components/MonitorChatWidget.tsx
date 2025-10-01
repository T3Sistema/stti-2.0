import React, { useState, useRef, useEffect, FormEvent, useMemo } from 'react';
import { TeamMember } from '../types';
import { ChatIcon } from './icons/ChatIcon';
import { SendIcon } from './icons/SendIcon';
import { ChevronDownIcon } from './icons/ChevronDownIcon';
import { useData } from '../hooks/useMockData';
import { GoogleGenAI, type Chat } from "@google/genai";
import { TriadLogo } from './icons/TriadLogo';


interface MonitorChatWidgetProps {
    user: TeamMember;
}

interface Message {
    id: string | number;
    text: string;
    sender: 'user' | 'monitor';
    timestamp: string;
}

const MonitorChatWidget: React.FC<MonitorChatWidgetProps> = ({ user }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [chat, setChat] = useState<Chat | null>(null);
    const { monitorSettings, companies, prospectaiLeads, hunterLeads, vehicles, monitorChatHistory, addMonitorChatMessage } = useData();

    const messagesEndRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
        const history = monitorChatHistory
            .filter(msg => msg.user_id === user.id)
            .map(msg => ({
                id: msg.id,
                text: msg.message,
                sender: msg.sender,
                timestamp: msg.created_at,
            }));
        
        if (history.length === 0) {
            setMessages([{ 
                id: 1, 
                text: `Olá ${user.name.split(' ')[0]}! Sou o Monitor, seu assistente de prospecção. Como posso te ajudar hoje?`, 
                sender: 'monitor',
                timestamp: new Date().toISOString()
            }]);
        } else {
            setMessages(history);
        }
    }, [monitorChatHistory, user.id, user.name]);


    useEffect(() => {
        if (isOpen && monitorSettings?.prompt && process.env.API_KEY) {
            try {
                const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
                const newChat = ai.chats.create({
                    model: 'gemini-2.5-flash',
                    config: {
                        systemInstruction: monitorSettings.prompt,
                    },
                });
                setChat(newChat);
            } catch (error) {
                console.error("Error initializing Gemini chat:", error);
                setMessages(prev => [...prev, {id: Date.now(), text: "Erro ao inicializar o assistente. A API Key pode estar inválida ou faltando.", sender: 'monitor', timestamp: new Date().toISOString()}]);
            }
        }
    }, [isOpen, monitorSettings]);


    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(scrollToBottom, [messages, isTyping]);

    const handleSendMessage = async (e: FormEvent) => {
        e.preventDefault();
        if (inputValue.trim() === '' || isTyping) return;

        if (!chat) {
            if (!monitorSettings?.prompt) {
                alert("O prompt do Monitor ainda não foi configurado pelo administrador.");
            } else {
                 alert("Erro de configuração. Verifique se a Chave de API está corretamente configurada no ambiente.");
            }
            return;
        }

        const text = inputValue.trim();
        const userMessage: Message = {
            id: Date.now(),
            text,
            sender: 'user',
            timestamp: new Date().toISOString(),
        };
        
        setMessages(prev => [...prev, userMessage]);
        setInputValue('');
        setIsTyping(true);

        // Salva a mensagem do usuário no banco de dados
        await addMonitorChatMessage({ user_id: user.id, sender: 'user', message: text });
        
        const activeCompany = companies.find(c => c.id === user.companyId);
        const myProspectLeads = prospectaiLeads.filter(l => l.salespersonId === user.id);
        const myHunterLeads = hunterLeads.filter(l => l.salespersonId === user.id);
        const myVehicles = vehicles.filter(v => v.salespersonId === user.id && v.status === 'available');

        let contexto = `
--- INFORMAÇÕES DE CONTEXTO ATUAL ---
Data e Hora: ${new Date().toLocaleString('pt-BR')}

SOBRE O USUÁRIO:
- Nome: ${user.name}
- Cargo: ${user.role}
- Empresa: ${activeCompany?.name || 'Não encontrada'}
- Meta de Vendas Mensal: ${user.monthlySalesGoal} veículos.

LEADS (MODO FARM / PROSPECTAI):
- Total de leads na sua carteira: ${myProspectLeads.length}
`;
        if (activeCompany && myProspectLeads.length > 0) {
            const leadsByStage: Record<string, number> = {};
            activeCompany.pipeline_stages.forEach(stage => {
                leadsByStage[stage.name] = myProspectLeads.filter(l => l.stage_id === stage.id).length;
            });
            contexto += "- Leads por etapa do pipeline:\n";
            Object.entries(leadsByStage).forEach(([stageName, count]) => {
                if (count > 0) {
                    contexto += `  - ${stageName}: ${count} lead(s)\n`;
                }
            });
        }
        if(user.isHunterModeActive) {
             contexto += `
LEADS (MODO HUNTER):
- O modo Hunter está ATIVO para este usuário.
- Total de leads Hunter na sua carteira: ${myHunterLeads.length}
`;
        } else {
             contexto += `
LEADS (MODO HUNTER):
- O modo Hunter está INATIVO para este usuário.
`;
        }
        contexto += `
ESTOQUE DE VEÍCULOS:
- Total de veículos atribuídos a este vendedor: ${myVehicles.length}
- Modelos: ${myVehicles.map(v => `${v.brand} ${v.model}`).join(', ') || 'Nenhum'}
--- FIM DO CONTEXTO ---

Com base no contexto acima, responda a pergunta do usuário.

PERGUNTA DO USUÁRIO:
${text}
`;

        try {
            const stream = await chat.sendMessageStream({ message: contexto });
            
            let fullResponseText = '';
            let firstChunk = true;
            const monitorMessageId = Date.now() + 1;
            const monitorMessageTimestamp = new Date().toISOString();

            for await (const chunk of stream) {
                const chunkText = chunk.text;
                if (chunkText) {
                    fullResponseText += chunkText;
                    if (firstChunk) {
                        setIsTyping(false);
                        setMessages(prev => [...prev, { id: monitorMessageId, text: chunkText, sender: 'monitor', timestamp: monitorMessageTimestamp }]);
                        firstChunk = false;
                    } else {
                        setMessages(prev => prev.map(m => m.id === monitorMessageId ? { ...m, text: m.text + chunkText } : m));
                    }
                }
            }

            if (fullResponseText) {
                await addMonitorChatMessage({ user_id: user.id, sender: 'monitor', message: fullResponseText });
            }

        } catch (error) {
            console.error("Error sending message to Gemini:", error);
            const errorMessage = "Desculpe, ocorreu um erro ao processar sua solicitação.";
            setMessages(prev => [...prev, {id: Date.now(), text: errorMessage, sender: 'monitor', timestamp: new Date().toISOString()}]);
            await addMonitorChatMessage({ user_id: user.id, sender: 'monitor', message: errorMessage });
        } finally {
            setIsTyping(false);
        }
    };

    return (
        <>
            {/* FAB */}
            <button
                onClick={() => setIsOpen(true)}
                className={`fixed bottom-6 right-6 w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-dark-background focus:ring-dark-primary ${isOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}`}
                aria-label="Abrir chat com o Monitor"
            >
                <TriadLogo className="w-16 h-16" />
            </button>

            {/* Chat Window */}
            <div
                className={`fixed bottom-6 right-6 w-[90vw] max-w-sm h-[70vh] max-h-[600px] bg-dark-card border border-dark-border rounded-2xl shadow-2xl shadow-black/50 flex flex-col transition-all duration-300 origin-bottom-right ${isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0 pointer-events-none'}`}
                aria-hidden={!isOpen}
            >
                {/* Header */}
                <header className="flex items-center justify-between p-4 border-b border-dark-border flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <img
                                src="https://aisfizoyfpcisykarrnt.supabase.co/storage/v1/object/public/imagens/LOGO%20TRIAD3%20.png"
                                alt="Monitor Logo"
                                className="w-10 h-10 rounded-full"
                            />
                             <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-green-400 ring-2 ring-dark-card"></span>
                        </div>
                        <div>
                            <h3 className="font-bold text-dark-text">Monitor</h3>
                            <p className="text-xs text-green-400">Online</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="p-2 rounded-full text-dark-secondary hover:bg-dark-border transition-colors"
                        aria-label="Fechar chat"
                    >
                        <ChevronDownIcon className="w-5 h-5" />
                    </button>
                </header>

                {/* Messages */}
                <div className="flex-grow p-4 overflow-y-auto space-y-4">
                    {messages.map(msg => (
                        <div key={msg.id} className={`flex items-end gap-2 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.sender === 'monitor' && (
                                <img
                                    src="https://aisfizoyfpcisykarrnt.supabase.co/storage/v1/object/public/imagens/LOGO%20TRIAD3%20.png"
                                    alt="Monitor Avatar"
                                    className="w-8 h-8 rounded-full flex-shrink-0"
                                />
                            )}
                            <div
                                className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                                    msg.sender === 'user'
                                        ? 'bg-dark-primary text-dark-background rounded-br-none'
                                        : 'bg-dark-border/50 text-dark-text rounded-bl-none'
                                }`}
                            >
                                <div style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</div>
                                <div 
                                    className="text-right text-xs opacity-70 mt-1.5"
                                    style={{ fontSize: '0.65rem', color: msg.sender === 'user' ? '#ffffffb3' : 'inherit' }}
                                >
                                    {new Date(msg.timestamp).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                        </div>
                    ))}
                    {isTyping && (
                         <div className="flex items-end gap-2 justify-start">
                            <img
                                src="https://aisfizoyfpcisykarrnt.supabase.co/storage/v1/object/public/imagens/LOGO%20TRIAD3%20.png"
                                alt="Monitor Avatar"
                                className="w-8 h-8 rounded-full flex-shrink-0"
                            />
                             <div className="p-3 rounded-2xl rounded-bl-none bg-dark-border/50">
                                <div className="flex items-center gap-1.5">
                                    <span className="h-2 w-2 bg-dark-secondary rounded-full animate-bounce delay-0"></span>
                                    <span className="h-2 w-2 bg-dark-secondary rounded-full animate-bounce delay-150"></span>
                                    <span className="h-2 w-2 bg-dark-secondary rounded-full animate-bounce delay-300"></span>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <footer className="p-4 border-t border-dark-border flex-shrink-0">
                    <form onSubmit={handleSendMessage} className="flex items-center gap-3">
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder="Digite sua mensagem..."
                            className="flex-grow w-full px-4 py-2 bg-dark-background border border-dark-border rounded-full focus:outline-none focus:ring-2 focus:ring-dark-primary text-sm"
                            aria-label="Mensagem para o Monitor"
                            disabled={isTyping}
                        />
                        <button
                            type="submit"
                            className="w-10 h-10 flex-shrink-0 rounded-full bg-dark-primary text-dark-background flex items-center justify-center transition-opacity hover:opacity-90 disabled:opacity-50"
                            aria-label="Enviar mensagem"
                            disabled={isTyping || inputValue.trim() === ''}
                        >
                            <SendIcon className="w-5 h-5" />
                        </button>
                    </form>
                </footer>
            </div>
        </>
    );
};

export default MonitorChatWidget;