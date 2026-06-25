"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const TILE_LAYERS = {
  standard: {
    label: "Standard",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  light: {
    label: "Luminos",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  voyager: {
    label: "Detaliat",
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
};

function isValidNumber(value) {
  const number = Number(value);
  return !Number.isNaN(number) && Number.isFinite(number);
}

function getLatLng(point) {
  if (!point) {
    return null;
  }

  const lat = Number(point.lat);
  const lng = Number(point.lng ?? point.lon);

  if (!isValidNumber(lat) || !isValidNumber(lng)) {
    return null;
  }

  return [lat, lng];
}

function normalizeRoute(route) {
  if (!Array.isArray(route)) {
    return [];
  }

  return route
    .map((point) => {
      if (Array.isArray(point)) {
        const lat = Number(point[0]);
        const lng = Number(point[1]);

        if (isValidNumber(lat) && isValidNumber(lng)) {
          return [lat, lng];
        }

        return null;
      }

      return getLatLng(point);
    })
    .filter(Boolean);
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function createMarkerIcon(L, type) {
  const markerConfig = {
    restaurant: {
      emoji: "🍕",
      label: "R",
      bgColor: "#f13a01",
    },
    customer: {
      emoji: "🏠",
      label: "C",
      bgColor: "#111827",
    },
  }[type];

  return L.divIcon({
    className: "",
    html: `
      <div style="
        width: 44px;
        height: 44px;
        border-radius: 9999px;
        background: ${markerConfig.bgColor};
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 21px;
        border: 4px solid white;
        box-shadow: 0 16px 34px rgba(15,23,42,0.28);
        position: relative;
      ">
        ${markerConfig.emoji}
        <span style="
          position: absolute;
          right: -4px;
          bottom: -4px;
          width: 18px;
          height: 18px;
          border-radius: 9999px;
          background: white;
          color: ${markerConfig.bgColor};
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: 900;
          border: 1px solid rgba(15,23,42,.08);
        ">${markerConfig.label}</span>
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -22],
  });
}

function buildDirectionsUrl(restaurantPosition, customerPosition) {
  if (!restaurantPosition || !customerPosition) {
    return "";
  }

  const origin = restaurantPosition.join(",");
  const destination = customerPosition.join(",");

  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
    origin
  )}&destination=${encodeURIComponent(destination)}&travelmode=driving`;
}

function formatDistance(distanceKm) {
  const number = Number(distanceKm);

  if (!Number.isFinite(number) || number <= 0) {
    return "—";
  }

  return `${number.toFixed(number >= 10 ? 0 : 1)} km`;
}

function formatMinutes(minutes) {
  const number = Number(minutes);

  if (!Number.isFinite(number) || number <= 0) {
    return "—";
  }

  return `${Math.round(number)} min`;
}

export default function DeliveryRouteMap({
  route,
  restaurant,
  customer,
  distanceKm,
  drivingMinutes,
  estimatedArrival,
}) {
  const mapElementRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const resizeObserverRef = useRef(null);

  const [leafletError, setLeafletError] = useState("");
  const [selectedLayer, setSelectedLayer] = useState("voyager");
  const [expanded, setExpanded] = useState(false);
  const [mapLoading, setMapLoading] = useState(true);

  const routePositions = useMemo(() => normalizeRoute(route), [route]);
  const restaurantPosition = useMemo(() => getLatLng(restaurant), [restaurant]);
  const customerPosition = useMemo(() => getLatLng(customer), [customer]);
  const directionsUrl = useMemo(
    () => buildDirectionsUrl(restaurantPosition, customerPosition),
    [restaurantPosition, customerPosition]
  );

  const mapKey = useMemo(() => {
    const restaurantKey = restaurantPosition
      ? restaurantPosition.join("-")
      : "no-restaurant";

    const customerKey = customerPosition
      ? customerPosition.join("-")
      : "no-customer";

    return `${restaurantKey}-${customerKey}-${routePositions.length}-${selectedLayer}-${expanded}`;
  }, [
    restaurantPosition,
    customerPosition,
    routePositions.length,
    selectedLayer,
    expanded,
  ]);

  useEffect(() => {
    let active = true;
    const timeouts = [];

    function scheduleMapResize(map, boundsPoints) {
      const delays = [80, 250, 650, 1100];

      delays.forEach((delay) => {
        const timeoutId = window.setTimeout(() => {
          if (!active || !map) {
            return;
          }

          map.invalidateSize({ animate: false });

          if (boundsPoints.length >= 2) {
            map.fitBounds(boundsPoints, {
              padding: expanded ? [90, 90] : [55, 55],
              maxZoom: 16,
              animate: false,
            });
          } else if (boundsPoints.length === 1) {
            map.setView(boundsPoints[0], 15, { animate: false });
          }
        }, delay);

        timeouts.push(timeoutId);
      });
    }

    async function initializeMap() {
      try {
        setLeafletError("");
        setMapLoading(true);

        const leafletModule = await import("leaflet");
        const L = leafletModule.default || leafletModule;

        if (!active || !mapElementRef.current) {
          return;
        }

        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        }

        if (resizeObserverRef.current) {
          resizeObserverRef.current.disconnect();
          resizeObserverRef.current = null;
        }

        const fallbackCenter = [45.657975, 25.601198];
        const mapCenter =
          restaurantPosition ||
          customerPosition ||
          routePositions[0] ||
          fallbackCenter;

        const map = L.map(mapElementRef.current, {
          center: mapCenter,
          zoom: 14,
          scrollWheelZoom: false,
          zoomControl: false,
          preferCanvas: true,
        });

        mapInstanceRef.current = map;

        L.control
          .zoom({
            position: "bottomright",
          })
          .addTo(map);

        const layerConfig = TILE_LAYERS[selectedLayer] || TILE_LAYERS.voyager;
        const tileLayer = L.tileLayer(layerConfig.url, {
          maxZoom: 19,
          detectRetina: true,
          attribution: layerConfig.attribution,
        });

        tileLayer.on("load", () => {
          if (active) {
            setMapLoading(false);
          }
        });

        tileLayer.on("tileerror", () => {
          if (active) {
            setMapLoading(false);
          }
        });

        tileLayer.addTo(map);

        const restaurantIcon = createMarkerIcon(L, "restaurant");
        const customerIcon = createMarkerIcon(L, "customer");
        if (routePositions.length > 1) {
          L.polyline(routePositions, {
            color: "#111827",
            weight: 10,
            opacity: 0.22,
            lineCap: "round",
            lineJoin: "round",
          }).addTo(map);

          L.polyline(routePositions, {
            color: "#f13a01",
            weight: 6,
            opacity: 0.95,
            lineCap: "round",
            lineJoin: "round",
          }).addTo(map);
        }

        if (restaurantPosition) {
          L.marker(restaurantPosition, {
            icon: restaurantIcon,
          })
            .addTo(map)
            .bindPopup(
              `
                <strong>Restaurant</strong><br />
                ${escapeHtml(
                  restaurant?.displayName ||
                    restaurant?.address ||
                    "Top Family Pizza"
                )}
              `
            );
        }

        if (customerPosition) {
          const approximateMessage =
            customer?.approximate && customer?.approximationReason
              ? `<br /><br /><span style="color:#ea580c;">${escapeHtml(
                  customer.approximationReason
                )}</span>`
              : "";

          L.marker(customerPosition, {
            icon: customerIcon,
          })
            .addTo(map)
            .bindPopup(
              `
                <strong>Client</strong><br />
                ${escapeHtml(
                  customer?.address || customer?.displayName || "Adresă client"
                )}
                ${approximateMessage}
              `
            );
        }

        const boundsPoints = [];

        if (restaurantPosition) {
          boundsPoints.push(restaurantPosition);
        }

        if (customerPosition) {
          boundsPoints.push(customerPosition);
        }

        if (routePositions.length > 0) {
          boundsPoints.push(...routePositions);
        }

        scheduleMapResize(map, boundsPoints);

        if (typeof ResizeObserver !== "undefined") {
          resizeObserverRef.current = new ResizeObserver(() => {
            if (!active || !mapInstanceRef.current) {
              return;
            }

            mapInstanceRef.current.invalidateSize({ animate: false });
          });

          resizeObserverRef.current.observe(mapElementRef.current);
        }
      } catch (error) {
        console.error("DELIVERY MAP ERROR:", error);

        if (active) {
          setMapLoading(false);
          setLeafletError(
            "Harta nu a putut fi încărcată momentan. Ruta rămâne salvată în estimarea livrării."
          );
        }
      }
    }

    initializeMap();

    return () => {
      active = false;
      timeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));

      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [
    mapKey,
    routePositions,
    restaurantPosition,
    customerPosition,
    restaurant,
    customer,
    selectedLayer,
    expanded,
  ]);

  const shellClass = expanded
    ? "fixed inset-0 z-[100] bg-slate-950/80 p-3 md:p-6 backdrop-blur-sm"
    : "relative";

  const mapClass = expanded
    ? "relative h-full min-h-[calc(100vh-1.5rem)] md:min-h-[calc(100vh-3rem)] overflow-hidden rounded-[2rem] border border-white/10 bg-slate-200 shadow-2xl"
    : "relative h-[500px] overflow-hidden rounded-[2rem] border border-gray-200 bg-slate-200 shadow-sm md:h-[560px]";

  return (
    <div className={shellClass}>
      <div className={mapClass}>
        <div ref={mapElementRef} className="absolute inset-0 z-0" />

        {mapLoading && !leafletError && (
          <div className="pointer-events-none absolute inset-0 z-[450] flex items-center justify-center bg-slate-100/70 backdrop-blur-[1px]">
            <div className="rounded-2xl border border-white/80 bg-white/90 px-5 py-4 text-sm font-bold text-gray-700 shadow-sm">
              Se încarcă harta și traseul...
            </div>
          </div>
        )}

        {leafletError && (
          <div className="absolute inset-0 z-[460] flex items-center justify-center p-6 text-center">
            <div className="max-w-md rounded-3xl border border-red-100 bg-white p-6 text-red-600 shadow-xl">
              <p className="font-bold">Harta nu este disponibilă.</p>
              <p className="mt-2 text-sm text-red-500">{leafletError}</p>
            </div>
          </div>
        )}

        <div className="absolute left-4 right-4 top-4 z-[470] flex flex-col gap-3 md:left-5 md:right-5 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm rounded-3xl border border-white/80 bg-white/95 p-4 shadow-xl backdrop-blur">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">
              Hartă livrare
            </p>
            <h4 className="mt-1 text-lg font-black text-gray-950">
              Rută restaurant - client
            </h4>
            <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
              <div className="rounded-2xl bg-gray-50 p-3">
                <p className="text-xs text-gray-500">Distanță</p>
                <p className="font-black text-gray-950">
                  {formatDistance(distanceKm)}
                </p>
              </div>
              <div className="rounded-2xl bg-gray-50 p-3">
                <p className="text-xs text-gray-500">Drum</p>
                <p className="font-black text-gray-950">
                  {formatMinutes(drivingMinutes)}
                </p>
              </div>
              <div className="rounded-2xl bg-gray-50 p-3">
                <p className="text-xs text-gray-500">Rută</p>
                <p className="font-black text-gray-950">
                  {routePositions.length > 1 ? "Calculată" : "Parțială"}
                </p>
              </div>
            </div>
            {estimatedArrival && (
              <p className="mt-3 rounded-2xl bg-orange-50 px-3 py-2 text-xs font-bold text-primary">
                Sosirea estimată include pregătirea comenzii și timpul de deplasare.
              </p>
            )}

            <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-gray-600">
              <span className="rounded-full bg-orange-50 px-3 py-1 text-primary">🍕 Restaurant</span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">🏠 Client</span>
              <span className="rounded-full bg-white px-3 py-1 text-gray-700 ring-1 ring-gray-200">Traseu rutier</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-3xl border border-white/80 bg-white/95 p-2 shadow-xl backdrop-blur md:justify-end">
            {Object.entries(TILE_LAYERS).map(([key, layer]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedLayer(key)}
                className={`!w-auto rounded-full border px-4 py-2 text-xs font-black transition ${
                  selectedLayer === key
                    ? "border-primary bg-primary text-white"
                    : "border-gray-200 bg-white text-gray-700 hover:border-primary hover:text-primary"
                }`}
              >
                {layer.label}
              </button>
            ))}

            {directionsUrl && (
              <a
                href={directionsUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-black text-gray-700 transition hover:border-primary hover:text-primary"
              >
                Deschide în Maps
              </a>
            )}

            <button
              type="button"
              onClick={() => setExpanded((current) => !current)}
              className="!w-auto rounded-full border border-gray-200 bg-gray-950 px-4 py-2 text-xs font-black text-white transition hover:bg-primary"
            >
              {expanded ? "Închide" : "Mărește"}
            </button>
          </div>
        </div>

        <div className="absolute bottom-4 left-4 right-4 z-[470] grid gap-3 md:left-5 md:right-5 md:grid-cols-3">
          <div className="rounded-3xl border border-white/80 bg-white/95 p-4 shadow-xl backdrop-blur">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
              Start
            </p>
            <p className="mt-1 line-clamp-2 text-sm font-bold text-gray-950">
              {restaurant?.address || restaurant?.displayName || "Restaurant"}
            </p>
          </div>

          <div className="rounded-3xl border border-white/80 bg-white/95 p-4 shadow-xl backdrop-blur">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
              Destinație
            </p>
            <p className="mt-1 line-clamp-2 text-sm font-bold text-gray-950">
              {customer?.address || customer?.displayName || "Adresă client"}
            </p>
          </div>

          <div className="rounded-3xl border border-white/80 bg-white/95 p-4 shadow-xl backdrop-blur">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
              Status rută
            </p>
            <p className="mt-1 text-sm font-bold text-gray-950">
              {routePositions.length > 1
                ? "Traseu rutier calculat"
                : "Se afișează punctele disponibile"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
