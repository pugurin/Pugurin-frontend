import type { Geometry } from "geojson";
import type { SelectionPoint } from "./selection";
import type { UserLocation } from "./userLocation";
import type { Auction, BBox, Marker, Property } from "../api/types";
export type Camera = { lat: number; lng: number; zoom: number; bbox: BBox };
export type MapCommand =
  | { type: "move"; lat?: number; lng?: number; zoom?: number; bbox?: BBox }
  | { type: "zoom"; delta: number };
export type MapEvent =
  | { type: "camera"; lat: number; lng: number; zoom: number; bbox: BBox }
  | { type: "marker"; id: string }
  | { type: "ready" }
  | { type: "mapClick"; lat: number; lng: number }
  | { type: "error"; message: string };
export type MapProps = {
  markers: Marker[];
  // 지도에 올릴 경매 물건. 좌표 없는 물건은 그리지 않는다
  auctions?: Auction[];
  property: Property;
  selected: string | null;
  selectionPoint?: SelectionPoint;
  parcelGeometry?: Geometry | null;
  // 위치 권한을 받아 확인한 내 위치. 없으면 표시하지 않는다
  userLocation?: UserLocation | null;
  unit: "평" | "㎡";
  base: "normal" | "satellite";
  cadastral: boolean;
  initial: Camera;
  command?: MapCommand & { nonce: number };
  onEvent: (e: MapEvent) => void;
  onMarkerHover?: (
    marker: Marker | null,
    point?: { x: number; y: number },
  ) => void;
};
