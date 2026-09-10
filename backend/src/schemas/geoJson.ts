export interface GeoJsonPoint {
  type: "Point";
  coordinates: [number, number];
}

export interface GeoJsonPolygon {
  type: "Polygon";
  coordinates: [number, number][][];
}
