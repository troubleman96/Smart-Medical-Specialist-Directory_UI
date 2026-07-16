import { useEffect, useRef } from "react";
import L from "leaflet";

// Fix default icon paths
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

export function LocationPicker({
  value,
  onChange,
  height = 260,
  interactive = true,
}: {
  value: { lat: number; lng: number };
  onChange?: (c: { lat: number; lng: number }) => void;
  height?: number;
  interactive?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = L.map(ref.current, {
      dragging: interactive,
      scrollWheelZoom: interactive,
      doubleClickZoom: interactive,
    }).setView([value.lat, value.lng], 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);
    const marker = L.marker([value.lat, value.lng], { draggable: interactive }).addTo(map);
    if (interactive && onChange) {
      map.on("click", (e) => {
        marker.setLatLng(e.latlng);
        onChange({ lat: e.latlng.lat, lng: e.latlng.lng });
      });
      marker.on("dragend", () => {
        const p = marker.getLatLng();
        onChange({ lat: p.lat, lng: p.lng });
      });
    }
    mapRef.current = map;
    markerRef.current = marker;
    return () => { map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (markerRef.current && mapRef.current) {
      markerRef.current.setLatLng([value.lat, value.lng]);
    }
  }, [value.lat, value.lng]);

  return <div ref={ref} style={{ height, width: "100%" }} />;
}
