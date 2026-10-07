import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  TallerConfig, 
  DEFAULT_TALLER_CONFIG, 
  sanitizeConfig 
} from '../lib/tallerConfig';

const LOCAL_STORAGE_KEY = 'cubeup3-taller-config';
const SETTINGS_COLLECTION = 'settings';
const SETTINGS_DOC_ID = 'taller';

export interface UseTallerConfigReturn {
  config: TallerConfig;
  loading: boolean;
  guardar: (nuevaConfig: Partial<TallerConfig>, updatedBy?: string) => Promise<void>;
  restaurarDefaults: () => Promise<void>;
}

/**
 * Hook para la configuración global del taller (TallerConfig).
 * Fuente de verdad: Documento Firestore settings/taller con escucha en tiempo real onSnapshot.
 * Caché local: localStorage 'cubeup3-taller-config' para permitir arranque offline o inmediato.
 */
export function useTallerConfig(): UseTallerConfigReturn {
  // Inicializar con caché local o con defaults garantizados
  const [config, setConfig] = useState<TallerConfig>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (cached) {
          return sanitizeConfig(JSON.parse(cached));
        }
      } catch (e) {
        console.warn('[useTallerConfig] Error leyendo caché local:', e);
      }
    }
    return DEFAULT_TALLER_CONFIG;
  });

  const [loading, setLoading] = useState<boolean>(true);
  const isInitialSyncRef = useRef<boolean>(true);

  // Guardar en caché local cuando el estado cambie
  const updateLocalCache = useCallback((cfg: TallerConfig) => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cfg));
      }
    } catch (err) {
      console.warn('[useTallerConfig] Error guardando en localStorage:', err);
    }
  }, []);

  // Suscripción onSnapshot al documento settings/taller
  useEffect(() => {
    const docRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID);

    const unsubscribe = onSnapshot(
      docRef,
      async (snapshot) => {
        if (snapshot.exists()) {
          const sanitized = sanitizeConfig(snapshot.data());
          setConfig(sanitized);
          updateLocalCache(sanitized);
          setLoading(false);
          isInitialSyncRef.current = false;
        } else {
          // El documento aún no existe en Firestore; inicializar con los defaults saneados
          try {
            const initialConfig = sanitizeConfig(DEFAULT_TALLER_CONFIG);
            await setDoc(docRef, cleanForFirestore(initialConfig));
            setConfig(initialConfig);
            updateLocalCache(initialConfig);
          } catch (initErr) {
            console.warn('[useTallerConfig] No se pudo inicializar settings/taller en Firestore:', initErr);
          } finally {
            setLoading(false);
            isInitialSyncRef.current = false;
          }
        }
      },
      (error) => {
        console.error('[useTallerConfig] Error en onSnapshot settings/taller:', error);
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [updateLocalCache]);

  /**
   * Guarda y propaga la configuración hacia Firestore y local.
   * Filtra undefineds y sanea completamente los tipos.
   */
  const guardar = useCallback(async (
    nuevaConfig: Partial<TallerConfig>,
    updatedBy: string = 'Operador'
  ): Promise<void> => {
    const merged = {
      ...config,
      ...nuevaConfig,
      updatedAt: new Date().toISOString(),
      updatedBy: updatedBy || config.updatedBy || 'Operador'
    };

    const sanitized = sanitizeConfig(merged);

    // Optimistic update
    setConfig(sanitized);
    updateLocalCache(sanitized);

    const docRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID);
    const firestoreData = cleanForFirestore(sanitized);

    try {
      await setDoc(docRef, firestoreData, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `${SETTINGS_COLLECTION}/${SETTINGS_DOC_ID}`);
    }
  }, [config, updateLocalCache]);

  /**
   * Restaura la configuración a los valores por defecto del taller CubeUp³.
   */
  const restaurarDefaults = useCallback(async (): Promise<void> => {
    await guardar(DEFAULT_TALLER_CONFIG, 'Sistema (Reset Defaults)');
  }, [guardar]);

  return {
    config,
    loading,
    guardar,
    restaurarDefaults
  };
}

/**
 * Elimina undefineds y normaliza objetos antes de enviar a Firestore,
 * ya que Firebase rechaza explícitamente llaves con valor undefined.
 */
function cleanForFirestore(obj: unknown): Record<string, unknown> {
  if (obj === null || typeof obj !== 'object') {
    return {};
  }
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) {
      continue;
    }
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = cleanForFirestore(value);
    } else if (Array.isArray(value)) {
      result[key] = value.map(item => {
        if (item !== null && typeof item === 'object') {
          return cleanForFirestore(item);
        }
        return item;
      });
    } else {
      result[key] = value;
    }
  }

  return result;
}
