import { useEffect, useMemo, useRef, useState } from 'react';
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from 'd3-force';
import type { MediaType } from '@kanzen/shared';
import { useMotionPref } from '../lib/store';

export type ConstellationNode = SimulationNodeDatum & {
  id: string;
  title: string;
  type: MediaType;
  status: string;
  progress: number;
  score: number | null;
};
export type ConstellationLink = SimulationLinkDatum<ConstellationNode> & { kind: string };

type Props = {
  nodes: ConstellationNode[];
  links: ConstellationLink[];
  onSelect?: (id: string) => void;
  height?: number;
};

const TYPE_COLOR: Record<MediaType, string> = {
  anime: '#5eead4',
  manga: '#a78bfa',
  book: '#f4a8d4',
  movie: '#f76a41',
};
const TYPE_LANE: Record<MediaType, number> = { anime: -0.6, manga: -0.2, book: 0.2, movie: 0.6 };

/**
 * A force directed star map of the library. Works cluster into lanes by medium,
 * franchise relations become edges. Rendered on a canvas with a light physics
 * loop that settles and stops.
 */
export function Constellation({ nodes, links, onSelect, height = 460 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<Simulation<ConstellationNode, ConstellationLink> | null>(null);
  const [hover, setHover] = useState<{ node: ConstellationNode; x: number; y: number } | null>(
    null,
  );
  const { reduceMotion } = useMotionPref();

  const data = useMemo(
    () => ({
      nodes: nodes.map((n) => ({ ...n })),
      links: links
        .map((l) => ({ ...l }))
        .filter(
          (l) =>
            nodes.some(
              (n) =>
                n.id ===
                (typeof l.source === 'string' ? l.source : (l.source as ConstellationNode).id),
            ) &&
            nodes.some(
              (n) =>
                n.id ===
                (typeof l.target === 'string' ? l.target : (l.target as ConstellationNode).id),
            ),
        ),
    }),
    [nodes, links],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => {
      const w = wrap.clientWidth;
      canvas.width = w * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const w = () => canvas.width / dpr;

    const sim = forceSimulation<ConstellationNode>(data.nodes)
      .force(
        'link',
        forceLink<ConstellationNode, ConstellationLink>(data.links)
          .id((d) => d.id)
          .distance(46)
          .strength(0.35),
      )
      .force('charge', forceManyBody().strength(-70))
      .force(
        'collide',
        forceCollide<ConstellationNode>().radius((d) => 6 + (d.score ?? 5) / 3),
      )
      .force('center', forceCenter(w() / 2, height / 2))
      .force(
        'x',
        forceX<ConstellationNode>((d) => w() / 2 + TYPE_LANE[d.type] * w() * 0.42).strength(0.12),
      )
      .force('y', forceY(height / 2).strength(0.05));

    simRef.current = sim;

    const draw = () => {
      ctx.clearRect(0, 0, w(), height);
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = '#37427a';
      ctx.lineWidth = 1;
      for (const link of data.links) {
        const s = link.source as ConstellationNode;
        const t = link.target as ConstellationNode;
        if (s.x == null || t.x == null) continue;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y!);
        ctx.lineTo(t.x!, t.y!);
        ctx.stroke();
      }
      ctx.restore();

      for (const node of data.nodes) {
        if (node.x == null) continue;
        const radius = 3 + (node.score ?? 4) / 2.5;
        const done = node.status === 'completed' || node.status === 'repeating';
        ctx.beginPath();
        ctx.arc(node.x, node.y!, radius, 0, Math.PI * 2);
        ctx.fillStyle = TYPE_COLOR[node.type];
        ctx.globalAlpha = done ? 1 : 0.55;
        ctx.fill();
        ctx.globalAlpha = 1;
        if (done) {
          ctx.beginPath();
          ctx.arc(node.x, node.y!, radius + 2.5, 0, Math.PI * 2);
          ctx.strokeStyle = TYPE_COLOR[node.type];
          ctx.globalAlpha = 0.4;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }
    };

    sim.on('tick', draw);
    // Always pre-settle synchronously so the layout is sensible even if the
    // animation loop is throttled, then keep it warm briefly for the drift-in.
    sim.stop();
    sim.tick(90);
    draw();
    if (!reduceMotion) {
      sim.alpha(0.35).restart();
      setTimeout(() => sim.alphaTarget(0), 1200);
      setTimeout(() => sim.stop(), 3200);
    }

    const pick = (mx: number, my: number) => {
      let best: ConstellationNode | null = null;
      let bestD = 14;
      for (const node of data.nodes) {
        if (node.x == null) continue;
        const d = Math.hypot(node.x - mx, node.y! - my);
        if (d < bestD) {
          bestD = d;
          best = node;
        }
      }
      return best;
    };

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const node = pick(e.clientX - rect.left, e.clientY - rect.top);
      setHover(node ? { node, x: e.clientX - rect.left, y: e.clientY - rect.top } : null);
      canvas.style.cursor = node ? 'pointer' : 'default';
    };
    const onClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const node = pick(e.clientX - rect.left, e.clientY - rect.top);
      if (node && onSelect) onSelect(node.id);
    };
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('click', onClick);

    return () => {
      sim.stop();
      ro.disconnect();
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('click', onClick);
    };
  }, [data, height, reduceMotion, onSelect]);

  return (
    <div ref={wrapRef} className="relative">
      <canvas ref={canvasRef} className="rounded-[14px]" />
      <div className="pointer-events-none absolute left-3 top-3 flex gap-3 text-[0.7rem] text-ink-muted">
        {(Object.keys(TYPE_COLOR) as MediaType[]).map((t) => (
          <span key={t} className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: TYPE_COLOR[t] }} />
            {t}
          </span>
        ))}
      </div>
      {hover ? (
        <div
          className="pointer-events-none absolute z-10 max-w-[200px] rounded-lg border border-hairline-bright bg-night-2 px-2.5 py-1.5 text-xs text-ink shadow-lg"
          style={{ left: Math.min(hover.x + 12, 260), top: hover.y + 12 }}
        >
          <p className="font-medium">{hover.node.title}</p>
          <p className="text-ink-muted">
            {hover.node.type} · {hover.node.status}
            {hover.node.score ? ` · ${hover.node.score}` : ''}
          </p>
        </div>
      ) : null}
    </div>
  );
}
