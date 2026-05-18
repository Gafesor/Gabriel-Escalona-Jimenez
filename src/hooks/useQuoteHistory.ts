import { useState, useCallback, useEffect } from 'react';
import { db, handleFirestoreError, OperationType, auth } from '../lib/firebase';
import { collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, query, where, orderBy, getDocs } from 'firebase/firestore';

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
  unitPrice: number;
  totalPrice: number;
  itemType?: 'print' | 'hardware';
  profileId?: string;
  marginInfo?: number;
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
  items: TicketItem[];
  createdAt: string;
  updatedAt: string;
  statusHistory: StatusEvent[];
  notes: string;
  isArchived: boolean;
}

export const useQuoteHistory = () => {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'quotes'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedQuotes: Quote[] = [];
      snapshot.forEach(doc => {
        fetchedQuotes.push(doc.data() as Quote);
      });
      // Sort in memory by descending date
      fetchedQuotes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setQuotes(fetchedQuotes);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'quotes');
    });

    return () => unsubscribe();
  }, []);

  const getNextFolio = useCallback(() => {
    let counter = parseInt(localStorage.getItem('cubeup3-folio-counter') || '0', 10);
    counter += 1;
    localStorage.setItem('cubeup3-folio-counter', counter.toString());
    return 'CUB-' + counter.toString().padStart(5, '0');
  }, []);

  const saveQuoteSafe = useCallback(async (items: TicketItem[], operatorName: string, clientName: string, notes: string, existingId?: string): Promise<Quote> => {
    const total = items.reduce((acc, it) => acc + it.totalPrice, 0);
    const now = new Date().toISOString();
    
    if (existingId) {
      const existing = quotes.find(q => q.id === existingId);
      if (existing) {
        const updatedQuote: Quote = {
          ...existing,
          items,
          operatorName,
          clientName,
          notes,
          total,
          updatedAt: now
        };
        try {
          await updateDoc(doc(db, 'quotes', existingId), {
             items, operatorName, clientName, notes, total, updatedAt: now
          });
        } catch(e) {
          handleFirestoreError(e, OperationType.UPDATE, `quotes/${existingId}`);
        }
        return updatedQuote;
      }
    }
    
    const newId = Date.now().toString() + Math.random().toString(36).substring(2, 9);
    const finalQuote: Quote = {
      id: newId,
      ownerId: "public",
      folio: getNextFolio(),
      clientName,
      operatorName,
      status: 'borrador',
      total,
      items,
      createdAt: now,
      updatedAt: now,
      statusHistory: [],
      notes,
      isArchived: false,
    };
    
    try {
      await setDoc(doc(db, 'quotes', newId), finalQuote);
    } catch(e) {
       handleFirestoreError(e, OperationType.CREATE, `quotes/${newId}`);
    }
    
    return finalQuote;
  }, [quotes, getNextFolio]);


  const updateStatus = useCallback(async (quoteId: string, newStatus: QuoteStatus, note?: string, operatorName?: string) => {
      const q = quotes.find(q => q.id === quoteId);
      if (!q) return;
      const now = new Date().toISOString();
      const statusEvent: StatusEvent = {
        from: q.status,
        to: newStatus,
        changedBy: operatorName || q.operatorName,
        changedAt: now,
        note
      };
      
      try {
        await updateDoc(doc(db, 'quotes', quoteId), {
           status: newStatus,
           updatedAt: now,
           statusHistory: [statusEvent, ...q.statusHistory]
        });
      } catch(e) {
        handleFirestoreError(e, OperationType.UPDATE, `quotes/${quoteId}`);
      }
  }, [quotes]);

  const updateNotes = useCallback(async (quoteId: string, newNotes: string) => {
      try {
        await updateDoc(doc(db, 'quotes', quoteId), {
          notes: newNotes,
          updatedAt: new Date().toISOString()
        });
      } catch(e) {
        handleFirestoreError(e, OperationType.UPDATE, `quotes/${quoteId}`);
      }
  }, []);

  const archiveQuote = useCallback(async (quoteId: string) => {
      const q = quotes.find(q => q.id === quoteId);
      if (!q) return;
      try {
        await updateDoc(doc(db, 'quotes', quoteId), {
           isArchived: !q.isArchived,
           updatedAt: new Date().toISOString()
        });
      } catch(e) {
        handleFirestoreError(e, OperationType.UPDATE, `quotes/${quoteId}`);
      }
  }, [quotes]);

  const deleteQuote = useCallback(async (quoteId: string) => {
    const q = quotes.find(q => q.id === quoteId);
    if (!q) return;
    
    if (q.status !== 'borrador' && !q.isArchived) {
      throw new Error("Solo puedes eliminar borradores o cotizaciones archivadas. Archiva primero esta cotización.");
    }
    
    try {
      await deleteDoc(doc(db, 'quotes', quoteId));
    } catch(e) {
      handleFirestoreError(e, OperationType.DELETE, `quotes/${quoteId}`);
    }
  }, [quotes]);

  const cloneQuote = useCallback(async (quoteId: string): Promise<Quote | null> => {
    const original = quotes.find(q => q.id === quoteId);
    if (!original) return null;
    
    const now = new Date().toISOString();
    const newId = Date.now().toString() + Math.random().toString(36).substring(2, 9);
    const cloned: Quote = {
      id: newId,
      ownerId: "public",
      folio: getNextFolio(),
      clientName: original.clientName + ' (Copia)',
      operatorName: original.operatorName,
      status: 'borrador',
      total: original.total,
      items: original.items,
      createdAt: now,
      updatedAt: now,
      statusHistory: [],
      notes: original.notes,
      isArchived: false,
    };
    
    try {
      await setDoc(doc(db, 'quotes', newId), cloned);
    } catch(e) {
      handleFirestoreError(e, OperationType.CREATE, `quotes/${newId}`);
    }
    return cloned;
  }, [quotes, getNextFolio]);

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
