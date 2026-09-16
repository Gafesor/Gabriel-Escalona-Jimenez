/**
 * CubeUp³ — Hook Genérico de Catálogos (useCatalog)
 * 
 * Gestiona colecciones sincronizadas en tiempo real con Firestore para entidades de catálogo:
 * Materiales, Impresoras, Consumibles, Presets, Postprocesos y Clientes.
 * 
 * Características:
 * 1. Suscripción en tiempo real con onSnapshot filtrada por orgId y limitada a 200 registros.
 * 2. Soft-delete (archivar / desarchivar) preservando integridad en cotizaciones pasadas.
 * 3. Eliminación definitiva con auditoría de referencias en cotizaciones (impide borrar si se usa en folios).
 * 4. Escritura optimista con rollback inmediato si Firestore rechaza.
 * 5. Migración transparente de una sola vez desde 'cubeup3-custom-profiles' y 'cubeup3-custom-operators'.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  limit,
  getDocs
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { BaseCatalogEntity } from '../types/domain';

export interface UseCatalogReturn<T extends BaseCatalogEntity> {
  items: T[];
  activos: T[];
  archivados: T[];
  loading: boolean;
  error: string | null;
  crear: (item: Omit<T, 'id' | 'orgId' | 'createdAt' | 'updatedAt' | 'archivedAt'>) => Promise<T>;
  actualizar: (id: string, cambios: Partial<Omit<T, 'id' | 'orgId' | 'createdAt'>>) => Promise<void>;
  archivar: (id: string) => Promise<void>;
  desarchivar: (id: string) => Promise<void>;
  eliminarDefinitivo: (id: string) => Promise<{ exito: boolean; foliosQueLoUsan: string[] }>;
  duplicar: (id: string, nuevoNombre?: string) => Promise<T>;
}

// Prefijo organizacional por defecto para CubeUp³
const DEFAULT_ORG_ID = 'cubeup-taller-principal';

// Claves de migración en localStorage
const LEGACY_PROFILES_KEY = 'cubeup3-custom-profiles';
const LEGACY_OPERATORS_KEY = 'cubeup3-custom-operators';
const MIGRATION_FLAG_PROFILES = 'cubeup3-migrated-profiles-to-firestore';
const MIGRATION_FLAG_OPERATORS = 'cubeup3-migrated-operators-to-firestore';

export function useCatalog<T extends BaseCatalogEntity>(
  coleccionNombre: string,
  orgId: string = DEFAULT_ORG_ID
): UseCatalogReturn<T> {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // 1. MIGRACIÓN TRANSPARENTE DE UNA SOLA VEZ (SIN BORRAR LOCALSTORAGE)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    async function ejecutarMigracionLegacy() {
      try {
        if (typeof window === 'undefined') return;

        // Migración de perfiles a la colección 'materials' o similar
        if (coleccionNombre === 'materials') {
          const yaMigrado = localStorage.getItem(MIGRATION_FLAG_PROFILES);
          const rawProfiles = localStorage.getItem(LEGACY_PROFILES_KEY);

          if (!yaMigrado && rawProfiles) {
            const parsed = JSON.parse(rawProfiles);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const ahora = new Date().toISOString();
              for (const p of parsed) {
                const nuevoId = crypto.randomUUID();
                const docRef = doc(db, 'orgs', orgId, coleccionNombre, nuevoId);
                const dataMigrada = {
                  id: nuevoId,
                  orgId,
                  nombre: p.name || 'Material Migrado',
                  marca: 'Genérico',
                  color: 'Estándar',
                  tecnologia: 'FDM',
                  precioPorKg: typeof p.spoolCost === 'number' ? p.spoolCost : 450,
                  diametroMm: 1.75,
                  merma: 0.05,
                  activo: true,
                  createdAt: ahora,
                  updatedAt: ahora,
                  archivedAt: null
                };
                await setDoc(docRef, dataMigrada);
              }
              localStorage.setItem(MIGRATION_FLAG_PROFILES, ahora);
            }
          }
        }

        // Migración de operadores si se consulta la colección de operadores/staff
        if (coleccionNombre === 'operators') {
          const yaMigrado = localStorage.getItem(MIGRATION_FLAG_OPERATORS);
          const rawOperators = localStorage.getItem(LEGACY_OPERATORS_KEY);

          if (!yaMigrado && rawOperators) {
            const parsed = JSON.parse(rawOperators);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const ahora = new Date().toISOString();
              for (const op of parsed) {
                const nuevoId = crypto.randomUUID();
                const docRef = doc(db, 'orgs', orgId, coleccionNombre, nuevoId);
                const dataMigrada = {
                  id: nuevoId,
                  orgId,
                  nombre: typeof op === 'string' ? op : (op.nombre || 'Operador'),
                  tarifaHora: 120,
                  activo: true,
                  createdAt: ahora,
                  updatedAt: ahora,
                  archivedAt: null
                };
                await setDoc(docRef, dataMigrada);
              }
              localStorage.setItem(MIGRATION_FLAG_OPERATORS, ahora);
            }
          }
        }
      } catch (err) {
        console.warn('Advertencia durante migración de datos legacy a Firestore:', err);
      }
    }

    ejecutarMigracionLegacy();
  }, [coleccionNombre, orgId]);

  // ---------------------------------------------------------------------------
  // 2. SUSCRIPCIÓN EN TIEMPO REAL CON FILTRADO Y LÍMITE ESTRICTO
  // ---------------------------------------------------------------------------
  useEffect(() => {
    setLoading(true);
    setError(null);

    const basePath = `orgs/${orgId}/${coleccionNombre}`;
    const colRef = collection(db, 'orgs', orgId, coleccionNombre);

    // Consulta acotada: descarga máxima de 200 entidades activas/archivadas por catálogo
    const q = query(
      colRef,
      where('orgId', '==', orgId),
      limit(200)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docsList: T[] = [];
        snapshot.forEach((d) => {
          docsList.push({ ...d.data(), id: d.id } as T);
        });

        // Ordenamiento por fecha de actualización descendente
        docsList.sort((a, b) => {
          const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
          const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
          return dateB - dateA;
        });

        setItems(docsList);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
        handleFirestoreError(err, OperationType.LIST, basePath);
      }
    );

    return () => unsubscribe();
  }, [coleccionNombre, orgId]);

  // Filtros derivados
  const activos = useMemo(() => items.filter((it) => it.archivedAt === null), [items]);
  const archivados = useMemo(() => items.filter((it) => it.archivedAt !== null), [items]);

  // ---------------------------------------------------------------------------
  // 3. OPERACIONES CRUD CON ESCRITURA OPTIMISTA Y ROLLBACK
  // ---------------------------------------------------------------------------

  const crear = useCallback(
    async (
      nuevoItemData: Omit<T, 'id' | 'orgId' | 'createdAt' | 'updatedAt' | 'archivedAt'>
    ): Promise<T> => {
      const ahora = new Date().toISOString();
      const nuevoId = crypto.randomUUID();

      const itemCompleto = {
        ...nuevoItemData,
        id: nuevoId,
        orgId,
        createdAt: ahora,
        updatedAt: ahora,
        archivedAt: null
      } as unknown as T;

      // Actualización optimista
      setItems((prev) => [itemCompleto, ...prev]);

      try {
        const docRef = doc(db, 'orgs', orgId, coleccionNombre, nuevoId);
        await setDoc(docRef, itemCompleto);
        return itemCompleto;
      } catch (err) {
        // Rollback optimista
        setItems((prev) => prev.filter((it) => it.id !== nuevoId));
        handleFirestoreError(err, OperationType.CREATE, `orgs/${orgId}/${coleccionNombre}/${nuevoId}`);
        throw err;
      }
    },
    [coleccionNombre, orgId]
  );

  const actualizar = useCallback(
    async (
      id: string,
      cambios: Partial<Omit<T, 'id' | 'orgId' | 'createdAt'>>
    ): Promise<void> => {
      const anterior = items.find((it) => it.id === id);
      if (!anterior) {
        throw new Error(`No se encontró el elemento con ID ${id} para actualizar.`);
      }

      const ahora = new Date().toISOString();
      const actualizado: T = {
        ...anterior,
        ...cambios,
        updatedAt: ahora
      };

      // Actualización optimista
      setItems((prev) => prev.map((it) => (it.id === id ? actualizado : it)));

      try {
        const docRef = doc(db, 'orgs', orgId, coleccionNombre, id);
        await updateDoc(docRef, {
          ...cambios,
          updatedAt: ahora
        });
      } catch (err) {
        // Rollback optimista al estado previo
        setItems((prev) => prev.map((it) => (it.id === id ? anterior : it)));
        handleFirestoreError(err, OperationType.UPDATE, `orgs/${orgId}/${coleccionNombre}/${id}`);
        throw err;
      }
    },
    [coleccionNombre, items, orgId]
  );

  const archivar = useCallback(
    async (id: string): Promise<void> => {
      const ahora = new Date().toISOString();
      await actualizar(id, { archivedAt: ahora } as unknown as Partial<Omit<T, 'id' | 'orgId' | 'createdAt'>>);
    },
    [actualizar]
  );

  const desarchivar = useCallback(
    async (id: string): Promise<void> => {
      await actualizar(id, { archivedAt: null } as unknown as Partial<Omit<T, 'id' | 'orgId' | 'createdAt'>>);
    },
    [actualizar]
  );

  const duplicar = useCallback(
    async (id: string, nuevoNombre?: string): Promise<T> => {
      const original = items.find((it) => it.id === id);
      if (!original) {
        throw new Error(`Elemento original ${id} no encontrado para duplicar.`);
      }

      // Clonar propiedades excluyendo llaves de auditoría
      const copiaData = { ...(original as Record<string, unknown>) };
      delete copiaData.id;
      delete copiaData.createdAt;
      delete copiaData.updatedAt;
      delete copiaData.archivedAt;

      if ('nombre' in copiaData && typeof copiaData.nombre === 'string') {
        copiaData.nombre = nuevoNombre || `${copiaData.nombre} (Copia)`;
      }

      return await crear(
        copiaData as unknown as Omit<T, 'id' | 'orgId' | 'createdAt' | 'updatedAt' | 'archivedAt'>
      );
    },
    [items, crear]
  );

  /**
   * Eliminación definitiva con verificación de integridad referencial.
   * Si alguna cotización en 'quotes' referencia este ID, el borrado se bloquea
   * y se devuelve la lista de folios que impiden la eliminación.
   */
  const eliminarDefinitivo = useCallback(
    async (id: string): Promise<{ exito: boolean; foliosQueLoUsan: string[] }> => {
      const path = `orgs/${orgId}/${coleccionNombre}/${id}`;
      const itemABorrar = items.find((it) => it.id === id);

      try {
        // Consultar cotizaciones existentes del taller para buscar referencias al ID
        const quotesRef = collection(db, 'orgs', orgId, 'quotes');
        const qQuotes = query(quotesRef, limit(300));
        const snap = await getDocs(qQuotes);

        const foliosConflictivos: string[] = [];

        snap.forEach((docSnap) => {
          const quoteData = docSnap.data();
          const itemsQuote = Array.isArray(quoteData.items) ? quoteData.items : [];
          const folio = quoteData.folio || docSnap.id;

          // Verificar si algún item referencia este ID (materialId, printerId, presetId, clientId, etc.)
          const tieneReferencia =
            quoteData.clientId === id ||
            itemsQuote.some(
              (item: Record<string, unknown>) =>
                item.materialId === id ||
                item.printerId === id ||
                item.presetId === id ||
                item.id === id
            );

          if (tieneReferencia) {
            foliosConflictivos.push(folio);
          }
        });

        if (foliosConflictivos.length > 0) {
          return {
            exito: false,
            foliosQueLoUsan: foliosConflictivos
          };
        }

        // Si no está referenciado, procedemos al borrado optimista
        if (itemABorrar) {
          setItems((prev) => prev.filter((it) => it.id !== id));
        }

        const docRef = doc(db, 'orgs', orgId, coleccionNombre, id);
        await deleteDoc(docRef);

        return {
          exito: true,
          foliosQueLoUsan: []
        };
      } catch (err) {
        // Rollback si falla la eliminación
        if (itemABorrar) {
          setItems((prev) => [itemABorrar, ...prev]);
        }
        handleFirestoreError(err, OperationType.DELETE, path);
        throw err;
      }
    },
    [coleccionNombre, items, orgId]
  );

  return {
    items,
    activos,
    archivados,
    loading,
    error,
    crear,
    actualizar,
    archivar,
    desarchivar,
    eliminarDefinitivo,
    duplicar
  };
}
