export type AppMode = "VIEW" | "CREATION";

export interface Marker {
    id: number;
    x: number;
    y: number;
    // Data
    photoUrl: string;
    textValue: string;
    drawingData: string;
    createdAt: number;
}
