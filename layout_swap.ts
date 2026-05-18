import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf-8');

// Replace the columns for the main layout.
// Original Calculator inputs section: <section className="col-span-1 lg:col-span-4 flex flex-col gap-6 overflow-y-auto pr-2 animate-in slide-in-from-left-4 duration-500 fade-in">
content = content.replace(
    'className="col-span-1 lg:col-span-4 flex flex-col gap-6 overflow-y-auto pr-2 animate-in slide-in-from-left-4 duration-500 fade-in"',
    'className="col-span-1 lg:col-span-3 flex flex-col gap-6 overflow-y-auto animate-in slide-in-from-left-4 duration-500 fade-in pb-8"'
);

// We need to extract the tabs structure.
// Instead of regex, let's do targeted string splits.

const startTabsSection = '{/* Vista Central de Pestañas */}';
const targetStr = content.substring(content.indexOf(startTabsSection));

// The block ends right before </main>
const beforeEndMain = targetStr.split('</main>')[0];

const newColumnsHTML = `
            {/* Evaluación Aditiva & History Wrapper */}
            
            {currentTab === 'history' ? (
              <section className="col-span-1 lg:col-span-9 border-2 border-[#D1D5DB] bg-white flex flex-col relative overflow-hidden animate-in slide-in-from-right-4 duration-500 fade-in shadow-2xl">
                  <QuoteHistory 
                    onNewQuote={() => {
                      setTicketItems([]);
                      setClientName('');
                      setNotes('');
                      setSavedQuoteId(null);
                      setCurrentTab('calculator');
                    }}
                    onCloneQuote={(quote) => {
                      setTicketItems(quote.items);
                      setOperatorName(quote.operatorName);
                      setClientName(quote.clientName);
                      setNotes(quote.notes);
                      setSavedQuoteId(quote.id);
                      setCurrentTab('calculator');
                      success(\`Editando copia de \${quote.folio}\`);
                    }}
                  />
              </section>
            ) : (
                <>
                    {/* EVALUACIÓN ADITIVA (COL 2) */}
                    <section className="col-span-1 lg:col-span-4 border-2 border-[#D1D5DB] bg-white flex flex-col relative overflow-hidden animate-in fade-in shadow-2xl pb-8">
                       <div className="absolute top-0 right-0 p-4 opacity-[0.02] font-black text-8xl lg:text-9xl select-none leading-none pointer-events-none">E</div>
                       
                       <div className="flex border-b-2 border-[#059669] bg-white shrink-0 relative z-10 w-full p-4 mb-4">
                          <h2 className="font-mono text-xs uppercase tracking-widest flex items-center gap-2 font-bold text-[#059669]">
                             <Scale size={16} /> Evaluación Aditiva
                          </h2>
                       </div>
                       
                       <div className="flex flex-col h-full overflow-y-auto p-6">
                           {calc ? (
                            <div className="flex-grow font-mono space-y-4 text-sm leading-relaxed flex flex-col animate-in fade-in duration-300 h-full">
                              <div className="flex justify-between items-center text-xs lg:text-sm hover:translate-x-1 transition-transform">
                                <span className="opacity-80">Consumo de Material ({inputs.weight}g)</span>
                                <span className="font-bold">{formatMXN(calc.materialCost)}</span>
                              </div>
                              <div className="flex justify-between items-center text-xs lg:text-sm hover:translate-x-1 transition-transform">
                                <span className="opacity-80">Costo Operación Máquina ({inputs.time}h)</span>
                                <span className="font-bold">{formatMXN(calc.machineOpCost)}</span>
                              </div>
                              <div className="flex justify-between items-center text-xs lg:text-sm hover:translate-x-1 transition-transform">
                                <span className="opacity-80">Mantenimiento/Desgaste ({inputs.time}h)</span>
                                <span className="font-bold">{formatMXN(calc.machineMaintCost)}</span>
                              </div>
                              <div className="flex justify-between items-center text-xs lg:text-sm hover:translate-x-1 transition-transform">
                                <span className="opacity-80">Costo Base de Preparación</span>
                                <span className="font-bold">{formatMXN(calc.setupCost)}</span>
                              </div>
                              <div className="flex justify-between items-center text-xs lg:text-sm hover:translate-x-1 transition-transform">
                                <span className="opacity-80">Labor de Post-Procesado</span>
                                <span className="font-bold">{formatMXN(inputs.laborCost)}</span>
                              </div>
                              <div className="flex justify-between items-center text-[#059669]/80 italic text-xs lg:text-sm hover:translate-x-1 transition-transform">
                                <span>Prima Riesgo ({activeProfile!.failureRate}%)</span>
                                <span>+{formatMXN(calc.failureAbsCost)}</span>
                              </div>
                              <div className="pt-4 border-t border-dashed border-[#374151]/20 flex justify-between items-center mt-2">
                                <span className="opacity-80 uppercase tracking-widest text-[10px]">Subtotal Acumulado</span>
                                <span className="font-bold">{formatMXN(calc.costWithFailure)}</span>
                              </div>
                              <div className="flex justify-between items-center hover:scale-[1.01] origin-left transition-transform bg-[#059669]/5 p-2 -mx-2 rounded border border-[#059669]/20 font-bold mb-8">
                                <span className="opacity-80 uppercase tracking-widest text-[9px] md:text-[10px]">Margen Dictaminado ({inputs.margin}%)</span>
                                <span className="text-[#059669]">+{formatMXN(calc.profitMarginAbs)}</span>
                              </div>
                              
                              <div className="mt-auto flex flex-col gap-4">
                                <div className="flex flex-col border-b border-[#D1D5DB] pb-4">
                                  <span className="text-[10px] uppercase tracking-widest opacity-50 mb-1">Precio Ofertado por Pieza (MXN)</span>
                                  <span className="text-4xl xl:text-5xl font-black tracking-tight text-[#059669] drop-shadow-sm">{formatMXN(calc.finalPrice)}</span>
                                </div>
                                <button onClick={handleCopyInternal} className={\`w-full font-black px-4 py-3 uppercase text-[10px] sm:text-xs tracking-wide border border-[#D1D5DB] transition-colors flex justify-center items-center gap-2 cursor-pointer \${copiedStates['internal'] ? 'bg-green-600 border-green-600 text-white' : 'bg-[#F9FAFB] hover:bg-[#E5E7EB] text-[#111827]'}\`}>
                                  {copiedStates['internal'] ? <><Check size={16}/> Copiado al portapapeles</> : <><Copy size={16}/> Copiar Desglose Interno</>}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex-grow flex items-center justify-center opacity-30 text-[10px] sm:text-xs font-mono uppercase text-center h-full p-4">Esperando Configuración o Input de Masa</div>
                          )}
                       </div>
                    </section>
                    
                    {/* TICKET / ORDER (COL 3) */}
                    <section className="col-span-1 lg:col-span-5 border-2 border-[#D1D5DB] bg-white flex flex-col relative overflow-hidden animate-in slide-in-from-right-4 duration-500 fade-in shadow-xl pb-8">
                        <div className="absolute top-0 right-0 p-4 opacity-[0.02] font-black text-8xl lg:text-9xl select-none leading-none pointer-events-none">T</div>
                        
                        <div className="flex border-b border-[#D1D5DB] bg-[#F9FAFB] shrink-0 relative z-10 w-full p-4 justify-between items-center shadow-sm">
                          <h2 className="font-mono text-xs uppercase tracking-widest flex items-center gap-2 font-bold text-[#111827]">
                             <FileText size={16} /> Ticket de Cotización
                          </h2>
                          {ticketItems.length > 0 && <span className="bg-[#059669] text-white px-3 py-1 rounded-full text-[10px] font-bold shadow-sm">{ticketItems.length} items</span>}
                       </div>
                       
                       <div className="flex flex-col h-full overflow-y-auto p-4 lg:p-6 bg-white">
                           <div className="flex flex-col h-full animate-in fade-in duration-300">
                                
                                <div className="flex flex-col gap-4 border-b border-[#D1D5DB] pb-4 mb-4 shrink-0 transition-colors bg-[#F9FAFB] p-4 rounded-xl border">
                                  <div className="flex items-center gap-4 focus-within:border-[#059669]">
                                    <User className="text-[#059669] opacity-80 shrink-0" size={18} />
                                    <div className="flex flex-col w-full">
                                       <label className="text-[9px] uppercase font-mono opacity-60">Asesor / Responsable de Proyecto</label>
                                       <input 
                                         type="text" 
                                         value={operatorName} 
                                         onChange={e => setOperatorName(e.target.value)} 
                                         placeholder="Ej. Ing. Carlos Pérez" 
                                         className="bg-transparent font-bold text-sm lg:text-base w-full outline-none placeholder:opacity-40 text-[#111827] mt-[2px] border-b border-transparent focus:border-[#059669]/50 transition-colors"
                                       />
                                    </div>
                                  </div>
                                  
                                  <div className="flex items-center gap-4 focus-within:border-[#059669]">
                                    <User className="text-blue-500 opacity-80 shrink-0" size={18} />
                                    <div className="flex flex-col w-full">
                                       <label className="text-[9px] uppercase font-mono opacity-60">Cliente / Proyecto (Opcional)</label>
                                       <input 
                                         type="text" 
                                         value={clientName} 
                                         onChange={e => setClientName(e.target.value)} 
                                         placeholder="Nombre del cliente o proyecto" 
                                         className="bg-transparent font-bold text-sm lg:text-base w-full outline-none placeholder:opacity-40 text-[#111827] mt-[2px] border-b border-transparent focus:border-blue-500/50 transition-colors"
                                       />
                                    </div>
                                  </div>

                                  <div className="flex flex-col w-full pl-[34px]">
                                    <button onClick={() => setShowNotesForm(!showNotesForm)} className="flex items-center gap-1.5 text-[10px] font-mono uppercase text-[#6B7280] hover:text-[#111827] transition-colors self-start mb-2 font-bold bg-white px-2 py-1 border border-[#D1D5DB] rounded shadow-sm">
                                       {showNotesForm ? <ChevronUp size={12} /> : <ChevronDown size={12} />} 
                                       {showNotesForm ? 'Ocultar notas' : 'Añadir notas...'}
                                    </button>
                                    {showNotesForm && (
                                      <textarea 
                                        value={notes}
                                        onChange={e => setNotes(e.target.value)}
                                        placeholder="Comentarios adicionales o registro interno..."
                                        className="bg-white border border-[#D1D5DB] p-3 text-xs font-sans outline-none focus:border-[#059669] resize-none h-20 w-full rounded shadow-inner"
                                      />
                                    )}
                                  </div>
                                </div>

                                <div className="flex-grow overflow-y-auto pr-2 space-y-3 pb-8">
                                  {ticketItems.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center opacity-30 h-full gap-2 p-8 border-2 border-dashed border-[#D1D5DB] bg-[#F9FAFB] rounded-xl text-center">
                                      <FileText size={32} />
                                      <span className="text-[10px] lg:text-xs font-mono uppercase">Ticket Vacío<br/>Añade piezas desde la calculadora</span>
                                    </div>
                                  ) : (
                                    <>
                                      {ticketItems.map((item, idx) => (
                                        <div key={idx} className="border border-[#D1D5DB] bg-white p-3 lg:p-4 flex flex-col gap-2 relative group hover:border-[#374151] transition-colors shadow-sm rounded-lg overflow-hidden">
                                           <div className="absolute right-0 top-0 h-full w-1 bg-[#059669]"></div>
                                           <div className="flex justify-between items-start">
                                              <div className="flex flex-col">
                                                <span className="font-bold text-sm lg:text-base text-[#111827]">{item.name}</span>
                                                <span className="text-[9px] lg:text-[10px] font-mono uppercase opacity-60 text-emerald-800 font-bold">{item.profileName} - {item.weight}g</span>
                                              </div>
                                              <button onClick={() => setTicketItems(ticketItems.filter((_, i) => i !== idx))} className="text-red-500 opacity-50 hover:opacity-100 hover:bg-red-50 p-1.5 rounded transition-all cursor-pointer">
                                                <Trash2 size={14}/>
                                              </button>
                                           </div>
                                           <div className="flex justify-between items-end mt-1 lg:mt-2">
                                              <span className="text-[9px] lg:text-[10px] opacity-50 bg-[#F3F4F6] px-2 py-1 rounded">Cant: 1</span>
                                              <span className="font-black text-[#059669] text-base lg:text-lg">{formatMXN(item.totalPrice)}</span>
                                           </div>
                                        </div>
                                      ))}
                                      
                                      <div className="mt-8 border-2 border-[#D1D5DB] bg-[#F9FAFB] p-4 lg:p-6 shadow-sm rounded-xl">
                                        <div className="flex flex-col gap-2 border-b border-[#D1D5DB] pb-3 mb-3">
                                          <div className="flex justify-between text-xs opacity-70"><span>Total Costo Fijo</span><span>{formatMXN(totals.cost)}</span></div>
                                          <div className="flex justify-between text-xs opacity-70"><span>Ganancia Neta</span><span className="text-[#059669]">+{formatMXN(totals.profit)}</span></div>
                                        </div>
                                        <div className="flex justify-between items-end">
                                          <div className="flex flex-col">
                                            <span className="text-[9px] lg:text-[10px] uppercase font-mono tracking-widest opacity-50 mb-1">Total Facturable</span>
                                            <span className="text-2xl lg:text-4xl font-black text-[#111827] leading-none drop-shadow-sm">{formatMXN(totals.total)}</span>
                                          </div>
                                        </div>
                                      </div>

                                      <div className="mt-4 flex flex-col gap-2 shrink-0">
                                          <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
                                            <button onClick={handleSaveQuoteToHistory} className={\`w-full font-black px-4 lg:px-6 py-4 uppercase text-[9px] lg:text-[10px] tracking-widest border-2 transition-all transform active:scale-95 cursor-pointer flex justify-center items-center gap-2 \${savedQuoteId ? 'bg-[#E5E7EB] text-[#111827] border-[#D1D5DB]' : 'bg-white text-[#374151] border-[#374151] hover:bg-[#374151] hover:text-white'}\`}>
                                              {savedQuoteId ? <><Save size={16}/> ACTUALIZAR</> : <><Save size={16}/> GUARDAR EN HISTORIAL</>}
                                            </button>
                                            <button onClick={handleCopyClientTicket} className={\`w-full font-black px-4 py-4 uppercase text-[10px] tracking-widest border-2 transition-all transform active:scale-95 cursor-pointer flex justify-center items-center gap-2 \${copiedStates['client'] ? 'bg-[#374151] text-white border-[#374151]' : 'bg-transparent text-[#374151] border-[#374151]/50 hover:border-[#374151] hover:bg-slate-50'}\`} title="Copiar Formato MD">
                                              {copiedStates['client'] ? <Check size={16} /> : <FileText size={16}/>} .MD
                                            </button>
                                          </div>
                                          
                                          <button onClick={handleGeneratePDF} className="w-full bg-[#111827] text-white font-black px-4 lg:px-6 py-4 uppercase text-xs tracking-widest border-2 border-[#111827] transition-all flex justify-center items-center gap-2 cursor-pointer hover:bg-[#059669] hover:border-[#059669] shadow-lg hover:shadow-xl transform active:scale-95">
                                            <Download size={16}/> EXPORTAR COTIZACIÓN (PDF)
                                          </button>
                                          <button onClick={handleGenerateShareableLink} className={\`w-full font-black px-4 lg:px-6 py-3 uppercase text-[10px] border-2 transition-all cursor-pointer flex justify-center items-center gap-2 \${copiedStates['link'] ? 'bg-[#374151] text-white border-[#374151]' : 'border-[#D1D5DB] bg-white text-[#374151] hover:bg-[#F3F4F6]'}\`}>
                                            <LinkIcon size={14}/> {copiedStates['link'] ? 'ENLACE GENERADO' : 'GENERAR ENLACE CLIENTE'}
                                          </button>
                                      </div>
                                    </>
                                  )}
                                </div>
                            </div>
                       </div>
                    </section>
                </>
            )}
`;

content = content.replace(targetStr.split('</main>')[0], newColumnsHTML);

fs.writeFileSync('src/App.tsx', content);
