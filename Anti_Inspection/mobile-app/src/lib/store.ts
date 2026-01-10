import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AppMode, Marker } from './types';

interface AppState {
    mode: AppMode;
    setMode: (mode: AppMode) => void;

    markers: Marker[];
    addMarker: (marker: Marker) => void;
    removeMarker: (id: number) => void;

    activeMarkerId: number | null;
    setActiveMarkerId: (id: number | null) => void;
    updateMarker: (id: number, data: Partial<Marker>) => void;
}

export const useAppStore = create<AppState>()(
    persist(
        (set) => ({
            mode: "INSPECT",
            setMode: (mode) => set({ mode }),

            markers: [],
            addMarker: (marker) => set((state) => ({
                markers: [...state.markers, marker],
                activeMarkerId: marker.id
            })),
            removeMarker: (id) => set((state) => ({ markers: state.markers.filter(m => m.id !== id) })),

            activeMarkerId: null,
            setActiveMarkerId: (id) => set({ activeMarkerId: id }),

            updateMarker: (id, data) => set((state) => ({
                markers: state.markers.map(m => m.id === id ? { ...m, ...data } : m)
            }))
        }),
        {
            name: 'app-storage',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({ markers: state.markers }),
        }
    )
);
