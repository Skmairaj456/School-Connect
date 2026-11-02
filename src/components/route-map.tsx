"use client";

import { MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip, ZoomControl } from "react-leaflet";
import L from "leaflet";

const route: [number, number][] = [
  [17.4239, 78.4738],
  [17.4262, 78.4781],
  [17.4298, 78.4819],
  [17.4322, 78.486],
  [17.4351, 78.4892],
  [17.4388, 78.4933],
];

const busIcon = L.divIcon({ className: "bus-map-marker", html: '<span class="bus-map-marker-inner">12</span>', iconSize: [34, 34], iconAnchor: [17, 17] });
const stopIcon = L.divIcon({ className: "stop-map-marker", html: "<span></span>", iconSize: [14, 14], iconAnchor: [7, 7] });

export default function RouteMap({ position, compact = false }: { position: [number, number]; compact?: boolean }) {
  return <MapContainer center={position} zoom={14} zoomControl={false} scrollWheelZoom={!compact} className="leaflet-map">
    <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
    <ZoomControl position="bottomright" />
    <Polyline positions={route} pathOptions={{ color: "#14876a", weight: compact ? 4 : 5, opacity: 0.9 }} />
    {route.slice(1).map((stop, index) => <Marker key={index} position={stop} icon={stopIcon}><Tooltip>{["Green Park", "Lake View", "Srinagar Colony", "Banjara Hills", "North Gate"][index]}</Tooltip></Marker>)}
    <Marker position={position} icon={busIcon}><Popup><strong>Bus 12 · Simulated</strong><br />Demo coordinates only</Popup></Marker>
  </MapContainer>;
}