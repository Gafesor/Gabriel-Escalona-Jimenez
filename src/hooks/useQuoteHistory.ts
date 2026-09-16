import { useState, useCallback, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  getDoc,
  runTransaction 
} from 'firebase/firestore';

export type QuoteStatus =
  | 'borrador'
  | 'enviada'
  | 'revision'
  | 'aprobada'
  | 'produccion'
  | 'entregada'
  | 'cancelada';

export interface TicketItem {
  id: string;
  itemName: string;
  quantity: number;
  profileName: string;
  weightInfo: number;
  timeInfo: number;
  unitCost: number;     // Inversión de taller
  totalCost: number;    // Inversión de taller
  unitPrice: number;    // Precio de venta
  totalPrice: number;   // Precio de venta
  itemType?: 'print' | 'hardware';
  profileId?: string;
  laborInfo?: number;
}

export interface StatusEvent {
  from: QuoteStatus | null;
  to: QuoteStatus;
  changedBy: string;
  changedAt: string;
  note?: string;
}

export interface Quote {
  id: string;
  folio: string;
  ownerId: string;
  clientName: string;
  operatorName: string;
  status: QuoteStatus;
  total: number;
  globalMargin?: number;
  items: TicketItem[];
  createdAt: string;
  updatedAt: string;
  statusHistory: StatusEvent[];
  notes: string;
  isArchived: boolean;
}

export class QuoteNotFoundError extends Error {
  readonly code = 'QUOTE_NOT_FOUND' as const;

  constructor(id: string) {
    super(`No se encontró la cotización con id: ${id}`);
    this.name = 'QuoteNotFoundError';
  }
}

export const useQuoteHistory = () => {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'quotes'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedQuotes: Quote[] = [];
      snapshot.forEach(docSnap => {
        fetchedQuotes.push(docSnap.data() as Quote);
      });
      fetchedQuotes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setQuotes(fetchedQuotes);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'quotes');
    });

    return () => unsubscribe();
  }, []);

  const getNextFolio = useCallback(async (): Promise<string> => {
    const counterRef = doc(db, 'counters', 'folio');
    const nextCounter = await runTransaction(db, async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      let currentVal = 0;
      if (counterDoc.exists()) {
        const data = counterDoc.data();
        if (typeof data.current === 'number' && Number.isFinite(data.current)) {
          currentVal = Math.floor(data.current);
        }
      }
      const nextVal = currentVal + 1;
      transaction.set(counterRef, { current: nextVal }, { merge: true });
      return nextVal;
    });

    const year = new Date().getFullYear();
    const sequencePadded = String(nextCounter).padStart(4, '0');
    return `CUB-${year}-${sequencePadded}`;
  }, []);

  const saveQuoteSafe = useCallback(async (
    items: TicketItem[], 
    operatorName: string, 
    clientName: string, 
    notes: string, 
    globalMargin: number, 
    existingId?: string
  ): Promise<Quote> => {
    const total = items.reduce((acc, it) => acc + it.totalPrice, 0);
    const now = new Date().toISOString();
    
    if (existingId) {
      const quoteDocRef = doc(db, 'quotes', existingId);
      const snap = await getDoc(quoteDocRef);
      
      if (!snap.exists()) {
        throw new QuoteNotFoundError(existingId);
      }

      const existingData = snap.data() as Quote;
      const updatedQuote: Quote = {
        ...existingData,
        items,
        operatorName,
        clientName,
        notes,
        total,
        globalMargin,
        updatedAt: now
      };

      try {
        await updateDoc(quoteDocRef, {
          items, 
          operatorName, 
          clientName, 
          notes, 
          total, 
          globalMargin, 
          updatedAt: now
        });
      } catch (e) {
        handleFirestoreError(e, OperationType.UPDATE, `quotes/${existingId}`);
      }

      return updatedQuote;
    }
    
    // Solo crea documento nuevo cuando existingId venga undefined
    const folio = await getNextFolio();
    const newId = Date.now().toString() + Math.random().toString(36).substring(2, 9);
    const finalQuote: Quote = {
      id: newId,
      ownerId: "public",
      folio,
      clientName,
      operatorName,
      status: 'borrador',
      total,
      globalMargin,
      items,
      createdAt: now,
      updatedAt: now,
      statusHistory: [],
      notes,
      isArchived: false,
    };
    
    try {
      await setDoc(doc(db, 'quotes', newId), finalQuote);
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, `quotes/${newId}`);
    }
    
    return finalQuote;
  }, [getNextFolio]);

  const updateStatus = useCallback(async (
    quoteId: string, 
    newStatus: QuoteStatus, 
    note?: string, 
    operatorName?: string
  ): Promise<void> => {
    const quoteDocRef = doc(db, 'quotes', quoteId);
    const snap = await getDoc(quoteDocRef);
    if (!snap.exists()) {
      throw new QuoteNotFoundError(quoteId);
    }

    const q = snap.data() as Quote;
    const now = new Date().toISOString();
    const statusEvent: StatusEvent = {
      from: q.status,
      to: newStatus,
      changedBy: operatorName || q.operatorName,
      changedAt: now,
      note
    };
    
    try {
      await updateDoc(quoteDocRef, {
        status: newStatus,
        updatedAt: now,
        statusHistory: [statusEvent, ...q.statusHistory]
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `quotes/${quoteId}`);
    }
  }, []);

  const updateNotes = useCallback(async (quoteId: string, newNotes: string): Promise<void> => {
    try {
      await updateDoc(doc(db, 'quotes', quoteId), {
        notes: newNotes,
        updatedAt: new Date().toISOString()
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `quotes/${quoteId}`);
    }
  }, []);

  const archiveQuote = useCallback(async (quoteId: string): Promise<void> => {
    const quoteDocRef = doc(db, 'quotes', quoteId);
    const snap = await getDoc(quoteDocRef);
    if (!snap.exists()) {
      throw new QuoteNotFoundError(quoteId);
    }

    const q = snap.data() as Quote;
    try {
      await updateDoc(quoteDocRef, {
        isArchived: !q.isArchived,
        updatedAt: new Date().toISOString()
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `quotes/${quoteId}`);
    }
  }, []);

  const deleteQuote = useCallback(async (quoteId: string): Promise<void> => {
    const quoteDocRef = doc(db, 'quotes', quoteId);
    const snap = await getDoc(quoteDocRef);
    if (!snap.exists()) {
      throw new QuoteNotFoundError(quoteId);
    }

    const q = snap.data() as Quote;
    if (q.status !== 'borrador' && !q.isArchived) {
      throw new Error("Solo puedes eliminar borradores o cotizaciones archivadas. Archiva primero esta cotización.");
    }
    
    try {
      await deleteDoc(quoteDocRef);
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `quotes/${quoteId}`);
    }
  }, []);

  const cloneQuote = useCallback(async (quoteId: string): Promise<Quote> => {
    const quoteDocRef = doc(db, 'quotes', quoteId);
    const snap = await getDoc(quoteDocRef);
    if (!snap.exists()) {
      throw new QuoteNotFoundError(quoteId);
    }

    const original = snap.data() as Quote;
    const now = new Date().toISOString();
    const newId = Date.now().toString() + Math.random().toString(36).substring(2, 9);
    const folio = await getNextFolio();
    const cloned: Quote = {
      id: newId,
      ownerId: "public",
      folio,
      clientName: original.clientName ? `${original.clientName} (Copia)` : 'Copia',
      operatorName: original.operatorName,
      status: 'borrador',
      total: original.total,
      globalMargin: typeof original.globalMargin === 'number' && Number.isFinite(original.globalMargin)
        ? original.globalMargin 
        : 30,
      items: original.items,
      createdAt: now,
      updatedAt: now,
      statusHistory: [],
      notes: original.notes,
      isArchived: false,
    };
    
    try {
      await setDoc(doc(db, 'quotes', newId), cloned);
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, `quotes/${newId}`);
    }
    return cloned;
  }, [getNextFolio]);

  return {
    quotes,
    saveQuote: saveQuoteSafe,
    updateStatus,
    updateNotes,
    archiveQuote,
    deleteQuote,
    cloneQuote,
    loading
  };
};
