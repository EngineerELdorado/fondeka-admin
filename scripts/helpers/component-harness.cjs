const React = require('react');
const { readFileSync } = require('node:fs');
const { transform } = require('next/dist/build/swc');

async function compileComponent(filename) {
  const { code } = await transform(readFileSync(filename, 'utf8'), { filename, jsc: { parser: { syntax: 'ecmascript', jsx: true }, target: 'es2020', transform: { react: { runtime: 'automatic' } } }, module: { type: 'commonjs' } });
  return (react, modules = {}) => {
    const module = { exports: {} };
    new Function('require', 'module', 'exports', code)((name) => name === 'react' ? react : modules[name] || require(name), module, module.exports);
    return module.exports;
  };
}

async function mountComponent(filename, { props, modules = {}, exportName = 'default' }) {
  const slots = [], effects = [];
  let cursor = 0, tree, dirty = false;
  const hooks = {
    ...React,
    useState(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { value: typeof initial === 'function' ? initial() : initial };
      return [slots[index].value, (next) => { const value = typeof next === 'function' ? next(slots[index].value) : next; if (!Object.is(value, slots[index].value)) { slots[index].value = value; dirty = true; } }];
    },
    useRef(initial) { const index = cursor++; if (!slots[index]) slots[index] = { value: { current: initial } }; return slots[index].value; },
    useId() { return hooks.useRef(`test-${cursor}`).current; },
    useImperativeHandle(ref, create) { if (ref) ref.current = create(); },
    useEffect(effect, deps = []) {
      const index = cursor++, previous = slots[index];
      if (!previous || deps.some((value, at) => !Object.is(value, previous.deps[at]))) { previous?.cleanup?.(); const slot = { deps }; slots[index] = slot; effects.push(() => { slot.cleanup = effect(); }); }
    },
    useMemo(factory, deps) {
      const index = cursor++, previous = slots[index];
      if (!previous || deps.some((value, at) => !Object.is(value, previous.deps[at]))) slots[index] = { deps, value: factory() };
      return slots[index].value;
    },
    useCallback(callback, deps) { return hooks.useMemo(() => callback, deps); }
  };
  const compiled = await compileComponent(filename);
  const resolvedModules = typeof modules === 'function' ? modules(hooks) : modules;
  const exports = compiled(hooks, resolvedModules);
  const render = () => {
    let count = 0;
    do { dirty = false; cursor = 0; const Component = exports[exportName]; tree = typeof Component === 'function' ? Component(props) : Component.render(props, null); effects.splice(0).forEach((effect) => effect()); if (++count > 30) throw new Error('Repeated component render'); } while (dirty);
  };
  const walk = (node) => Array.isArray(node) ? node.flatMap(walk) : React.isValidElement(node) ? [node, ...walk(node.props.children)] : [];
  const text = (node) => Array.isArray(node) ? node.map(text).join('') : React.isValidElement(node) ? text(node.props.children) : node == null || typeof node === 'boolean' ? '' : String(node);
  const find = (predicate) => { const found = walk(tree).find(predicate); if (!found) throw new Error('Component control not found'); return found; };
  const flush = async () => { for (let i = 0; i < 12; i++) { await Promise.resolve(); render(); } };
  render();
  return {
    hooks, modules: exports, nodes: () => walk(tree), text: () => text(tree),
    button: (label) => find((node) => node.type === 'button' && text(node) === label).props,
    async click(label) { find((node) => node.type === 'button' && text(node) === label).props.onClick(); await flush(); },
    field(label) { return find((node) => node.props.label === label).props.children; },
    change(label, value) {
      const input = find((node) => node.props.label === label).props.children;
      input.props.onChange({ target: { value, checked: value } }); render();
    },
    check(value) { find((node) => node.type === 'input' && node.props.type === 'checkbox').props.onChange({ target: { checked: value } }); render(); },
    flush,
    unmount() { slots.forEach((slot) => slot?.cleanup?.()); }
  };
}
module.exports = { mountComponent, compileComponent };
