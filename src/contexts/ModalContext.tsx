'use client';

/**
 * ModalContext
 *
 * Global state for tracking modal/popup visibility
 * Used to control header position (fixed vs sticky)
 *
 * Uses Set-based tracking to support multiple modals simultaneously
 */

import { createContext, useContext, useState, ReactNode, useCallback, useMemo } from 'react';

interface ModalContextType {
  isModalOpen: boolean;
  openModal: (id: string) => void;
  closeModal: (id: string) => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [openModals, setOpenModals] = useState<Set<string>>(new Set());

  const openModal = useCallback((id: string) => {
    setOpenModals((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const closeModal = useCallback((id: string) => {
    setOpenModals((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const isModalOpen = openModals.size > 0;

  const value = useMemo(
    () => ({
      isModalOpen,
      openModal,
      closeModal,
    }),
    [isModalOpen, openModal, closeModal]
  );

  return (
    <ModalContext.Provider value={value}>
      {children}
    </ModalContext.Provider>
  );
}

export function useModal() {
  const context = useContext(ModalContext);
  if (context === undefined) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
}
