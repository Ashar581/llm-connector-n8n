import type { ExpressionKind, SpreadElementKind } from 'ast-types/lib/gen/kinds';
import { type SimpleNode } from './grammar';
type AstNode = ExpressionKind | SpreadElementKind;
/**
 * Once a chunk holds an extension call, extendTransform rewrites every
 * optional chain in it through its own polyfill, and that reprint drops the
 * parentheses around a `??` operand mixed with `&&` or `||`: the engines
 * then throw "invalid syntax" where this interpreter would evaluate. A
 * chunk with both an optional chain and an extension call is theirs. The
 * rewrite matches by method name alone, so a node-ref call like
 * `$input.first()` counts too.
 */
export declare function usesPolyfilledChain(root: SimpleNode): boolean;
export declare function parseSimple(
	node: AstNode,
	depth?: number,
	param?: string | null,
): SimpleNode | null;
export {};
//# sourceMappingURL=parser.d.ts.map
