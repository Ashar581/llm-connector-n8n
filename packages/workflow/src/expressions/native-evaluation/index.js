'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.TIME_METHODS =
	exports.MAX_WORK =
	exports.MAX_STEPS =
	exports.MAX_RESULT_LENGTH =
	exports.ITERATOR_METHODS =
	exports.CALLABLE_METHODS =
		void 0;
exports.isNativelyEvaluable = isNativelyEvaluable;
exports.evaluateNatively = evaluateNatively;
const tournament_1 = require('@n8n/tournament');
const lru_cache_1 = require('@n8n/utils/lru-cache');
const evaluator_1 = require('./evaluator');
const grammar_1 = require('./grammar');
const parser_1 = require('./parser');
var grammar_2 = require('./grammar');
Object.defineProperty(exports, 'CALLABLE_METHODS', {
	enumerable: true,
	get: function () {
		return grammar_2.CALLABLE_METHODS;
	},
});
Object.defineProperty(exports, 'ITERATOR_METHODS', {
	enumerable: true,
	get: function () {
		return grammar_2.ITERATOR_METHODS;
	},
});
Object.defineProperty(exports, 'MAX_RESULT_LENGTH', {
	enumerable: true,
	get: function () {
		return grammar_2.MAX_RESULT_LENGTH;
	},
});
Object.defineProperty(exports, 'MAX_STEPS', {
	enumerable: true,
	get: function () {
		return grammar_2.MAX_STEPS;
	},
});
Object.defineProperty(exports, 'MAX_WORK', {
	enumerable: true,
	get: function () {
		return grammar_2.MAX_WORK;
	},
});
Object.defineProperty(exports, 'TIME_METHODS', {
	enumerable: true,
	get: function () {
		return grammar_2.TIME_METHODS;
	},
});
// null = outside the subset. Declined expressions are cached too, so an
// expression the engine owns costs one parse here, not one per evaluation.
// Entries are keyed by expression text, so the key length is capped to keep
// the cache's memory bounded; longer expressions are compiled per evaluation.
const cache = new lru_cache_1.LruCache(1024);
const MAX_CACHED_EXPRESSION_LENGTH = 10_000;
// One code chunk of the split expression, or null when it is outside the
// subset. A throw during the re-parse must always mean "declined", never
// escape.
function compileChunk(chunk) {
	const body = chunk.parsed.program.body;
	if (body.length !== 1) return null;
	const statement = body[0];
	if (statement.type !== 'ExpressionStatement') return null;
	try {
		const node = (0, parser_1.parseSimple)(statement.expression);
		return node !== null && (0, parser_1.usesPolyfilledChain)(node) ? null : node;
	} catch {
		return null;
	}
}
function compile(expression) {
	let parsed;
	try {
		parsed = (0, tournament_1.getParsedExpression)(expression);
	} catch {
		// Syntax errors fall through to the engine for its error reporting.
		return null;
	}
	const chunks = [];
	for (const chunk of parsed) {
		if (chunk.type === 'text') {
			chunks.push(chunk);
			continue;
		}
		const node = compileChunk(chunk);
		if (node === null) return null;
		chunks.push({ type: 'code', node });
	}
	// Mirrors the branch condition in ExpressionBuilder.getExpressionCode.
	const isWholeValue = chunks.length === 2 && chunks[0].type === 'text' && chunks[0].text === '';
	return { chunks, isWholeValue };
}
function getCompiled(expression) {
	if (expression.length > MAX_CACHED_EXPRESSION_LENGTH) return compile(expression);
	let compiled = cache.get(expression);
	if (compiled === undefined) {
		compiled = compile(expression);
		cache.set(expression, compiled);
	}
	return compiled;
}
/** Does the expression (leading `=` stripped) fit the native subset? */
function isNativelyEvaluable(expression) {
	return getCompiled(expression) !== null;
}
/**
 * Evaluate an expression (with the leading `=` already stripped) in-process.
 * Returns `{ handled: false }` when the expression is outside the subset or a
 * runtime value fell outside what parsing proved; the caller must then run
 * the regular pipeline.
 */
function evaluateNatively(expression, data) {
	const compiled = getCompiled(expression);
	if (compiled === null) return { handled: false };
	try {
		const value = copyResult(evalCompiled(compiled, data));
		return { handled: true, value };
	} catch (error) {
		if (error instanceof evaluator_1.EngineFallbackError) return { handled: false };
		throw error;
	}
}
// The engines hand back a copy of any object they return; a whole-value read
// like `{{ $json.body }}` here would hand back the live execution data, which
// callers then mutate in place (cleanupParameterData). Match the engines.
// The `$parameter` root is a Proxy and cannot be cloned: the engine owns it.
function copyResult(value) {
	if (!(0, grammar_1.isObj)(value)) return value;
	try {
		return (0, grammar_1.clone)(value);
	} catch {
		throw new evaluator_1.EngineFallbackError();
	}
}
function evalCompiled(compiled, data) {
	const env = new evaluator_1.Env(data);
	if (compiled.isWholeValue) {
		const code = compiled.chunks[1];
		// isWholeValue guarantees chunks = [text '', code]
		return code.type === 'code' ? (0, evaluator_1.evalChunk)(code.node, env) : '';
	}
	// String concatenation, mirroring tmpl semantics: falsy chunk values other
	// than 0/false render as '', parts are joined with String() coercion.
	const parts = [];
	let length = 0;
	for (const chunk of compiled.chunks) {
		if (chunk.type === 'text') {
			if (chunk.text !== '') parts.push(chunk.text);
			length += chunk.text.length;
			continue;
		}
		const value = (0, evaluator_1.evalChunk)(chunk.node, env);
		// An object here would coerce through its toString on the host.
		if ((0, grammar_1.isObj)(value)) {
			throw new evaluator_1.EngineFallbackError();
		}
		const part = value || value === 0 || value === false ? value : '';
		parts.push(part);
		length += typeof part === 'string' ? part.length : 1;
		// Bound before the join allocates the combined string.
		if (length > grammar_1.MAX_RESULT_LENGTH) throw new evaluator_1.EngineFallbackError();
	}
	// Single-chunk expressions (plain text, or a lone blank `{{}}`) return the
	// part as-is; everything else joins to a string.
	if (compiled.chunks.length < 2) return parts[0] ?? '';
	return (0, evaluator_1.bounded)(parts.join(''));
}
//# sourceMappingURL=index.js.map
