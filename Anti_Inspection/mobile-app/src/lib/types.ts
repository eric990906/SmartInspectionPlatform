export type AppMode = 'INSPECT' | 'REVIEW';

export interface Marker {
    id: number;
    x: number;
    y: number;
    // Data
    photoUrl: string;
    textValue: string;
    drawingData: string;
    createdAt: number;
    // AI Analysis Data
    defectType?: string;
    metrics?: {
        width?: number;
        length?: number;
        area?: number;
        depth?: number;
        count?: number;
    };
}
