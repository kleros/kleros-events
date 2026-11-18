import { createElement, type ReactElement, type ReactNode } from "react";
import type { CoverChild, CoverNode } from "./share";

/**
 * A cover tree as React elements. The props are already React's (camelCase SVG attributes, style objects,
 * className), and children go in as arguments, so no keys are needed. Works in server and client components,
 * and in next/og.
 */
export function toReact(n: CoverNode): ReactElement;
export function toReact(n: CoverChild): ReactNode;
export function toReact(n: CoverChild): ReactNode {
  if (typeof n !== "object" || n === null) return n;
  const { children, ...props } = n.props;
  const kids = children === undefined ? [] : Array.isArray(children) ? children : [children];
  return createElement(n.type, props, ...kids.map((c) => toReact(c)));
}
