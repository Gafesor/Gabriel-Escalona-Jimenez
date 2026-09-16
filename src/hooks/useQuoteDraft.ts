/**
 * CubeUp³ — Hook de Cotización en Curso (useQuoteDraft)
 * 
 * Gestiona el estado reactivo del borrador de cotización en curso:
 * - Items en el ticket (impresión y hardware/accesorios)
 * - Metadatos (cliente, operador, margen global)
 * - Acciones sobre partidas (agregar, editar, duplicar, eliminar, reordenar)
 * - Autosave debounced (1.5s) con prevención de pérdidas silenciosas:
 *   `lastSavedStateRef` se actualiza ÚNICAMENTE después de confirmar la escritura en Firestore.
 *   Se desvincula de la colección completa `quotes` para evitar re-ejecuciones espurias.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { TicketItem, Quote } from './useQuoteHistory';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface UseQuoteDraftProps {
  saveQuote: (
    items: TicketItem[],
    operatorName: string,
    clientName: string,
    notes: string,
    globalMargin: number,
    existingId?: string
  ) => Promise<Quote>;
}

export interface UseQuoteDraftReturn {
  ticketItems: TicketItem[];
  savedQuoteId: string | null;
  operatorName: string;
  clientName: string;
  globalMargin: number;
  isSaving: boolean;
  lastSavedAt: Date | null;
  totals: {
    totalVenta: number;
    costoInversion: number;
    utilidad: number;
  };
  setOperatorName: (name: string) => void;
  setClientName: (name: string) => void;
  setGlobalMargin: (margin: number) => void;
  setSavedQuoteId: (id: string | null) => void;
  agregarItem: (item: Omit<TicketItem, 'id'>) => void;
  actualizarItem: (id: string, item: Partial<TicketItem>) => void;
  duplicarItem: (id: string) => void;
  eliminarItem: (id: string) => void;
  reordenarItems: (origenIndex: number, destinoIndex: number) => void;
  cargarBorrador: (quote: Quote) => void;
  limpiarBorrador: () => void;
  guardarManual: () => Promise<Quote | null>;
}

export function useQuoteDraft({ saveQuote }: UseQuoteDraftProps): UseQuoteDraftReturn {
  const [ticketItems, setTicketItems] = useState<TicketItem[]>([]);
  const [savedQuoteId, setSavedQuoteId] = useState<string | null>(null);
  const [operatorName, setOperatorName] = useState<string>('');
  const [clientName, setClientName] = useState<string>('');
  const [globalMargin, setGlobalMargin] = useState<number>(30);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const lastSavedStateRef = useRef<string>('');
  const isMountedRef = useRef<boolean>(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Recalcular precios de venta unitarios y totales al modificar el margen global
  useEffect(() => {
    setTicketItems((prev) =>
      prev.map((item) => {
        const unitPrice = item.unitCost * (1 + globalMargin / 100);
        const totalPrice = item.unitCost * item.quantity * (1 + globalMargin / 100);
        return {
          ...item,
          unitPrice,
          totalPrice
        };
      })
    );
  }, [globalMargin]);

  // ---------------------------------------------------------------------------
  // AUTOSAVE DEBOUNCED (1.5s) CON PROTECCIÓN CONTRA PÉRDIDA SILENCIOSA
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (ticketItems.length === 0) return;

    const currentStateStr = JSON.stringify({
      ticketItems,
      operatorName: operatorName.trim(),
      clientName: clientName.trim(),
      globalMargin
    });

    // Si no ha cambiado respecto a lo que confirmamos en el servidor, no hacer nada
    if (currentStateStr === lastSavedStateRef.current) return;

    const timer = setTimeout(async () => {
      try {
        if (savedQuoteId) {
          // Verificar directamente el estado del documento individual sin escuchar la colección completa
          const docRef = doc(db, 'quotes', savedQuoteId);
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            const data = snap.data();
            // Si la cotización ya fue aprobada, enviada o cancelada, NO sobreescribir como borrador
            if (data.status && data.status !== 'borrador') {
              return;
            }
          }
        }

        setIsSaving(true);
        const saved = await saveQuote(
          ticketItems,
          operatorName,
          clientName,
          '',
          globalMargin,
          savedQuoteId || undefined
        );

        if (isMountedRef.current) {
          // CORRECCIÓN CLAVE: Registrar lastSavedStateRef DESPUÉS de confirmar con éxito el await
          lastSavedStateRef.current = currentStateStr;
          setLastSavedAt(new Date());
          if (!savedQuoteId && saved?.id) {
            setSavedQuoteId(saved.id);
          }
          setIsSaving(false);
        }
      } catch (err) {
        if (isMountedRef.current) {
          setIsSaving(false);
        }
        // Al no actualizar lastSavedStateRef, el próximo cambio o intento reintentará guardar
        console.error('Error en autosave de cotización:', err);
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [ticketItems, operatorName, clientName, globalMargin, savedQuoteId, saveQuote]);

  // ---------------------------------------------------------------------------
  // ACCIONES SOBRE PARTIDAS (TICKET ITEMS)
  // ---------------------------------------------------------------------------

  const agregarItem = useCallback((itemData: Omit<TicketItem, 'id'>) => {
    const nuevoItem: TicketItem = {
      ...itemData,
      id: crypto.randomUUID()
    };
    setTicketItems((prev) => [...prev, nuevoItem]);
  }, []);

  const actualizarItem = useCallback((id: string, cambios: Partial<TicketItem>) => {
    setTicketItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...cambios } : item))
    );
  }, []);

  const duplicarItem = useCallback((id: string) => {
    setTicketItems((prev) => {
      const idx = prev.findIndex((i) => i.id === id);
      if (idx === -1) return prev;
      const original = prev[idx];
      const copia: TicketItem = {
        ...original,
        id: crypto.randomUUID(),
        itemName: `${original.itemName} (Copia)`
      };
      const siguiente = [...prev];
      siguiente.splice(idx + 1, 0, copia);
      return siguiente;
    });
  }, []);

  const eliminarItem = useCallback((id: string) => {
    setTicketItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const reordenarItems = useCallback((origenIndex: number, destinoIndex: number) => {
    setTicketItems((prev) => {
      if (
        origenIndex < 0 ||
        origenIndex >= prev.length ||
        destinoIndex < 0 ||
        destinoIndex >= prev.length
      ) {
        return prev;
      }
      const copia = [...prev];
      const [removido] = copia.splice(origenIndex, 1);
      copia.splice(destinoIndex, 0, removido);
      return copia;
    });
  }, []);

  const cargarBorrador = useCallback((quote: Quote) => {
    const margin =
      typeof quote.globalMargin === 'number' && Number.isFinite(quote.globalMargin)
        ? quote.globalMargin
        : 30;

    setTicketItems(quote.items || []);
    setClientName(quote.clientName || '');
    setOperatorName(quote.operatorName || '');
    setGlobalMargin(margin);
    setSavedQuoteId(quote.id);

    // Bloquear autosave redundante inicial
    lastSavedStateRef.current = JSON.stringify({
      ticketItems: quote.items || [],
      operatorName: (quote.operatorName || '').trim(),
      clientName: (quote.clientName || '').trim(),
      globalMargin: margin
    });
  }, []);

  const limpiarBorrador = useCallback(() => {
    setTicketItems([]);
    setSavedQuoteId(null);
    setClientName('');
    lastSavedStateRef.current = '';
  }, []);

  const guardarManual = useCallback(async (): Promise<Quote | null> => {
    if (ticketItems.length === 0) return null;
    setIsSaving(true);
    try {
      const saved = await saveQuote(
        ticketItems,
        operatorName,
        clientName,
        '',
        globalMargin,
        savedQuoteId || undefined
      );
      setSavedQuoteId(saved.id);
      lastSavedStateRef.current = JSON.stringify({
        ticketItems,
        operatorName: operatorName.trim(),
        clientName: clientName.trim(),
        globalMargin
      });
      setLastSavedAt(new Date());
      setIsSaving(false);
      return saved;
    } catch (e) {
      setIsSaving(false);
      console.error('Error al guardar cotización manualmente:', e);
      throw e;
    }
  }, [ticketItems, operatorName, clientName, globalMargin, savedQuoteId, saveQuote]);

  // Cálculos consolidados de totales
  const totals = useMemo(() => {
    const totalVenta = ticketItems.reduce((acc, i) => acc + (i.totalPrice || 0), 0);
    const costoInversion = ticketItems.reduce((acc, i) => acc + (i.totalCost || 0), 0);
    const utilidad = totalVenta - costoInversion;
    return {
      totalVenta,
      costoInversion,
      utilidad
    };
  }, [ticketItems]);

  return {
    ticketItems,
    savedQuoteId,
    operatorName,
    clientName,
    globalMargin,
    isSaving,
    lastSavedAt,
    totals,
    setOperatorName,
    setClientName,
    setGlobalMargin,
    setSavedQuoteId,
    agregarItem,
    actualizarItem,
    duplicarItem,
    eliminarItem,
    reordenarItems,
    cargarBorrador,
    limpiarBorrador,
    guardarManual
  };
}
