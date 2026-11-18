// Positioned slide renderer adapted from Paperwren's Slides viewer
// (MIT License, Copyright (c) 2026 Paperwren contributors).
import { useId, type CSSProperties, type ReactNode } from "react";
import type {
  Gradient,
  Para,
  Slide,
  SlideElement,
  TextBody,
} from "../../lib/slides/parse";
import { SlideChart } from "./SlideChart";

const FALLBACK_FONTS =
  ", Calibri, Carlito, 'Segoe UI', Arial, 'Noto Naskh Arabic', 'Noto Sans Arabic', Tahoma, sans-serif";

function marked(text: string, query: string): ReactNode {
  const needle = query.trim();
  if (!needle) return text;
  const haystack = text.toLowerCase();
  const target = needle.toLowerCase();
  if (!target || !haystack.includes(target)) return text;
  const parts: ReactNode[] = [];
  let cursor = 0;
  let at = haystack.indexOf(target);
  let key = 0;
  while (at !== -1) {
    if (at > cursor) parts.push(text.slice(cursor, at));
    parts.push(<mark key={key++}>{text.slice(at, at + target.length)}</mark>);
    cursor = at + target.length;
    at = haystack.indexOf(target, cursor);
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
}

function Paragraph({ p, query = "" }: { p: Para; query?: string }) {
  const bullet =
    p.bullet && p.runs.some((run) => run.text.trim())
      ? p.bullet === "#"
        ? "•"
        : p.bullet
      : null;
  const first = p.runs[0];
  return (
    <p
      dir={p.rtl ? "rtl" : undefined}
      style={{
        textAlign: p.align,
        marginInlineStart: p.indent,
        paddingTop: p.spaceBefore,
        paddingBottom: p.spaceAfter,
        lineHeight:
          p.linePoints !== undefined
            ? `${p.linePoints}px`
            : p.lineHeight
              ? p.lineHeight * 1.2
              : undefined,
        textIndent: !p.bullet ? p.hanging : undefined,
        fontSize: p.runs.length ? undefined : p.endSize,
        minHeight: p.runs.length ? undefined : `${p.endSize * 1.2}px`,
      }}
    >
      {bullet && (
        <span
          className="sl-bullet"
          style={{ fontSize: first?.size, color: first?.color }}
        >
          {bullet}
        </span>
      )}
      {p.runs.map((run, index) => {
        if (run.br) return <br key={index} />;
        const style: CSSProperties = {
          fontSize: run.size,
          fontWeight: run.bold ? 700 : undefined,
          fontStyle: run.italic ? "italic" : undefined,
          textDecoration:
            [run.underline && "underline", run.strike && "line-through"]
              .filter(Boolean)
              .join(" ") || undefined,
          color: run.color,
          position: run.baseline ? "relative" : undefined,
          top: run.baseline ? -run.baseline * run.size : undefined,
          letterSpacing: run.tracking,
          textTransform: run.caps === "all" ? "uppercase" : undefined,
          fontVariant: run.caps === "small" ? "small-caps" : undefined,
          fontFamily: run.font ? `'${run.font}'${FALLBACK_FONTS}` : undefined,
        };
        const content = marked(run.text, query);
        return run.href ? (
          <a
            key={index}
            href={run.href}
            target="_blank"
            rel="noopener noreferrer nofollow"
            style={style}
          >
            {content}
          </a>
        ) : (
          <span key={index} style={style}>
            {content}
          </span>
        );
      })}
    </p>
  );
}

function Text({
  body,
  query = "",
  flow = false,
}: {
  body: TextBody;
  query?: string;
  flow?: boolean;
}) {
  const [left, top, right, bottom] = body.insets;
  return (
    <div
      className="sl-text"
      style={{
        position: flow ? "relative" : undefined,
        height: flow ? "100%" : undefined,
        padding: `${top}px ${right}px ${bottom}px ${left}px`,
        justifyContent:
          body.anchor === "middle"
            ? "center"
            : body.anchor === "bottom"
              ? "flex-end"
              : "flex-start",
        whiteSpace: body.wrap ? "pre-wrap" : "pre",
        writingMode:
          body.verticalMode === "vert270"
            ? "vertical-lr"
            : body.vertical
              ? "vertical-rl"
              : undefined,
        transform:
          [
            body.verticalMode === "vert270" ? "rotate(180deg)" : "",
            body.rotation ? `rotate(${body.rotation}deg)` : "",
          ]
            .join(" ")
            .trim() || undefined,
        display: body.columns && body.columns > 1 ? "block" : undefined,
        columnCount: body.columns && body.columns > 1 ? body.columns : undefined,
        columnGap: body.columnGap,
        columnFill: "auto",
      }}
    >
      {body.paras.map((paragraph, index) => (
        <Paragraph key={index} p={paragraph} query={query} />
      ))}
    </div>
  );
}

function Paint({ id, gradient }: { id: string; gradient: Gradient }) {
  const stops = gradient.stops.map((stop, index) => (
    <stop key={index} offset={`${stop.at}%`} stopColor={stop.color} />
  ));
  return (
    <defs>
      {gradient.kind === "radial" ? (
        <radialGradient id={id} cx="50%" cy="50%" r="71%">
          {stops}
        </radialGradient>
      ) : (
        <linearGradient
          id={id}
          x1="0"
          y1="0"
          x2="1"
          y2="0"
          gradientTransform={`rotate(${gradient.angle} 0.5 0.5)`}
        >
          {stops}
        </linearGradient>
      )}
    </defs>
  );
}

function Geometry({ el }: { el: Extract<SlideElement, { kind: "shape" }> }) {
  const paint = `pw${useId().replace(/:/g, "")}`;
  if (!el.fill && !el.line && !el.image) return null;
  const { w, h } = el;
  const fill = el.image
    ? `url(#${paint}img)`
    : el.gradient
      ? `url(#${paint})`
      : el.fill;
  const [cl, ct, cr, cb] = el.imageCrop ?? [0, 0, 0, 0];
  const defs = el.image ? (
    <defs>
      <pattern id={`${paint}img`} patternUnits="userSpaceOnUse" width={w} height={h}>
        <image
          href={el.image ?? undefined}
          x={(-cl * w) / (1 - cl - cr)}
          y={(-ct * h) / (1 - ct - cb)}
          width={w / (1 - cl - cr)}
          height={h / (1 - ct - cb)}
          preserveAspectRatio="none"
          opacity={el.imageOpacity}
          style={{ filter: el.imageFilter }}
        />
      </pattern>
    </defs>
  ) : el.gradient ? (
    <Paint id={paint} gradient={el.gradient} />
  ) : undefined;
  const stroke = el.line?.color;
  const sw = el.line?.width ?? 0;
  const common = {
    fill: fill ?? "none",
    stroke: stroke ?? "none",
    strokeWidth: sw,
    strokeDasharray: el.line?.dash ? `${sw * 3} ${sw * 2}` : undefined,
    vectorEffect: "non-scaling-stroke" as const,
  };
  if (el.paths)
    return (
      <>
        {el.paths.map((path, index) => (
          <svg
            key={index}
            viewBox={`0 0 ${path.w} ${path.h}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {index === 0 && defs}
            <path
              d={path.d}
              {...common}
              fill={path.fill ? common.fill : "none"}
              stroke={path.stroke ? common.stroke : "none"}
            />
          </svg>
        ))}
      </>
    );
  let shape: ReactNode;
  switch (el.geom) {
    case "ellipse":
      shape = <ellipse cx={w / 2} cy={h / 2} rx={w / 2} ry={h / 2} {...common} />;
      break;
    case "line":
    case "straightConnector1":
    case "bentConnector3":
      shape = (
        <line x1={0} y1={0} x2={w} y2={h} {...common} fill="none" stroke={stroke ?? "#000"} />
      );
      break;
    case "triangle":
      shape = <polygon points={`${w / 2},0 ${w},${h} 0,${h}`} {...common} />;
      break;
    case "rtTriangle":
      shape = <polygon points={`0,0 ${w},${h} 0,${h}`} {...common} />;
      break;
    case "diamond":
      shape = (
        <polygon points={`${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}`} {...common} />
      );
      break;
    case "rightArrow":
      shape = (
        <polygon
          points={`0,${h * 0.25} ${w * 0.7},${h * 0.25} ${w * 0.7},0 ${w},${h / 2} ${w * 0.7},${h} ${w * 0.7},${h * 0.75} 0,${h * 0.75}`}
          {...common}
        />
      );
      break;
    case "chevron":
    case "homePlate":
      shape = (
        <polygon
          points={`0,0 ${w * 0.8},0 ${w},${h / 2} ${w * 0.8},${h} 0,${h}${el.geom === "chevron" ? ` ${w * 0.2},${h / 2}` : ""}`}
          {...common}
        />
      );
      break;
    default:
      shape = <rect x={0} y={0} width={w} height={h} rx={el.radius ?? 0} {...common} />;
  }
  return (
    <svg
      viewBox={`0 0 ${Math.max(w, 1)} ${Math.max(h, 1)}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {defs}
      {shape}
    </svg>
  );
}

function cropStyle([l, t, r, b]: [number, number, number, number]): CSSProperties {
  const keptWidth = 1 - l - r;
  const keptHeight = 1 - t - b;
  return {
    position: "absolute",
    width: `${100 / keptWidth}%`,
    height: `${100 / keptHeight}%`,
    left: `${(-l / keptWidth) * 100}%`,
    top: `${(-t / keptHeight) * 100}%`,
  };
}

function Element({
  el,
  query,
  compact,
}: {
  el: SlideElement;
  query?: string;
  compact?: boolean;
}) {
  const transform = [
    el.rot ? `rotate(${el.rot}deg)` : "",
    el.flipH ? "scaleX(-1)" : "",
    el.flipV ? "scaleY(-1)" : "",
  ]
    .join(" ")
    .trim();
  const style: CSSProperties = {
    left: el.matrix ? 0 : el.x,
    top: el.matrix ? 0 : el.y,
    width: el.w,
    height: el.h,
    transform: el.matrix
      ? `matrix(${el.matrix.join(",")})`
      : transform || undefined,
    transformOrigin: el.matrix ? "0 0" : undefined,
  };
  switch (el.kind) {
    case "shape":
      return (
        <div
          className="sl-el"
          style={{
            ...style,
            filter: el.shadow ? `drop-shadow(${el.shadow})` : undefined,
            borderRadius:
              el.geom === "ellipse"
                ? "50%"
                : el.geom === "roundRect"
                  ? el.radius
                  : undefined,
          }}
        >
          <Geometry el={el} />
          {el.text && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                transform:
                  el.flipH || el.flipV
                    ? `scale(${el.flipH ? -1 : 1}, ${el.flipV ? -1 : 1})`
                    : undefined,
              }}
            >
              <Text body={el.text} query={compact ? undefined : query} />
            </div>
          )}
        </div>
      );
    case "image":
      return (
        <div
          className="sl-el"
          style={{
            ...style,
            filter: el.shadow ? `drop-shadow(${el.shadow})` : undefined,
          }}
        >
          <div
            className="sl-clip"
            style={{ borderRadius: el.round === "ellipse" ? "50%" : el.round }}
          >
            {el.src ? (
              <img
                className="sl-img"
                src={el.src}
                alt=""
                draggable={false}
                style={{
                  ...(el.crop ? cropStyle(el.crop) : {}),
                  opacity: el.opacity,
                  filter: el.imageFilter,
                }}
              />
            ) : (
              <div className="sl-missing">Image</div>
            )}
          </div>
        </div>
      );
    case "table":
      return (
        <div className="sl-el" style={style}>
          <table className="sl-table" dir={el.rtl ? "rtl" : undefined}>
            <colgroup>
              {el.cols.map((width, index) => (
                <col key={index} style={{ width }} />
              ))}
            </colgroup>
            <tbody>
              {el.rows.map((row, rowIndex) => (
                <tr key={rowIndex} style={{ height: row.h }}>
                  {row.cells.map((cell, cellIndex) =>
                    cell.hidden ? null : (
                      <td
                        key={cellIndex}
                        colSpan={cell.span}
                        rowSpan={cell.rowSpan}
                        style={{
                          background: cell.fill,
                          borderTop: cell.borders?.top,
                          borderRight: cell.borders?.right,
                          borderBottom: cell.borders?.bottom,
                          borderLeft: cell.borders?.left,
                        }}
                      >
                        <Text body={cell.text} flow />
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "chart":
      return (
        <div className="sl-el" style={style}>
          <SlideChart chart={el.chart} w={el.w} h={el.h} />
        </div>
      );
    default:
      return (
        <div className="sl-el" style={style}>
          <div className="sl-placeholder">{el.label}</div>
        </div>
      );
  }
}

/** One slide drawn at its natural size; the caller scales it. */
export function SlideCanvas({
  slide,
  width,
  height,
  query = "",
  compact = false,
}: {
  slide: Slide;
  width: number;
  height: number;
  query?: string;
  compact?: boolean;
}) {
  return (
    <div
      className="sl-slide"
      style={{ width, height, background: slide.background }}
      data-hidden={slide.hidden ? "true" : undefined}
    >
      {slide.elements.map((element, index) => (
        <Element key={index} el={element} query={query} compact={compact} />
      ))}
    </div>
  );
}
