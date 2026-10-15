import { useState, useLayoutEffect, useRef } from "react";

// Encapsula um elemento de tamanho fixo (ex.: 14cm) e o redimensiona via
// transform: scale() para caber na largura do container, preservando as
// dimensões internas exatas (cm). O Leaflet mede o container em px de layout
// (não afetados pelo transform), então o mapa continua íntegro e interativo.
export default function FitScale({ children }) {
  const outerRef = useRef(null);
  const innerRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [boxH, setBoxH] = useState(null);

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    const update = () => {
      const cw = outer.clientWidth;
      const nw = inner.offsetWidth;
      const nh = inner.offsetHeight;
      if (nw === 0) return;
      const s = nw > cw ? cw / nw : 1;
      setScale(s);
      setBoxH(nh * s);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(outer);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={outerRef} className="w-full flex justify-center" style={boxH != null ? { height: boxH } : undefined}>
      <div ref={innerRef} style={{ transform: `scale(${scale})`, transformOrigin: "top center" }}>
        {children}
      </div>
    </div>
  );
}