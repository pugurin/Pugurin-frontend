import type { BBox, Marker, Property } from "../api/types";
export type Camera = { lat: number; lng: number; zoom: number; bbox: BBox };
export type MapCommand =
  | { type: "move"; lat?: number; lng?: number; zoom?: number; bbox?: BBox }
  | { type: "zoom"; delta: number };
export type MapEvent =
  | { type: "camera"; lat: number; lng: number; zoom: number; bbox: BBox }
  | { type: "marker"; id: string }
  | { type: "ready" }
  | { type: "mapClick" }
  | { type: "error"; message: string };
export type MapProps = {
  markers: Marker[];
  property: Property;
  selected: string | null;
  unit: "평" | "㎡";
  base: "normal" | "satellite";
  cadastral: boolean;
  initial: Camera;
  command?: MapCommand & { nonce: number };
  onEvent: (e: MapEvent) => void;
};
